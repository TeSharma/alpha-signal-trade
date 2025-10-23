const fs = require("fs");
const path = require("path");

const artifactsPath = path.join(__dirname, "artifacts", "src", "contracts");
const outputDir = path.join(__dirname, "frontend", "abi");
const deploymentFile = path.join(__dirname, "deployments", "amoy-deployment.json");
const configFile = path.join(__dirname, "src", "config", "contracts.ts");

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const contracts = ["TokenizedCurrency", "PriceOracle", "TradingPlatform"];

// --- Extract ABIs ---
for (const name of contracts) {
  const artifactFile = path.join(artifactsPath, `${name}.sol`, `${name}.json`);
  if (fs.existsSync(artifactFile)) {
    const artifact = JSON.parse(fs.readFileSync(artifactFile, "utf8"));
    const abiPath = path.join(outputDir, `${name}.json`);
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`✅ ABI extracted for ${name}`);
  } else {
    console.error(`❌ ABI not found for ${name}. Did you run npx hardhat compile?`);
  }
}

// --- Update frontend contract config ---
if (fs.existsSync(deploymentFile)) {
  const deployData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const newContent = `// Auto-generated file. Do not edit manually.

export const CONTRACT_ADDRESSES = {
  amoy: {
    TokenizedCurrency: "${deployData.TokenizedCurrency}",
    PriceOracle: "${deployData.PriceOracle}",
    TradingPlatform: "${deployData.TradingPlatform}",
  },
  // add polygon mainnet addresses later
};
`;

  fs.writeFileSync(configFile, newContent);
  console.log(`📝 Updated frontend config with new addresses in ${configFile}`);
} else {
  console.warn("⚠️ No deployment file found. Skipping address update.");
}

console.log("✅ ABI & address sync complete.");
