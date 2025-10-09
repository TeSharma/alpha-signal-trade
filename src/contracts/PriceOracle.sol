// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @dev Aggregates price data from Chainlink oracles for forex pairs
 * Provides fallback mechanisms and staleness checks
 */
contract PriceOracle is Ownable {
    // Mapping: currency pair => Chainlink oracle address
    mapping(string => address) public priceFeeds;
    
    // Maximum allowed staleness for price data (in seconds)
    uint256 public maxStaleness = 3600; // 1 hour
    
    // Minimum confidence threshold (can be used for additional validation)
    uint256 public minConfidence = 95; // 95%
    
    event PriceFeedUpdated(string indexed pair, address feedAddress);
    event PriceRequested(string indexed pair, int256 price, uint256 timestamp);
    event MaxStalenessUpdated(uint256 oldValue, uint256 newValue);
    
    struct PriceData {
        int256 price;
        uint256 timestamp;
        uint80 roundId;
        bool isValid;
    }
    
    constructor() {}
    
    /**
     * @dev Set Chainlink price feed for a currency pair
     * @param pair Currency pair (e.g., "EUR/USD")
     * @param feedAddress Chainlink aggregator address
     */
    function setPriceFeed(string memory pair, address feedAddress) 
        external 
        onlyOwner 
    {
        require(feedAddress != address(0), "Invalid feed address");
        priceFeeds[pair] = feedAddress;
        emit PriceFeedUpdated(pair, feedAddress);
    }
    
    /**
     * @dev Update maximum allowed staleness
     * @param newMaxStaleness New staleness threshold in seconds
     */
    function setMaxStaleness(uint256 newMaxStaleness) 
        external 
        onlyOwner 
    {
        require(newMaxStaleness > 0, "Staleness must be greater than 0");
        uint256 oldValue = maxStaleness;
        maxStaleness = newMaxStaleness;
        emit MaxStalenessUpdated(oldValue, newMaxStaleness);
    }
    
    /**
     * @dev Get latest price for a currency pair
     * @param pair Currency pair (e.g., "EUR/USD")
     * @return PriceData struct with price and metadata
     */
    function getLatestPrice(string memory pair) 
        public 
        view 
        returns (PriceData memory) 
    {
        address feedAddress = priceFeeds[pair];
        require(feedAddress != address(0), "Price feed not set for this pair");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feedAddress);
        
        try priceFeed.latestRoundData() returns (
            uint80 roundId,
            int256 price,
            uint256 /* startedAt */,
            uint256 updatedAt,
            uint80 /* answeredInRound */
        ) {
            // Check if price data is stale
            bool isValid = (block.timestamp - updatedAt) <= maxStaleness;
            
            return PriceData({
                price: price,
                timestamp: updatedAt,
                roundId: roundId,
                isValid: isValid
            });
        } catch {
            // Return invalid price data if oracle call fails
            return PriceData({
                price: 0,
                timestamp: 0,
                roundId: 0,
                isValid: false
            });
        }
    }
    
    /**
     * @dev Get latest valid price or revert
     * @param pair Currency pair
     * @return price Latest price (scaled by oracle decimals)
     */
    function getLatestValidPrice(string memory pair) 
        external 
        view 
        returns (int256 price) 
    {
        PriceData memory priceData = getLatestPrice(pair);
        require(priceData.isValid, "Price data is stale or invalid");
        require(priceData.price > 0, "Invalid price");
        
        return priceData.price;
    }
    
    /**
     * @dev Get decimals for a price feed
     * @param pair Currency pair
     * @return decimals Number of decimals
     */
    function getDecimals(string memory pair) 
        external 
        view 
        returns (uint8) 
    {
        address feedAddress = priceFeeds[pair];
        require(feedAddress != address(0), "Price feed not set");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feedAddress);
        return priceFeed.decimals();
    }
    
    /**
     * @dev Check if price feed exists for a pair
     * @param pair Currency pair
     * @return bool True if feed exists
     */
    function hasPriceFeed(string memory pair) 
        external 
        view 
        returns (bool) 
    {
        return priceFeeds[pair] != address(0);
    }
    
    /**
     * @dev Calculate exchange rate between two currencies
     * @param baseCurrency Base currency (e.g., "USD")
     * @param quoteCurrency Quote currency (e.g., "EUR")
     * @return rate Exchange rate (scaled)
     */
    function getExchangeRate(string memory baseCurrency, string memory quoteCurrency) 
        external 
        view 
        returns (int256 rate) 
    {
        // First try direct pair
        string memory directPair = string(abi.encodePacked(baseCurrency, "/", quoteCurrency));
        if (priceFeeds[directPair] != address(0)) {
            PriceData memory priceData = getLatestPrice(directPair);
            require(priceData.isValid, "Price data is stale");
            return priceData.price;
        }
        
        // Try inverse pair
        string memory inversePair = string(abi.encodePacked(quoteCurrency, "/", baseCurrency));
        if (priceFeeds[inversePair] != address(0)) {
            PriceData memory priceData = getLatestPrice(inversePair);
            require(priceData.isValid, "Price data is stale");
            require(priceData.price > 0, "Invalid price");
            
            // Calculate inverse (1 / price) with proper scaling
            return int256(10**16) / priceData.price; // Assuming 8 decimals
        }
        
        revert("No price feed available for this pair");
    }
}
