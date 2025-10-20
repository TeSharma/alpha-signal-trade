import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`📍 Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await deployer.getBalance())} MATIC\n`);

  // Select price feeds
  const priceFeeds =
    network.chainId === 137
      ? POLYGON_PRICE_FEEDS
      : network.chainId === 80002
      ? AMOY_PRICE_FEEDS
      : AMOY_PRICE_FEEDS;

  const deployedAddresses: DeployedAddresses = {
    network: network.name,
    tokens: {},
    oracle: "",
    tradingPlatform: "",
    timestamp: new Date().toISOString(),
  };

  // Step 1: Deploy Tokenized Currencies
  console.log("📦 Step 1: Deploying TokenizedCurrency contracts...\n");

  const currencies = [
    { name: "Tokenized USD", symbol: "tUSD", decimals: 6 },
    { name: "Tokenized Euro", symbol: "tEUR", decimals: 6 },
    { name: "Tokenized Pound", symbol: "tGBP", decimals: 6 },
    { name: "Tokenized Yen", symbol: "tJPY", decimals: 6 },
    { name: "Tokenized Australian Dollar", symbol: "tAUD", decimals: 6 },
    { name: "Tokenized Canadian Dollar", symbol: "tCAD", decimals: 6 },
    { name: "Tokenized Swiss Franc", symbol: "tCHF", decimals: 6 },
    { name: "Tokenized New Zealand Dollar", symbol: "tNZD", decimals: 6 },
  ];

  const TokenizedCurrency = await ethers.getContractFactory("TokenizedCurrency");

  for (const currency of currencies) {
    console.log(`   🚀 Deploying ${currency.symbol}...`);
    const token = await TokenizedCurrency.deploy(currency.name, currency.symbol, currency.decimals);
    await token.waitForDeployment();
    const address = await token.getAddress();
    deployedAddresses.tokens[currency.symbol] = address;
    console.log(`   ✅ ${currency.symbol} deployed at: ${address}`);
  }

  // Step 2: Deploy PriceOracle
  console.log("\n📦 Step 2: Deploying PriceOracle...\n");
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await PriceOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  deployedAddresses.oracle = oracleAddress;
  console.log(`   ✅ PriceOracle deployed at: ${oracleAddress}`);

  // Configure feeds
  console.log("\n   🔗 Setting up Chainlink price feeds...");
  for (const [pair, feed] of Object.entries(priceFeeds)) {
    const tx = await oracle.setPriceFeed(pair, feed);
    await tx.wait();
    console.log(`      ✅ ${pair} → ${feed}`);
  }

  // Step 3: Deploy TradingPlatform
  console.log("\n📦 Step 3: Deploying TradingPlatform...\n");
  const TradingPlatform = await ethers.getContractFactory("TradingPlatform");
  const platform = await TradingPlatform.deploy(
    oracleAddress,
    deployedAddresses.tokens.tUSD // Collateral token
  );
  await platform.waitForDeployment();
  const platformAddress = await platform.getAddress();
  deployedAddresses.tradingPlatform = platformAddress;
  console.log(`   ✅ TradingPlatform deployed at: ${platformAddress}`);

  // Step 4: Grant MINTER_ROLE
  console.log("\n📦 Step 4: Granting MINTER_ROLE to TradingPlatform...\n");
  for (const [symbol, address] of Object.entries(deployedAddresses.tokens)) {
    const token = TokenizedCurrency.attach(address);
    const MINTER_ROLE = await token.MINTER_ROLE();
    const tx = await token.grantRole(MINTER_ROLE, platformAddress);
    await tx.wait();
    console.log(`   ✅ Granted MINTER_ROLE for ${symbol}`);
  }

  // Save results
  const outputPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
  console.log(`\n💾 Saved deployment addresses to deployed-addresses.json`);

  // Frontend config
  const frontendConfig = `// Auto-generated on ${deployedAddresses.timestamp}
// Network: ${deployedAddresses.network}

export const TOKEN_ADDRESSES = ${JSON.stringify(deployedAddresses.tokens, null, 2)} as const;
export const ORACLE_ADDRESS = '${deployedAddresses.oracle}';
export const TRADING_PLATFORM_ADDRESS = '${deployedAddresses.tradingPlatform}';
`;

  const configPath = path.join(__dirname, "../src/config/contracts.ts");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, frontendConfig);
  console.log(`   ✅ Frontend config saved to: src/config/contracts.ts`);

  console.log("\n✨ Deployment Complete ✨\n");
  console.log(deployedAddresses);
}

main().catch((err) => {
  console.error("❌ Deployment failed:");
  console.error(err);
  process.exitCode = 1;
});
