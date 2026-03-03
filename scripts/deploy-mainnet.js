const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Native USDC on Polygon Mainnet (6 decimals)
const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

// Chainlink Price Feeds on Polygon Mainnet (all 8 decimals)
const MAINNET_PRICE_FEEDS = {
  "BTC/USD": "0xc907E116054Ad103354f2D350FD2514433D57F6f",
  "ETH/USD": "0xF9680D99D6C9589e2a93a78A04A279e509205945",
  "POL/USD": "0xAB594600376Ec9fD91F8e8dC3ef219F1735Db534",
};

function computePairId(pair) {
  return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(pair));
}

async function main() {
  console.log("\n🚀 Polygon Mainnet Deployment — PriceOracleV2 + TradingPlatformV2\n");

  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  if (Number(chainId) !== 137) {
    throw new Error(`Expected Polygon Mainnet (137), got chain ${chainId}. Use --network polygon`);
  }
  console.log(`📍 Network: ${network} (Chain ID: ${chainId})`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} POL\n`);

  // ── 1. Deploy PriceOracleV2 ──
  console.log("📊 Deploying PriceOracleV2...");
  const PriceOracleV2 = await hre.ethers.getContractFactory("PriceOracleV2");
  const oracle = await PriceOracleV2.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log(`✅ PriceOracleV2: ${oracleAddress}\n`);

  // ── 2. Register Chainlink feeds ──
  console.log("🔧 Registering Chainlink feeds...");
  const pairIds = [];
  const feedAddresses = [];

  for (const [pair, feed] of Object.entries(MAINNET_PRICE_FEEDS)) {
    const pairId = computePairId(pair);
    pairIds.push(pairId);
    feedAddresses.push(feed);
    console.log(`  ${pair}: ${pairId.slice(0, 18)}... → ${feed}`);
  }

  const tx = await oracle.setPriceFeeds(pairIds, feedAddresses);
  await tx.wait();
  console.log(`✅ ${pairIds.length} feeds registered\n`);

  // ── 3. Verify feeds return valid prices ──
  console.log("📈 Verifying feed prices...");
  for (const [pair, feed] of Object.entries(MAINNET_PRICE_FEEDS)) {
    try {
      const pairId = computePairId(pair);
      const [price, updatedAt] = await oracle.getPrice(pairId);
      const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
      console.log(`  ✅ ${pair}: $${(Number(price) / 1e8).toFixed(pair === "POL/USD" ? 4 : 2)} (${age}s ago)`);
    } catch (e) {
      console.log(`  ❌ ${pair}: ${e.message}`);
    }
  }
  console.log();

  // ── 4. Deploy TradingPlatformV2 with USDC collateral ──
  console.log("💹 Deploying TradingPlatformV2...");
  console.log(`  Collateral: USDC (${USDC_ADDRESS})`);
  console.log(`  Oracle:     ${oracleAddress}`);

  const TradingPlatformV2 = await hre.ethers.getContractFactory(
    "src/contracts/TradingPlatformV2.sol:TradingPlatformV2"
  );
  const platform = await TradingPlatformV2.deploy(oracleAddress, USDC_ADDRESS);
  await platform.waitForDeployment();
  const platformAddress = await platform.getAddress();
  console.log(`✅ TradingPlatformV2: ${platformAddress}\n`);

  // ── 5. Verify config ──
  const treasury = await platform.treasury();
  const openFeeBps = await platform.openFeeBps();
  const closeFeeBps = await platform.closeFeeBps();
  console.log(`💰 Treasury: ${treasury}`);
  console.log(`   Open fee: ${Number(openFeeBps) / 100}%  |  Close fee: ${Number(closeFeeBps) / 100}%\n`);

  // ── 6. Save deployment JSON ──
  const deploymentData = {
    network: "polygon",
    chainId: 137,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PriceOracleV2: oracleAddress,
      TradingPlatformV2: platformAddress,
      CollateralToken: USDC_ADDRESS,
    },
    chainlinkFeeds: MAINNET_PRICE_FEEDS,
    pairIds: Object.fromEntries(
      Object.keys(MAINNET_PRICE_FEEDS).map(p => [p, computePairId(p)])
    ),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const outFile = path.join(deploymentsDir, "polygon-deployment.json");
  fs.writeFileSync(outFile, JSON.stringify(deploymentData, null, 2));
  console.log(`📝 Saved: ${outFile}`);

  // ── 7. Auto-update src/config/contracts.ts ──
  const configPath = path.join(__dirname, "..", "src", "config", "contracts.ts");
  if (fs.existsSync(configPath)) {
    let cfg = fs.readFileSync(configPath, "utf8");

    // Replace polygon PriceOracleV2 and TradingPlatformV2 addresses
    // The file has polygon: { ... PriceOracleV2: "", TradingPlatformV2: "" ... }
    cfg = cfg.replace(
      /(polygon:\s*\{[^}]*PriceOracleV2:\s*)"[^"]*"/,
      `$1"${oracleAddress}"`
    );
    cfg = cfg.replace(
      /(polygon:\s*\{[^}]*TradingPlatformV2:\s*)"[^"]*"/,
      `$1"${platformAddress}"`
    );

    fs.writeFileSync(configPath, cfg);
    console.log(`📝 Updated: src/config/contracts.ts (polygon addresses)\n`);
  }

  console.log("🎉 Mainnet deployment complete!\n");
  console.log("📋 Summary:");
  console.log(`  PriceOracleV2:     ${oracleAddress}`);
  console.log(`  TradingPlatformV2: ${platformAddress}`);
  console.log(`  Collateral (USDC): ${USDC_ADDRESS}`);
  console.log(`  Treasury:          ${treasury}`);
  console.log("\n🧪 Next Steps:");
  console.log("  1. Verify contracts on Polygonscan (optional)");
  console.log("  2. Switch app to Live mode — oracle should show green");
  console.log("  3. Approve USDC spend and open a test position");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
