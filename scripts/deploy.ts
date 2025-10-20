import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Starting deployment process...\n");

  const network = await hre.ethers.provider.getNetwork();
  console.log(`📍 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // ✅ Get signer (deployer)
  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error("No signers found. Check your Hardhat config or private key setup.");
  }

  const deployer = signers[0];
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`👤 Deployer address: ${deployer.address}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} MATIC\n`);

    // 🧱 Deploy TokenizedCurrency
console.log("📦 Deploying TokenizedCurrency...");
const TokenizedCurrency = await hre.ethers.getContractFactory("TokenizedCurrency");
const tokenizedCurrency = await TokenizedCurrency.deploy("Tokenized USD", "tUSD", 6);
await tokenizedCurrency.waitForDeployment();
const tokenAddress = await tokenizedCurrency.getAddress();
console.log(`✅ TokenizedCurrency deployed at: ${tokenAddress}\n`);


  // 🧱 Deploy PriceOracle
  console.log("📊 Deploying PriceOracle...");
  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  const oracleAddress = await priceOracle.getAddress();
  console.log(`✅ PriceOracle deployed at: ${oracleAddress}\n`);

  // 🧱 Deploy TradingPlatform
  console.log("💹 Deploying TradingPlatform...");
  const TradingPlatform = await hre.ethers.getContractFactory("TradingPlatform");
  const tradingPlatform = await TradingPlatform.deploy(tokenAddress, oracleAddress);
  await tradingPlatform.waitForDeployment();
  const platformAddress = await tradingPlatform.getAddress();
  console.log(`✅ TradingPlatform deployed at: ${platformAddress}\n`);

  // 🗂 Save deployed addresses
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);

  const deploymentData = {
    network: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    TokenizedCurrency: tokenAddress,
    PriceOracle: oracleAddress,
    TradingPlatform: platformAddress,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}-deployment.json`),
    JSON.stringify(deploymentData, (key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    2)
  );

  console.log("📝 Deployment data saved successfully!");
  console.log("🎉 Deployment completed!\n");

}

main().catch((error) => {
  console.error("❌ Deployment failed:");
  console.error(error);
  process.exit(1);
});
