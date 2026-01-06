// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracleV2
 * @notice Price oracle using bytes32 pair IDs for TradingPlatformV2 compatibility
 * @dev Uses Chainlink price feeds with keccak256 hashed pair identifiers
 */
contract PriceOracleV2 is Ownable {
    
    // Mapping from bytes32 pairId to Chainlink price feed address
    mapping(bytes32 => address) public priceFeeds;
    
    // Events
    event PriceFeedSet(bytes32 indexed pairId, address feedAddress);
    event PriceFeedRemoved(bytes32 indexed pairId);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set a price feed for a trading pair
     * @param pairId The keccak256 hash of the pair string (e.g., keccak256("EUR/USD"))
     * @param feedAddress The Chainlink aggregator address
     */
    function setPriceFeed(bytes32 pairId, address feedAddress) external onlyOwner {
        require(feedAddress != address(0), "Invalid feed address");
        priceFeeds[pairId] = feedAddress;
        emit PriceFeedSet(pairId, feedAddress);
    }

    /**
     * @notice Set multiple price feeds at once
     * @param pairIds Array of pair IDs
     * @param feedAddresses Array of corresponding feed addresses
     */
    function setPriceFeeds(bytes32[] calldata pairIds, address[] calldata feedAddresses) external onlyOwner {
        require(pairIds.length == feedAddresses.length, "Length mismatch");
        
        for (uint256 i = 0; i < pairIds.length; i++) {
            require(feedAddresses[i] != address(0), "Invalid feed address");
            priceFeeds[pairIds[i]] = feedAddresses[i];
            emit PriceFeedSet(pairIds[i], feedAddresses[i]);
        }
    }

    /**
     * @notice Remove a price feed
     * @param pairId The pair ID to remove
     */
    function removePriceFeed(bytes32 pairId) external onlyOwner {
        delete priceFeeds[pairId];
        emit PriceFeedRemoved(pairId);
    }

    /**
     * @notice Get the current price for a trading pair
     * @param pairId The keccak256 hash of the pair string
     * @return price The current price (8 decimals for most forex pairs)
     * @return updatedAt The timestamp of the last price update
     */
    function getPrice(bytes32 pairId) external view returns (uint256 price, uint256 updatedAt) {
        address feed = priceFeeds[pairId];
        require(feed != address(0), "Feed not set");

        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed);
        
        (
            /* uint80 roundId */,
            int256 answer,
            /* uint256 startedAt */,
            uint256 timestamp,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();

        require(answer > 0, "Invalid price");
        
        return (uint256(answer), timestamp);
    }

    /**
     * @notice Get detailed price data for a trading pair
     * @param pairId The pair ID
     * @return roundId The round ID from Chainlink
     * @return price The current price
     * @return startedAt When the round started
     * @return updatedAt When the price was last updated
     * @return answeredInRound The round in which the answer was computed
     */
    function getPriceData(bytes32 pairId) external view returns (
        uint80 roundId,
        int256 price,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        address feed = priceFeeds[pairId];
        require(feed != address(0), "Feed not set");

        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed);
        return priceFeed.latestRoundData();
    }

    /**
     * @notice Get the decimals for a price feed
     * @param pairId The pair ID
     * @return The number of decimals
     */
    function getDecimals(bytes32 pairId) external view returns (uint8) {
        address feed = priceFeeds[pairId];
        require(feed != address(0), "Feed not set");
        
        return AggregatorV3Interface(feed).decimals();
    }

    /**
     * @notice Check if a price feed is configured
     * @param pairId The pair ID to check
     * @return True if the feed is set
     */
    function hasFeed(bytes32 pairId) external view returns (bool) {
        return priceFeeds[pairId] != address(0);
    }

    /**
     * @notice Helper to compute pair ID from string
     * @param pair The pair string (e.g., "EUR/USD")
     * @return The keccak256 hash
     */
    function computePairId(string calldata pair) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(pair));
    }
}
