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
                            PROTOCOL REVENUE
    //////////////////////////////////////////////////////////////*/

    /// @notice Protocol treasury address
    address public treasury;

    /// @notice Trading fees in basis points (1 bp = 0.01%)
    uint256 public openFeeBps = 8;      // 0.08%
    uint256 public closeFeeBps = 8;     // 0.08%

    /// @notice Liquidation split - reward for liquidators
    uint256 public liquidatorRewardBps = 3000; // 30%

    /*//////////////////////////////////////////////////////////////
                                DATA
    //////////////////////////////////////////////////////////////*/

    struct Position {
        address trader;
        bytes32 pairId;
        bool isLong;

        uint256 margin;         // Net margin after open fee
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
        address indexed liquidator,
        uint256 price,
        uint256 penalty
    );

    event ProtocolFeeCollected(
        uint256 indexed positionId,
        address indexed trader,
        uint256 amount,
        string feeType
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TradingFeesUpdated(uint256 openFeeBps, uint256 closeFeeBps);
    event LiquidatorRewardUpdated(uint256 rewardBps);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _oracle, address _collateralToken) Ownable(msg.sender) {
        require(_oracle != address(0), "Invalid oracle");
        require(_collateralToken != address(0), "Invalid collateral");

        oracle = IPriceOracleV2(_oracle);
        collateralToken = IERC20(_collateralToken);
        treasury = msg.sender; // Initialize treasury to deployer
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

        // Calculate and deduct open fee
        uint256 openFee = (margin * openFeeBps) / 10_000;
        uint256 netMargin = margin - openFee;
        require(netMargin > 0, "Margin too small for fees");

        (uint256 price, uint256 updatedAt) = oracle.getPrice(pairId);
        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt <= priceTimeout, "Stale price");

        // Transfer full margin from user
        require(
            collateralToken.transferFrom(msg.sender, address(this), margin),
            "Transfer failed"
        );

        // Transfer fee to treasury
        if (openFee > 0 && treasury != address(0)) {
            require(
                collateralToken.transfer(treasury, openFee),
                "Fee transfer failed"
            );
            emit ProtocolFeeCollected(nextPositionId, msg.sender, openFee, "open");
        }

        uint256 notional = netMargin * leverage;
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
            margin: netMargin,      // Store net margin after fee
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
            netMargin,
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

        // Split margin between liquidator and protocol
        uint256 penalty = p.margin;
        uint256 liquidatorReward = (penalty * liquidatorRewardBps) / 10_000;
        uint256 protocolFee = penalty - liquidatorReward;

        // Transfer reward to liquidator (caller)
        if (liquidatorReward > 0) {
            require(
                collateralToken.transfer(msg.sender, liquidatorReward),
                "Liquidator reward failed"
            );
        }

        // Transfer protocol fee to treasury
        if (protocolFee > 0 && treasury != address(0)) {
            require(
                collateralToken.transfer(treasury, protocolFee),
                "Protocol fee failed"
            );
            emit ProtocolFeeCollected(id, p.trader, protocolFee, "liquidation");
        }

        emit PositionLiquidated(id, p.trader, msg.sender, price, penalty);
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

    /// @notice Calculate open fee for a given margin (for UI preview)
    function calculateOpenFee(uint256 margin) external view returns (uint256) {
        return (margin * openFeeBps) / 10_000;
    }

    /// @notice Calculate close fee for a given profit (for UI preview)
    function calculateCloseFee(uint256 profit) external view returns (uint256) {
        return (profit * closeFeeBps) / 10_000;
    }

    /// @notice Get all fee configuration
    function getFeeConfig() external view returns (
        address _treasury,
        uint256 _openFeeBps,
        uint256 _closeFeeBps,
        uint256 _liquidatorRewardBps
    ) {
        return (treasury, openFeeBps, closeFeeBps, liquidatorRewardBps);
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL LOGIC
    //////////////////////////////////////////////////////////////*/

    function _closePosition(uint256 id, uint256 price) internal {
        Position storage p = positions[id];
        p.isOpen = false;

        int256 pnl = _calculatePnL(p, price);
        uint256 closeFee = 0;

        // Deduct fee only from profits
        if (pnl > 0) {
            closeFee = (uint256(pnl) * closeFeeBps) / 10_000;
            pnl -= int256(closeFee);
        }

        // Calculate payout (margin + adjusted pnl)
        int256 payout = int256(p.margin) + pnl;

        // Ensure payout is not negative
        if (payout < 0) {
            payout = 0;
        }

        // Transfer payout to trader
        if (payout > 0) {
            require(
                collateralToken.transfer(p.trader, uint256(payout)),
                "Transfer failed"
            );
        }

        // Transfer close fee to treasury
        if (closeFee > 0 && treasury != address(0)) {
            require(
                collateralToken.transfer(treasury, closeFee),
                "Fee transfer failed"
            );
            emit ProtocolFeeCollected(id, p.trader, closeFee, "close");
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
        
        // Cap loss at margin
        if (rawPnl < -int256(p.margin)) {
            return -int256(p.margin);
        }
        
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

    /// @notice Update protocol treasury address
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /// @notice Update trading fees (max 0.5% each)
    function setTradingFees(uint256 _openFeeBps, uint256 _closeFeeBps) external onlyOwner {
        require(_openFeeBps <= 50, "Open fee too high");  // Max 0.5%
        require(_closeFeeBps <= 50, "Close fee too high"); // Max 0.5%
        openFeeBps = _openFeeBps;
        closeFeeBps = _closeFeeBps;
        emit TradingFeesUpdated(_openFeeBps, _closeFeeBps);
    }

    /// @notice Update liquidator reward (max 50%)
    function setLiquidatorReward(uint256 _rewardBps) external onlyOwner {
        require(_rewardBps <= 5000, "Reward too high"); // Max 50%
        liquidatorRewardBps = _rewardBps;
        emit LiquidatorRewardUpdated(_rewardBps);
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
