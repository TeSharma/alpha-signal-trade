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

// For Amoy testnet, use these addresses (example - verify current addresses)
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
  
  console.log("📍 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("👤 Deployer address:", deployer.address);
  console.log("💰 Deployer balance:", ethers.utils.formatEther(await deployer.getBalance()), "MATIC\n");

  // Determine which price feeds to use based on network
  let priceFeeds;
  if (network.chainId === 137) {
    console.log("📍 Deploying to Polygon Mainnet");
    priceFeeds = POLYGON_PRICE_FEEDS;
  } else if (network.chainId === 80002) {
    console.log("📍 Deploying to Amoy Testnet");
    priceFeeds = AMOY_PRICE_FEEDS;
  } else {
    console.log("⚠️ Unknown network, using Amoy price feeds as default");
    priceFeeds = AMOY_PRICE_FEEDS;
  }

  const deployedAddresses: DeployedAddresses = {
    network: network.name,
    tokens: {},
    oracle: "",
    tradingPlatform: "",
    timestamp: new Date().toISOString(),
  };

  // Step 1: Deploy Token Contracts
  console.log("📦 Step 1: Deploying Tokenized Currency Contracts...\n");
  
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
    console.log(`   Deploying ${currency.symbol}...`);
    const token = await TokenizedCurrency.deploy(
      currency.name,
      currency.symbol,
      currency.decimals
    );
    await token.deployed();
    deployedAddresses.tokens[currency.symbol] = token.address;
    console.log(`   ✅ ${currency.symbol} deployed at: ${token.address}`);
  }

  console.log("\n📦 Step 2: Deploying PriceOracle Contract...\n");
  
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const oracle = await PriceOracle.deploy();
  await oracle.deployed();
  deployedAddresses.oracle = oracle.address;
  console.log(`   ✅ PriceOracle deployed at: ${oracle.address}`);

  // Configure price feeds
  console.log("\n   🔗 Configuring Chainlink price feeds...");
  for (const [pair, feedAddress] of Object.entries(priceFeeds)) {
    console.log(`      Setting ${pair} feed...`);
    const tx = await oracle.setPriceFeed(pair, feedAddress);
    await tx.wait();
    console.log(`      ✅ ${pair} configured`);
  }

  console.log("\n📦 Step 3: Deploying TradingPlatform Contract...\n");
  
  const TradingPlatform = await ethers.getContractFactory("TradingPlatform");
  const platform = await TradingPlatform.deploy(
    oracle.address,
    deployedAddresses.tokens.tUSD // Using tUSD as collateral token
  );
  await platform.deployed();
  deployedAddresses.tradingPlatform = platform.address;
  console.log(`   ✅ TradingPlatform deployed at: ${platform.address}`);

  console.log("\n📦 Step 4: Granting MINTER_ROLE to TradingPlatform...\n");
  
  for (const [symbol, address] of Object.entries(deployedAddresses.tokens)) {
    console.log(`   Granting role for ${symbol}...`);
    const token = TokenizedCurrency.attach(address);
    const MINTER_ROLE = await token.MINTER_ROLE();
    const tx = await token.grantRole(MINTER_ROLE, platform.address);
    await tx.wait();
    console.log(`   ✅ ${symbol} minter role granted`);
  }

  // Save deployment addresses
  const outputPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
  console.log(`\n💾 Deployment addresses saved to: deployed-addresses.json`);

  // Generate TypeScript config for frontend
  console.log("\n📝 Generating frontend configuration...\n");
  
  const frontendConfig = `// Auto-generated on ${deployedAddresses.timestamp}
// Network: ${deployedAddresses.network}

export const TOKEN_ADDRESSES = {
  tUSD: '${deployedAddresses.tokens.tUSD}',
  tEUR: '${deployedAddresses.tokens.tEUR}',
  tGBP: '${deployedAddresses.tokens.tGBP}',
  tJPY: '${deployedAddresses.tokens.tJPY}',
  tAUD: '${deployedAddresses.tokens.tAUD}',
  tCAD: '${deployedAddresses.tokens.tCAD}',
  tCHF: '${deployedAddresses.tokens.tCHF}',
  tNZD: '${deployedAddresses.tokens.tNZD}',
} as const;

export const ORACLE_ADDRESS = '${deployedAddresses.oracle}';
export const TRADING_PLATFORM_ADDRESS = '${deployedAddresses.tradingPlatform}';
`;

  const configPath = path.join(__dirname, "../src/config/contracts.ts");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, frontendConfig);
  console.log(`   ✅ Frontend config saved to: src/config/contracts.ts`);

  console.log("\n✨ Deployment Complete! ✨\n");
  console.log("📋 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", deployedAddresses.network);
  console.log("\nTokenized Currencies:");
  Object.entries(deployedAddresses.tokens).forEach(([symbol, address]) => {
    console.log(`  ${symbol}: ${address}`);
  });
  console.log("\nCore Contracts:");
  console.log(`  PriceOracle: ${deployedAddresses.oracle}`);
  console.log(`  TradingPlatform: ${deployedAddresses.tradingPlatform}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("📚 Next Steps:");
  console.log("1. Update src/hooks/useTokenContracts.ts with the new addresses");
  console.log("2. Verify contracts on PolygonScan (optional):");
  console.log(`   npx hardhat verify --network ${network.chainId === 80002 ? 'amoy' : 'polygon'} <CONTRACT_ADDRESS>`);
  console.log("3. Test the integration on your frontend\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
