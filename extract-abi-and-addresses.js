const fs = require("fs");
const path = require("path");

const artifactsPath = path.join(__dirname, "artifacts", "src", "contracts");
const outputDir = path.join(__dirname, "frontend", "abi");

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Include both V1 and V2 contracts
const contracts = [
  "TokenizedCurrency",
  "PriceOracle",
  "TradingPlatform",
  "PriceOracleV2",
  "TradingPlatformV2",
  "TUSDFaucet"
];

// --- Extract ABIs only ---
for (const name of contracts) {
  const artifactFile = path.join(artifactsPath, `${name}.sol`, `${name}.json`);
  if (fs.existsSync(artifactFile)) {
    const artifact = JSON.parse(fs.readFileSync(artifactFile, "utf8"));
    const abiPath = path.join(outputDir, `${name}.json`);
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`✅ ABI extracted for ${name}`);
  } else {
    console.warn(`⚠️ ABI not found for ${name} (skipping)`);
  }
}

console.log("\n✅ ABI extraction complete.");
console.log("ℹ️  Contract addresses are managed in src/config/contracts.ts");
console.log("ℹ️  Use deploy-v2.js or manually update addresses after deployment.");
