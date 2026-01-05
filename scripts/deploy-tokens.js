const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Existing TradingPlatform address on Amoy
const TRADING_PLATFORM_ADDRESS = "0xE13B97E70AF997dEaB3EAa28Ab88cCd362734729";

// Token configurations to deploy
const TOKENS = [
  { name: "Tokenized EUR", symbol: "tEUR", decimals: 6 },
  { name: "Tokenized GBP", symbol: "tGBP", decimals: 6 },
  { name: "Tokenized JPY", symbol: "tJPY", decimals: 0 }, // JPY has no decimals
  { name: "Tokenized AUD", symbol: "tAUD", decimals: 6 },
  { name: "Tokenized CAD", symbol: "tCAD", decimals: 6 },
  { name: "Tokenized CHF", symbol: "tCHF", decimals: 6 },
  { name: "Tokenized NZD", symbol: "tNZD", decimals: 6 },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying token contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC\n");

  const TokenizedCurrency = await hre.ethers.getContractFactory("TokenizedCurrency");
  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  
  const deployedTokens = {
    // Include existing tUSD
    tUSD: "0x7Ffe9d94e805cE4A32B41a94F9f902783BAcD7B3"
  };

  for (const token of TOKENS) {
    console.log(`\n--- Deploying ${token.symbol} ---`);
    console.log(`Name: ${token.name}`);
    console.log(`Decimals: ${token.decimals}`);

    try {
      // Deploy token contract
      const tokenContract = await TokenizedCurrency.deploy(
        token.name,
        token.symbol,
        token.decimals
      );
      await tokenContract.waitForDeployment();
      
      const tokenAddress = await tokenContract.getAddress();
      console.log(`${token.symbol} deployed to:`, tokenAddress);

      // Grant MINTER_ROLE to TradingPlatform
      console.log(`Granting MINTER_ROLE to TradingPlatform...`);
      const grantTx = await tokenContract.grantRole(MINTER_ROLE, TRADING_PLATFORM_ADDRESS);
      await grantTx.wait();
      console.log(`MINTER_ROLE granted successfully`);

      deployedTokens[token.symbol] = tokenAddress;
    } catch (error) {
      console.error(`Failed to deploy ${token.symbol}:`, error.message);
    }
  }

  // Save deployment results
  const deploymentPath = path.join(__dirname, "..", "deployments", "amoy-tokens.json");
  const deploymentData = {
    network: "amoy",
    chainId: 80002,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    tradingPlatform: TRADING_PLATFORM_ADDRESS,
    tokens: deployedTokens
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log("\n✅ Deployment complete! Addresses saved to:", deploymentPath);
  
  // Print summary
  console.log("\n=== DEPLOYED TOKEN ADDRESSES ===");
  for (const [symbol, address] of Object.entries(deployedTokens)) {
    console.log(`${symbol}: ${address}`);
  }

  // Print code to update frontend
  console.log("\n=== UPDATE src/hooks/useTokenContracts.ts ===");
  console.log("export const TOKEN_ADDRESSES = {");
  for (const [symbol, address] of Object.entries(deployedTokens)) {
    console.log(`  ${symbol}: '${address}',`);
  }
  console.log("};");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
