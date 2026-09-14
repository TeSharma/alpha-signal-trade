// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockPriceOracleV2
 * @notice Mock price oracle for testing TradingPlatformV2
 */
contract MockPriceOracleV2 {
    mapping(bytes32 => uint256) public prices;
    mapping(bytes32 => uint256) public timestamps;

    function setPrice(bytes32 pairId, uint256 price) external {
        prices[pairId] = price;
        timestamps[pairId] = block.timestamp;
    }

    /// @notice Test helper: set a price with an explicit update timestamp (staleness tests)
    function setPriceAt(bytes32 pairId, uint256 price, uint256 updatedAt) external {
        prices[pairId] = price;
        timestamps[pairId] = updatedAt;
    }

    function getPrice(bytes32 pairId) external view returns (uint256 price, uint256 updatedAt) {
        require(prices[pairId] > 0, "Price not set");
        return (prices[pairId], timestamps[pairId]);
    }
}
