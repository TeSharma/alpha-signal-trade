const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Existing tUSD token address from previous deployment
const TUSD_ADDRESS = "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164";

// Chainlink Price Feeds on Polygon Amoy
const AMOY_PRICE_FEEDS = {
  "EUR/USD": "0x7d7356bF6Ee5CDeC22B216581E48eCC700D0497A",
  "GBP/USD": "0x099a2540848573e94fb1Ca0Fa420b00acbBc845a",
  "USD/JPY": "0xD647a6fC9BC6402301583C91decC5989d8Bc382D",
  "AUD/USD": "0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f",
  "USD/CAD": "0xACA44ABb8B04D07D883202F99FA5E3c53ed57Fb5",
  "USD/CHF": "0xc76f762CedF0F78a439727861628E0fdfE1e70c2",
  "NZD/USD": "0xa302a0B8a499fD0f00449df0a490DedE21105955",
};

// Helper to compute pair ID (keccak256 hash)
function computePairId(pair) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(pair));
}

async function main() {
  console.log("\n🚀 Starting TradingPlatformV2 deployment with Revenue Model...\n");

  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log(`📍 Network: ${network} (Chain ID: ${chainId})`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} MATIC\n`);

  // Deploy PriceOracleV2
  console.log("📊 Deploying PriceOracleV2...");
  const PriceOracleV2 = await hre.ethers.getContractFactory("PriceOracleV2");
  const oracleV2 = await PriceOracleV2.deploy();
  await oracleV2.waitForDeployment();
  const oracleV2Address = await oracleV2.getAddress();
  console.log(`✅ PriceOracleV2 deployed at: ${oracleV2Address}\n`);

  // Configure price feeds with bytes32 pair IDs
  console.log("🔧 Configuring PriceOracleV2 with Chainlink feeds...");
  
  const pairIds = [];
  const feedAddresses = [];
  
  for (const [pair, feed] of Object.entries(AMOY_PRICE_FEEDS)) {
    const pairId = computePairId(pair);
    pairIds.push(pairId);
    feedAddresses.push(feed);
    console.log(`  ${pair}: ${pairId.slice(0, 18)}... -> ${feed}`);
  }

  const setFeedsTx = await oracleV2.setPriceFeeds(pairIds, feedAddresses);
  await setFeedsTx.wait();
  console.log(`✅ Configured ${pairIds.length} price feeds\n`);

  // Deploy TradingPlatformV2 with Revenue Model
  console.log("💹 Deploying TradingPlatformV2 with Revenue Model...");
  console.log(`  Using tUSD: ${TUSD_ADDRESS}`);
  console.log(`  Using Oracle: ${oracleV2Address}`);
  console.log(`  Treasury will be set to: ${deployer.address}`);
  
  const TradingPlatformV2 = await hre.ethers.getContractFactory("src/contracts/TradingPlatformV2.sol:TradingPlatformV2");
  const platformV2 = await TradingPlatformV2.deploy(oracleV2Address, TUSD_ADDRESS);
  await platformV2.waitForDeployment();
  const platformV2Address = await platformV2.getAddress();
  console.log(`✅ TradingPlatformV2 deployed at: ${platformV2Address}\n`);

  // Verify configuration
  console.log("🔍 Verifying deployment...");
  const configuredOracle = await platformV2.oracle();
  const configuredCollateral = await platformV2.collateralToken();
  const maxLeverage = await platformV2.maxLeverage();
  const maintenanceMarginBps = await platformV2.maintenanceMarginBps();
  const maxProfitBps = await platformV2.maxProfitBps();
  
  // Verify fee configuration
  const treasury = await platformV2.treasury();
  const openFeeBps = await platformV2.openFeeBps();
  const closeFeeBps = await platformV2.closeFeeBps();
  const liquidatorRewardBps = await platformV2.liquidatorRewardBps();

  console.log(`  Oracle: ${configuredOracle}`);
  console.log(`  Collateral Token: ${configuredCollateral}`);
  console.log(`  Max Leverage: ${maxLeverage}x`);
  console.log(`  Maintenance Margin: ${Number(maintenanceMarginBps) / 100}%`);
  console.log(`  Max Profit Cap: ${Number(maxProfitBps) / 100}%`);
  console.log(`\n💰 Fee Configuration:`);
  console.log(`  Treasury: ${treasury}`);
  console.log(`  Open Fee: ${Number(openFeeBps) / 100}%`);
  console.log(`  Close Fee: ${Number(closeFeeBps) / 100}%`);
  console.log(`  Liquidator Reward: ${Number(liquidatorRewardBps) / 100}%\n`);

  // Test a price fetch
  console.log("📈 Testing price feeds...");
  try {
    const eurUsdPairId = computePairId("EUR/USD");
    const [price, updatedAt] = await oracleV2.getPrice(eurUsdPairId);
    const priceAge = Math.floor(Date.now() / 1000) - Number(updatedAt);
    console.log(`  EUR/USD Price: ${Number(price) / 1e8} (${priceAge}s ago)\n`);
  } catch (error) {
    console.log(`  ⚠️ Price fetch test failed: ${error.message}\n`);
  }

  // Save deployment data
  const deploymentData = {
    network,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PriceOracleV2: oracleV2Address,
      TradingPlatformV2: platformV2Address,
      CollateralToken: TUSD_ADDRESS,
    },
    pairIds: Object.fromEntries(
      Object.keys(AMOY_PRICE_FEEDS).map(pair => [pair, computePairId(pair)])
    ),
    configuration: {
      maxLeverage: Number(maxLeverage),
      maintenanceMarginBps: Number(maintenanceMarginBps),
      maxProfitBps: Number(maxProfitBps),
    },
    feeConfiguration: {
      treasury: treasury,
      openFeeBps: Number(openFeeBps),
      closeFeeBps: Number(closeFeeBps),
      liquidatorRewardBps: Number(liquidatorRewardBps),
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `amoy-v2-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log(`📝 Deployment data saved to: ${deploymentFile}`);

  // Update frontend config
  const configPath = path.join(__dirname, "..", "src", "config", "contracts.ts");
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, "utf8");
    
    // Update V2 addresses
    configContent = configContent.replace(
      /PriceOracleV2: "[^"]*"/,
      `PriceOracleV2: "${oracleV2Address}"`
    );
    configContent = configContent.replace(
      /TradingPlatformV2: "[^"]*"/,
      `TradingPlatformV2: "${platformV2Address}"`
    );
    
    fs.writeFileSync(configPath, configContent);
    console.log(`📝 Updated frontend config with V2 addresses`);
  }

  // Extract ABIs for frontend
  console.log("\n📦 Extracting ABIs for frontend...");
  const frontendAbiDir = path.join(__dirname, "..", "frontend", "abi");
  if (!fs.existsSync(frontendAbiDir)) {
    fs.mkdirSync(frontendAbiDir, { recursive: true });
  }

  const artifactsToExtract = [
    { name: "PriceOracleV2", path: "src/contracts/PriceOracleV2.sol/PriceOracleV2.json" },
    { name: "TradingPlatformV2", path: "src/contracts/TradingPlatformV2.sol/TradingPlatformV2.json" },
  ];

  for (const artifact of artifactsToExtract) {
    const artifactPath = path.join(__dirname, "..", "artifacts", artifact.path);
    if (fs.existsSync(artifactPath)) {
      const artifactData = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const abiPath = path.join(frontendAbiDir, `${artifact.name}.json`);
      fs.writeFileSync(abiPath, JSON.stringify(artifactData.abi, null, 2));
      console.log(`  ✅ ${artifact.name}.json`);
    }
  }

  console.log("\n🎉 TradingPlatformV2 deployment with Revenue Model completed!");
  console.log("\n📋 Summary:");
  console.log(`  PriceOracleV2:      ${oracleV2Address}`);
  console.log(`  TradingPlatformV2:  ${platformV2Address}`);
  console.log(`  Collateral (tUSD):  ${TUSD_ADDRESS}`);
  console.log(`  Treasury:           ${treasury}`);
  
  console.log("\n💰 Fee Structure:");
  console.log("  ┌─────────────────────┬─────────┬───────────────────┐");
  console.log("  │ Fee Type            │ Rate    │ Recipient         │");
  console.log("  ├─────────────────────┼─────────┼───────────────────┤");
  console.log("  │ Open Fee            │ 0.08%   │ Treasury          │");
  console.log("  │ Close Fee (profits) │ 0.08%   │ Treasury          │");
  console.log("  │ Liquidation         │ 70%     │ Treasury          │");
  console.log("  │ Liquidator Reward   │ 30%     │ Liquidator        │");
  console.log("  └─────────────────────┴─────────┴───────────────────┘");
  
  console.log("\n🧪 Next Steps:");
  console.log("  1. Run unit tests: npx hardhat test test/TradingPlatformV2.test.js");
  console.log("  2. Mint tUSD tokens for testing");
  console.log("  3. Approve TradingPlatformV2 to spend tUSD");
  console.log("  4. Open a test position");
  console.log("  5. (Optional) Set a different treasury: setTreasury(newAddress)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
