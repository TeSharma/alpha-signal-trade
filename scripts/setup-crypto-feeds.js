// scripts/setup-crypto-feeds.js
// Register Chainlink crypto price feeds in PriceOracleV2
// Run: npx hardhat run scripts/setup-crypto-feeds.js --network amoy

const { ethers } = require("hardhat");

// PriceOracleV2 deployed address
const PRICE_ORACLE_V2 = "0x5D58135A49C5035C5836E682B7A68B0d3d8816fF";

// Chainlink Aggregator addresses on Polygon Amoy testnet
// Only POL/USD is available on Amoy. BTC/USD and ETH/USD activate on mainnet.
const FEEDS = [
  {
    pair: "POL/USD",
    // Confirmed from Polygon/Chainlink docs for Amoy
    aggregator: "0x001382149eBa3441043c1c66972b4772963f5D43",
    decimals: 8
  }
  // Mainnet activation:
  // { pair: "BTC/USD", aggregator: "TBD", decimals: 8 },
  // { pair: "ETH/USD", aggregator: "TBD", decimals: 8 },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up crypto feeds with account:", deployer.address);

  const oracle = await ethers.getContractAt(
    [
      "function setPriceFeed(bytes32 pairId, address feed, uint8 decimals) external",
      "function hasFeed(bytes32 pairId) external view returns (bool)",
      "function getPrice(bytes32 pairId) external view returns (uint256 price, uint256 updatedAt)",
      "function owner() external view returns (address)"
    ],
    PRICE_ORACLE_V2
  );

  // Verify ownership
  const owner = await oracle.owner();
  console.log("Oracle owner:", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: Deployer is not the oracle owner. Cannot set feeds.");
    process.exit(1);
  }

  for (const feed of FEEDS) {
    const pairId = ethers.keccak256(ethers.toUtf8Bytes(feed.pair));
    console.log(`\nRegistering ${feed.pair} (pairId: ${pairId})`);
    console.log(`  Aggregator: ${feed.aggregator}`);
    console.log(`  Decimals: ${feed.decimals}`);

    try {
      const tx = await oracle.setPriceFeed(pairId, feed.aggregator, feed.decimals);
      await tx.wait();
      console.log(`  ✅ Feed registered (tx: ${tx.hash})`);

      // Verify feed
      const hasIt = await oracle.hasFeed(pairId);
      console.log(`  hasFeed: ${hasIt}`);

      if (hasIt) {
        const [price, updatedAt] = await oracle.getPrice(pairId);
        console.log(`  Price: ${ethers.formatUnits(price, feed.decimals)}`);
        console.log(`  Updated: ${new Date(Number(updatedAt) * 1000).toISOString()}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to register ${feed.pair}:`, err.message);
    }
  }

  console.log("\n✅ Crypto feed setup complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
