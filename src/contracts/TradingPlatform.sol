// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PriceOracle.sol";

/**
 * @title TradingPlatform
 * @dev Core trading contract that handles opening/closing positions with tokenized currencies
 * Integrates with PriceOracle for real-time forex prices
 */
contract TradingPlatform is ReentrancyGuard, Ownable {
    PriceOracle public priceOracle;
    IERC20 public collateralToken;

    uint256 public platformFee = 30; // 0.3%
    uint256 public maxLeverage = 100; // 100x
    uint256 public minCollateral = 10 * 10**6; // 10 USDT (6 decimals)

    struct Position {
        address trader;
        string pair;
        bool isLong;
        uint256 collateral;
        uint256 leverage;
        uint256 size;
        int256 entryPrice;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 openedAt;
        bool isOpen;
    }

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;

    uint256 public nextPositionId = 1;
    uint256 public collectedFees;

    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        string pair,
        bool isLong,
        uint256 collateral,
        uint256 leverage,
        int256 entryPrice
    );

    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        int256 exitPrice,
        int256 pnl
    );

    event StopLossTriggered(uint256 indexed positionId, int256 exitPrice);
    event TakeProfitTriggered(uint256 indexed positionId, int256 exitPrice);

    constructor(address _priceOracle, address _collateralToken)
        Ownable(_msgSender()) // ✅ Pass msg.sender to the Ownable constructor
    {
        require(_priceOracle != address(0), "Invalid oracle address");
        require(_collateralToken != address(0), "Invalid collateral token");

        priceOracle = PriceOracle(_priceOracle);
        collateralToken = IERC20(_collateralToken);
    }

    function openPosition(
        string memory pair,
        bool isLong,
        uint256 collateralAmount,
        uint256 leverage,
        uint256 stopLoss,
        uint256 takeProfit
    ) external nonReentrant returns (uint256) {
        require(collateralAmount >= minCollateral, "Collateral too low");
        require(leverage > 0 && leverage <= maxLeverage, "Invalid leverage");

        int256 currentPrice = priceOracle.getLatestValidPrice(pair);
        require(currentPrice > 0, "Invalid price");

        require(
            collateralToken.transferFrom(msg.sender, address(this), collateralAmount),
            "Collateral transfer failed"
        );

        uint256 positionSize = collateralAmount * leverage;

        uint256 positionId = nextPositionId++;
        positions[positionId] = Position({
            trader: msg.sender,
            pair: pair,
            isLong: isLong,
            collateral: collateralAmount,
            leverage: leverage,
            size: positionSize,
            entryPrice: currentPrice,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            openedAt: block.timestamp,
            isOpen: true
        });

        userPositions[msg.sender].push(positionId);

        emit PositionOpened(
            positionId,
            msg.sender,
            pair,
            isLong,
            collateralAmount,
            leverage,
            currentPrice
        );

        return positionId;
    }

    function closePosition(uint256 positionId) external nonReentrant {
        Position storage position = positions[positionId];

        require(position.isOpen, "Position is not open");
        require(position.trader == msg.sender, "Not position owner");

        int256 exitPrice = priceOracle.getLatestValidPrice(position.pair);
        require(exitPrice > 0, "Invalid exit price");

        int256 pnl = _calculatePnL(position, exitPrice);

        position.isOpen = false;

        uint256 fee = (position.size * platformFee) / 10000;
        collectedFees += fee;

        int256 returnAmount = int256(position.collateral) + pnl - int256(fee);

        if (returnAmount > 0) {
            require(
                collateralToken.transfer(position.trader, uint256(returnAmount)),
                "Return transfer failed"
            );
        }

        emit PositionClosed(positionId, msg.sender, exitPrice, pnl);
    }

    function _calculatePnL(Position memory position, int256 currentPrice)
        internal
        pure
        returns (int256 pnl)
    {
        int256 priceDiff = currentPrice - position.entryPrice;
        if (!position.isLong) {
            priceDiff = -priceDiff;
        }
        pnl = (priceDiff * int256(position.size)) / position.entryPrice;
        return pnl;
    }

    function getCurrentPnL(uint256 positionId)
        external
        view
        returns (int256 pnl)
    {
        Position memory position = positions[positionId];
        require(position.isOpen, "Position is closed");

        int256 currentPrice = priceOracle.getLatestValidPrice(position.pair);
        return _calculatePnL(position, currentPrice);
    }

    function getUserPositions(address trader)
        external
        view
        returns (uint256[] memory)
    {
        return userPositions[trader];
    }

    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high");
        platformFee = newFee;
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = collectedFees;
        collectedFees = 0;
        require(
            collateralToken.transfer(owner(), amount),
            "Fee withdrawal failed"
        );
    }
}
