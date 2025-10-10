import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeployedAddresses {
  network: string;
  tokens: { [key: string]: string };
  oracle: string;
  tradingPlatform: string;
  timestamp: string;
}

async function main() {
  console.log("🔍 Starting contract verification...\n");

  // Load deployed addresses
  const addressesPath = path.join(__dirname, "../deployed-addresses.json");
  if (!fs.existsSync(addressesPath)) {
    console.error("❌ deployed-addresses.json not found. Deploy contracts first!");
    process.exit(1);
  }

  const addresses: DeployedAddresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
  console.log(`📍 Verifying contracts on ${addresses.network}\n`);

  // Verify tokens
  console.log("📦 Verifying Tokenized Currencies...\n");
  
  const currencies = [
    { symbol: "tUSD", name: "Tokenized USD", decimals: 6 },
    { symbol: "tEUR", name: "Tokenized Euro", decimals: 6 },
    { symbol: "tGBP", name: "Tokenized Pound", decimals: 6 },
    { symbol: "tJPY", name: "Tokenized Yen", decimals: 6 },
    { symbol: "tAUD", name: "Tokenized Australian Dollar", decimals: 6 },
    { symbol: "tCAD", name: "Tokenized Canadian Dollar", decimals: 6 },
    { symbol: "tCHF", name: "Tokenized Swiss Franc", decimals: 6 },
    { symbol: "tNZD", name: "Tokenized New Zealand Dollar", decimals: 6 },
  ];

  for (const currency of currencies) {
    const address = addresses.tokens[currency.symbol];
    console.log(`   Verifying ${currency.symbol} at ${address}...`);
    
    try {
      await run("verify:verify", {
        address: address,
        constructorArguments: [
          currency.name,
          currency.symbol,
          currency.decimals,
        ],
      });
      console.log(`   ✅ ${currency.symbol} verified`);
    } catch (error: any) {
      if (error.message.includes("already verified")) {
        console.log(`   ℹ️  ${currency.symbol} already verified`);
      } else {
        console.error(`   ❌ ${currency.symbol} verification failed:`, error.message);
      }
    }
  }

  // Verify PriceOracle
  console.log("\n📦 Verifying PriceOracle...\n");
  try {
    await run("verify:verify", {
      address: addresses.oracle,
      constructorArguments: [],
    });
    console.log("   ✅ PriceOracle verified");
  } catch (error: any) {
    if (error.message.includes("already verified")) {
      console.log("   ℹ️  PriceOracle already verified");
    } else {
      console.error("   ❌ PriceOracle verification failed:", error.message);
    }
  }

  // Verify TradingPlatform
  console.log("\n📦 Verifying TradingPlatform...\n");
  try {
    await run("verify:verify", {
      address: addresses.tradingPlatform,
      constructorArguments: [
        addresses.oracle,
        addresses.tokens.tUSD,
      ],
    });
    console.log("   ✅ TradingPlatform verified");
  } catch (error: any) {
    if (error.message.includes("already verified")) {
      console.log("   ℹ️  TradingPlatform already verified");
    } else {
      console.error("   ❌ TradingPlatform verification failed:", error.message);
    }
  }

  console.log("\n✨ Verification Complete! ✨\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:");
    console.error(error);
    process.exit(1);
  });
