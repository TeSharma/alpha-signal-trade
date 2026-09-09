// Standalone mainnet deployment resume — no hardhat, pure ethers.
// Reads ABI/bytecode from artifacts/, signer from .env, RPC from POLYGON_RPC_URL.
// Run: node scripts/resume-mainnet-standalone.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ORACLE_ADDRESS = "0xf61e4881f363b30384dfbcf1c72845cce94d4f9f";
const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const MAINNET_PRICE_FEEDS = {
  "BTC/USD": "0xc907E116054Ad103354f2D350FD2514433D57F6f",
  "ETH/USD": "0xF9680D99D6C9589e2a93a78A04A279e509205945",
  "POL/USD": "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
};
const ORACLE_DEPLOY_TX = "0xe0585c935473efaec742700db6891a49836baafe06c690d2ac4d6814bf6d7cc1";
const LOG = (m) => console.log(new Date().toISOString().slice(11, 19), m);
const crashLog = (tag, e) => {
  try {
    fs.appendFileSync(path.join(__dirname, "..", "deploy-log.txt"),
      "\n" + tag + ": " + (e && e.stack ? e.stack : String(e)));
  } catch (_) {}
  process.exit(99);
};
process.on("uncaughtException", (e) => crashLog("UNCAUGHT", e));
process.on("unhandledRejection", (e) => crashLog("UNHANDLED", e));

function computePairId(pair) {
  return ethers.keccak256(ethers.toUtf8Bytes(pair));
}

async function main() {
  const rpc = process.env.POLYGON_RPC_URL;
  if (!rpc) throw new Error("POLYGON_RPC_URL missing in .env");
  const provider = new ethers.JsonRpcProvider(rpc, 137, { staticNetwork: true });

  let key = (process.env.PRIVATE_KEY || "").trim();
  if (!key) throw new Error("PRIVATE_KEY missing in .env");
  if (!key.startsWith("0x")) key = "0x" + key;
  const wallet = new ethers.Wallet(key, provider);

  LOG("Deployer: " + wallet.address);
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== 137) throw new Error("Wrong chain: " + net.chainId);
  LOG("Chain 137 (Polygon Mainnet) OK");
  const balance = await provider.getBalance(wallet.address);
  LOG("Balance: " + ethers.formatEther(balance) + " POL");

  const oracleArtifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "artifacts", "src", "contracts", "PriceOracleV2.sol", "PriceOracleV2.json"), "utf8"));
  const platformArtifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "artifacts", "src", "contracts", "TradingPlatformV2.sol", "TradingPlatformV2.json"), "utf8"));

  // ── 1. Attach to the existing PriceOracleV2 ──
  const code = await provider.getCode(ORACLE_ADDRESS);
  if (code === "0x") throw new Error("No contract code at " + ORACLE_ADDRESS);
  const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleArtifact.abi, wallet);
  LOG("Oracle attached at " + ORACLE_ADDRESS + " (" + (code.length - 2) / 2 + " bytes)");

  // ── 2. Register Chainlink feeds ──
  const pairs = Object.keys(MAINNET_PRICE_FEEDS);
  const pairIds = pairs.map(computePairId);
  const feeds = pairs.map((p) => MAINNET_PRICE_FEEDS[p]);
  LOG("Sending setPriceFeeds for " + pairs.join(", ") + " ...");
  const tx1 = await oracle.setPriceFeeds(pairIds, feeds);
  LOG("setPriceFeeds tx: " + tx1.hash);
  await tx1.wait();
  LOG("Feeds registered");

  // ── 3. Verify feed prices ──
  for (const p of pairs) {
    const [price, updated] = await oracle.getPrice(computePairId(p));
    const age = Math.floor(Date.now() / 1000) - Number(updated);
    LOG(p + ": $" + (Number(price) / 1e8).toFixed(p === "POL/USD" ? 4 : 2) + " (" + age + "s ago)");
  }

  // ── 4. Deploy TradingPlatformV2 with USDC collateral ──
  LOG("Deploying TradingPlatformV2 (collateral USDC) ...");
  const factory = new ethers.ContractFactory(platformArtifact.abi, platformArtifact.bytecode, wallet);
  const platform = await factory.deploy(ORACLE_ADDRESS, USDC_ADDRESS);
  LOG("platform deploy tx: " + platform.deploymentTransaction().hash);
  await platform.waitForDeployment();
  const platformAddress = await platform.getAddress();
  LOG("TradingPlatformV2: " + platformAddress);

  // ── 5. Read back config ──
  const treasury = await platform.treasury();
  const openFeeBps = await platform.openFeeBps();
  const closeFeeBps = await platform.closeFeeBps();
  LOG("Treasury: " + treasury + " | open fee " + Number(openFeeBps) / 100 + "% | close fee " + Number(closeFeeBps) / 100 + "%");

  // ── 6. Save deployment JSON ──
  const deploymentData = {
    network: "polygon",
    chainId: 137,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address,
    resumed: true,
    contracts: {
      PriceOracleV2: ORACLE_ADDRESS,
      TradingPlatformV2: platformAddress,
      CollateralToken: USDC_ADDRESS,
    },
    oracleDeploymentTx: ORACLE_DEPLOY_TX,
    chainlinkFeeds: MAINNET_PRICE_FEEDS,
    pairIds: Object.fromEntries(pairs.map((p) => [p, computePairId(p)])),
  };
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
  const outFile = path.join(deploymentsDir, "polygon-deployment.json");
  fs.writeFileSync(outFile, JSON.stringify(deploymentData, null, 2));
  LOG("Saved: " + outFile);

  // ── 7. Auto-update src/config/contracts.ts ──
  const configPath = path.join(__dirname, "..", "src", "config", "contracts.ts");
  if (fs.existsSync(configPath)) {
    let cfg = fs.readFileSync(configPath, "utf8");
    cfg = cfg.replace(/(polygon:\s*\{[^}]*PriceOracleV2:\s*)"[^"]*"/, `$1"${ORACLE_ADDRESS}"`);
    cfg = cfg.replace(/(polygon:\s*\{[^}]*TradingPlatformV2:\s*)"[^"]*"/, `$1"${platformAddress}"`);
    fs.writeFileSync(configPath, cfg);
    LOG("Updated: src/config/contracts.ts (polygon addresses)");
  }

  LOG("🎉 MAINNET DEPLOYMENT COMPLETE");
  LOG("PriceOracleV2:     " + ORACLE_ADDRESS);
  LOG("TradingPlatformV2: " + platformAddress);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Deployment failed:", e && e.message ? e.message : e);
    crashLog("FAILED", e);
  });
