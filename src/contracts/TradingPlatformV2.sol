// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPriceOracleV2 {
    function getPrice(bytes32 pairId) external view returns (uint256 price, uint256 updatedAt);
}

contract TradingPlatformV2 is ReentrancyGuard, Ownable {
    /*//////////////////////////////////////////////////////////////
                                CONFIG
    //////////////////////////////////////////////////////////////*/

    IERC20 public immutable collateralToken;
    IPriceOracleV2 public oracle;

    uint256 public maxLeverage = 50;              // 50x
    uint256 public maintenanceMarginBps = 1000;   // 10%
    uint256 public maxProfitBps = 30000;          // 300%
    uint256 public priceTimeout = 120;            // 2 minutes

    uint256 public nextPositionId = 1;

    /*//////////////////////////////////////////////////////////////
                                DATA
    //////////////////////////////////////////////////////////////*/

    struct Position {
        address trader;
        bytes32 pairId;
        bool isLong;

        uint256 margin;
        uint256 leverage;
        uint256 notional;

        uint256 entryPrice;
        uint256 liquidationPrice;
        uint256 stopLoss;
        uint256 takeProfit;

        bool isOpen;
    }

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event PositionOpened(
        uint256 indexed id,
        address indexed trader,
        bytes32 pairId,
        bool isLong,
        uint256 margin,
        uint256 leverage,
        uint256 entryPrice
    );

    event PositionClosed(
        uint256 indexed id,
        address indexed trader,
        uint256 exitPrice,
        int256 pnl
    );

    event PositionLiquidated(
        uint256 indexed id,
        address indexed trader,
        uint256 price
    );

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _oracle, address _collateralToken) Ownable(msg.sender) {
        require(_oracle != address(0), "Invalid oracle");
        require(_collateralToken != address(0), "Invalid collateral");

        oracle = IPriceOracleV2(_oracle);
        collateralToken = IERC20(_collateralToken);
    }

    /*//////////////////////////////////////////////////////////////
                          POSITION MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function openPosition(
        bytes32 pairId,
        bool isLong,
        uint256 margin,
        uint256 leverage,
        uint256 stopLoss,
        uint256 takeProfit
    ) external nonReentrant returns (uint256 id) {
        require(margin > 0, "Margin too low");
        require(leverage > 0 && leverage <= maxLeverage, "Invalid leverage");

        (uint256 price, uint256 updatedAt) = oracle.getPrice(pairId);
        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt <= priceTimeout, "Stale price");

        collateralToken.transferFrom(msg.sender, address(this), margin);

        uint256 notional = margin * leverage;
        uint256 liquidationPrice = _calcLiquidationPrice(
            price,
            leverage,
            isLong
        );

        id = nextPositionId++;

        positions[id] = Position({
            trader: msg.sender,
            pairId: pairId,
            isLong: isLong,
            margin: margin,
            leverage: leverage,
            notional: notional,
            entryPrice: price,
            liquidationPrice: liquidationPrice,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            isOpen: true
        });

        userPositions[msg.sender].push(id);

        emit PositionOpened(
            id,
            msg.sender,
            pairId,
            isLong,
            margin,
            leverage,
            price
        );
    }

    function closePosition(uint256 id) external nonReentrant {
        Position storage p = positions[id];
        require(p.isOpen, "Position closed");
        require(p.trader == msg.sender, "Not owner");

        (uint256 price, uint256 updatedAt) = oracle.getPrice(p.pairId);
        require(block.timestamp - updatedAt <= priceTimeout, "Stale price");

        _closePosition(id, price);
    }

    function liquidate(uint256 id) external nonReentrant {
        Position storage p = positions[id];
        require(p.isOpen, "Position closed");

        (uint256 price, uint256 updatedAt) = oracle.getPrice(p.pairId);
        require(block.timestamp - updatedAt <= priceTimeout, "Stale price");

        bool liquidatable = p.isLong
            ? price <= p.liquidationPrice
            : price >= p.liquidationPrice;

        require(liquidatable, "Not liquidatable");

        p.isOpen = false;

        emit PositionLiquidated(id, p.trader, price);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getPosition(uint256 id) external view returns (Position memory) {
        return positions[id];
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function getUserOpenPositions(address user) external view returns (Position[] memory) {
        uint256[] memory ids = userPositions[user];
        uint256 openCount = 0;
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].isOpen) {
                openCount++;
            }
        }
        
        Position[] memory openPositions = new Position[](openCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].isOpen) {
                openPositions[index] = positions[ids[i]];
                index++;
            }
        }
        
        return openPositions;
    }

    function getCurrentPnL(uint256 id) external view returns (int256) {
        Position memory p = positions[id];
        require(p.isOpen, "Position closed");
        
        (uint256 price,) = oracle.getPrice(p.pairId);
        return _calculatePnL(p, price);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL LOGIC
    //////////////////////////////////////////////////////////////*/

    function _closePosition(uint256 id, uint256 price) internal {
        Position storage p = positions[id];
        p.isOpen = false;

        int256 pnl = _calculatePnL(p, price);
        int256 payout = int256(p.margin) + pnl;

        if (payout > 0) {
            collateralToken.transfer(p.trader, uint256(payout));
        }

        emit PositionClosed(id, p.trader, price, pnl);
    }

    function _calculatePnL(
        Position memory p,
        uint256 price
    ) internal view returns (int256) {
        int256 priceDiff = p.isLong
            ? int256(price) - int256(p.entryPrice)
            : int256(p.entryPrice) - int256(price);

        int256 rawPnl = (priceDiff * int256(p.notional)) / int256(p.entryPrice);

        int256 maxProfit = int256(
            (p.margin * maxProfitBps) / 10000
        );

        if (rawPnl > maxProfit) return maxProfit;
        return rawPnl;
    }

    function _calcLiquidationPrice(
        uint256 entryPrice,
        uint256 leverage,
        bool isLong
    ) internal view returns (uint256) {
        uint256 mm = (entryPrice * maintenanceMarginBps) / 10000 / leverage;

        return isLong
            ? entryPrice - mm
            : entryPrice + mm;
    }

    /*//////////////////////////////////////////////////////////////
                              ADMIN
    //////////////////////////////////////////////////////////////*/

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracle = IPriceOracleV2(_oracle);
    }

    function setRiskParams(
        uint256 _maxLeverage,
        uint256 _maintenanceMarginBps,
        uint256 _maxProfitBps
    ) external onlyOwner {
        maxLeverage = _maxLeverage;
        maintenanceMarginBps = _maintenanceMarginBps;
        maxProfitBps = _maxProfitBps;
    }

    function setPriceTimeout(uint256 _timeout) external onlyOwner {
        priceTimeout = _timeout;
    }
}
