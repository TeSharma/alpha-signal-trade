// Resumes the mainnet deployment that stopped after PriceOracleV2 was created.
// Run: npx hardhat run scripts/resume-mainnet.js --network polygon
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Oracle already live on mainnet from the 2026-09-09 04:25 attempt
// (creation tx 0xe0585c935473efaec742700db6891a49836baafe06c690d2ac4d6814bf6d7cc1)
const ORACLE_ADDRESS = "0xf61e4881f363b30384dfbcf1c72845cce94d4f9f";

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
  console.log("\n🔁 Resuming Polygon Mainnet Deployment — reusing existing PriceOracleV2\n");

  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  if (Number(chainId) !== 137) {
    throw new Error(`Expected Polygon Mainnet (137), got chain ${chainId}. Use --network polygon`);
  }
  console.log(`📍 Network: ${network} (Chain ID: ${chainId})`);

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No signer available — check PRIVATE_KEY in .env");
  }
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} POL\n`);

  // ── 1. Attach to the existing PriceOracleV2 ──
  console.log(`📊 Attaching to existing PriceOracleV2 at ${ORACLE_ADDRESS}...`);
  const oracle = await hre.ethers.getContractAt("PriceOracleV2", ORACLE_ADDRESS);

  const code = await hre.ethers.provider.getCode(ORACLE_ADDRESS);
  if (code === "0x") {
    throw new Error(`No contract code at ${ORACLE_ADDRESS} — aborting`);
  }
  console.log(`✅ Oracle attached (${(code.length - 2) / 2} bytes of code)\n`);

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
  console.log(`  ⏳ setPriceFeeds tx: ${tx.hash}`);
  await tx.wait();
  console.log(`✅ ${pairIds.length} feeds registered\n`);

  // ── 3. Verify feeds return valid prices ──
  console.log("📈 Verifying feed prices...");
  for (const [pair] of Object.entries(MAINNET_PRICE_FEEDS)) {
    try {
      const pairId = computePairId(pair);
      const [price, updatedAt] = await oracle.getPrice(pairId);
      const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
      console.log(`  ✅ ${pair}: $${(Number(price) / 1e8).toFixed(pair === "POL/USD" ? 4 : 2)} (${age}s ago)`);
    } catch (e) {
      console.log(`  ❌ ${pair}: ${e.message.split("\n")[0]}`);
    }
  }
  console.log();

  // ── 4. Deploy TradingPlatformV2 with USDC collateral ──
  console.log("💹 Deploying TradingPlatformV2...");
  console.log(`  Collateral: USDC (${USDC_ADDRESS})`);
  console.log(`  Oracle:     ${ORACLE_ADDRESS}`);

  const TradingPlatformV2 = await hre.ethers.getContractFactory(
    "src/contracts/TradingPlatformV2.sol:TradingPlatformV2"
  );
  const platform = await TradingPlatformV2.deploy(ORACLE_ADDRESS, USDC_ADDRESS);
  console.log(`  ⏳ deploy tx: ${platform.deploymentTransaction()?.hash}`);
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
    resumed: true,
    contracts: {
      PriceOracleV2: ORACLE_ADDRESS,
      TradingPlatformV2: platformAddress,
      CollateralToken: USDC_ADDRESS,
    },
    oracleDeploymentTx: "0xe0585c935473efaec742700db6891a49836baafe06c690d2ac4d6814bf6d7cc1",
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

    cfg = cfg.replace(
      /(polygon:\s*\{[^}]*PriceOracleV2:\s*)"[^"]*"/,
      `$1"${ORACLE_ADDRESS}"`
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
  console.log(`  PriceOracleV2:     ${ORACLE_ADDRESS}  (reused from earlier attempt)`);
  console.log(`  TradingPlatformV2: ${platformAddress}`);
  console.log(`  Collateral (USDC): ${USDC_ADDRESS}`);
  console.log(`  Treasury:          ${treasury}`);
  console.log("\n🧪 Next Steps:");
  console.log("  1. Verify contracts on Polygonscan:");
  console.log(`     npx hardhat verify --network polygon ${ORACLE_ADDRESS}`);
  console.log(`     npx hardhat verify --network polygon ${platformAddress} ${ORACLE_ADDRESS} ${USDC_ADDRESS}`);
  console.log("  2. Switch app to Live mode — oracle should show green");
  console.log("  3. Approve USDC spend and open a test position");
}
