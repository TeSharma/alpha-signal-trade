// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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
    
    // Collateral token (e.g., USDT or tUSD)
    IERC20 public collateralToken;
    
    // Platform fee (in basis points, e.g., 30 = 0.3%)
    uint256 public platformFee = 30;
    
    // Maximum leverage allowed (e.g., 100 = 100x)
    uint256 public maxLeverage = 100;
    
    // Minimum collateral required (in collateral token's smallest unit)
    uint256 public minCollateral = 10 * 10**6; // 10 USDT (assuming 6 decimals)
    
    struct Position {
        address trader;
        string pair;
        bool isLong; // true = buy, false = sell
        uint256 collateral;
        uint256 leverage;
        uint256 size; // Position size in base currency
        int256 entryPrice;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 openedAt;
        bool isOpen;
    }
    
    // Mapping: positionId => Position
    mapping(uint256 => Position) public positions;
    
    // Mapping: trader => positionIds[]
    mapping(address => uint256[]) public userPositions;
    
    // Position counter
    uint256 public nextPositionId = 1;
    
    // Collected fees
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
    
    constructor(address _priceOracle, address _collateralToken) {
        require(_priceOracle != address(0), "Invalid oracle address");
        require(_collateralToken != address(0), "Invalid collateral token");
        
        priceOracle = PriceOracle(_priceOracle);
        collateralToken = IERC20(_collateralToken);
    }
    
    /**
     * @dev Open a new trading position
     * @param pair Currency pair (e.g., "EUR/USD")
     * @param isLong True for buy, false for sell
     * @param collateralAmount Amount of collateral to lock
     * @param leverage Leverage multiplier (1-100)
     * @param stopLoss Stop loss price (0 = no stop loss)
     * @param takeProfit Take profit price (0 = no take profit)
     */
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
        
        // Get current price from oracle
        int256 currentPrice = priceOracle.getLatestValidPrice(pair);
        require(currentPrice > 0, "Invalid price");
        
        // Transfer collateral from trader
        require(
            collateralToken.transferFrom(msg.sender, address(this), collateralAmount),
            "Collateral transfer failed"
        );
        
        // Calculate position size
        uint256 positionSize = collateralAmount * leverage;
        
        // Create position
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
    
    /**
     * @dev Close a trading position
     * @param positionId ID of the position to close
     */
    function closePosition(uint256 positionId) external nonReentrant {
        Position storage position = positions[positionId];
        
        require(position.isOpen, "Position is not open");
        require(position.trader == msg.sender, "Not position owner");
        
        // Get current price
        int256 exitPrice = priceOracle.getLatestValidPrice(position.pair);
        require(exitPrice > 0, "Invalid exit price");
        
        // Calculate PnL
        int256 pnl = _calculatePnL(position, exitPrice);
        
        // Close position
        position.isOpen = false;
        
        // Calculate amount to return (collateral + pnl - fees)
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
    
    /**
     * @dev Calculate profit/loss for a position
     * @param position Position struct
     * @param currentPrice Current market price
     * @return pnl Profit or loss (can be negative)
     */
    function _calculatePnL(Position memory position, int256 currentPrice) 
        internal 
        pure 
        returns (int256 pnl) 
    {
        int256 priceDiff = currentPrice - position.entryPrice;
        
        if (!position.isLong) {
            priceDiff = -priceDiff; // Inverse for short positions
        }
        
        // PnL = (price difference / entry price) * position size
        pnl = (priceDiff * int256(position.size)) / position.entryPrice;
        
        return pnl;
    }
    
    /**
     * @dev Get current PnL for an open position
     * @param positionId Position ID
     * @return pnl Current profit/loss
     */
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
    
    /**
     * @dev Get all positions for a trader
     * @param trader Trader address
     * @return positionIds Array of position IDs
     */
    function getUserPositions(address trader) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userPositions[trader];
    }
    
    /**
     * @dev Update platform fee (only owner)
     * @param newFee New fee in basis points
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 500, "Fee too high"); // Max 5%
        platformFee = newFee;
    }
    
    /**
     * @dev Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = collectedFees;
        collectedFees = 0;
        require(
            collateralToken.transfer(owner(), amount),
            "Fee withdrawal failed"
        );
    }
}
