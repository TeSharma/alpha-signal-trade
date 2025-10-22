import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

const { ethers } = hre;

// Chainlink Price Feed addresses for Polygon Mainnet
const POLYGON_PRICE_FEEDS = {
  "EUR/USD": "0x73366Fe0AA0Ded304479862808e02506FE556a98",
  "GBP/USD": "0x099a2540848573e94fb1Ca0Fa420b00acbBc845a",
  "USD/JPY": "0xD647a6fC9BC6402301583C91decC5989d8Bc382D",
  "AUD/USD": "0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f",
  "USD/CAD": "0xACA44ABb8B04D07D883202F99FA5E3c53ed57Fb5",
  "USD/CHF": "0xc76f762CedF0F78a439727861628E0fdfE1e70c2",
  "NZD/USD": "0xa302a0B8a499fD0f00449df0a490DedE21105955",
};

// For Amoy testnet
const AMOY_PRICE_FEEDS = {
  "EUR/USD": "0x7d7356bF6Ee5CDeC22B216581E48eCC700D0497A",
  "GBP/USD": "0x099a2540848573e94fb1Ca0Fa420b00acbBc845a",
  "USD/JPY": "0xD647a6fC9BC6402301583C91decC5989d8Bc382D",
  "AUD/USD": "0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f",
  "USD/CAD": "0xACA44ABb8B04D07D883202F99FA5E3c53ed57Fb5",
  "USD/CHF": "0xc76f762CedF0F78a439727861628E0fdfE1e70c2",
  "NZD/USD": "0xa302a0B8a499fD0f00449df0a490DedE21105955",
};

interface DeployedAddresses {
  network: string;
  tokens: { [key: string]: string };
  oracle: string;
  tradingPlatform: string;
  timestamp: string;
}

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
