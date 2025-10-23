require("@nomicfoundation/hardhat-toolbox");
require("dotenv/config");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: "./src/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
};

// --- AUTO-ABI EXTRACTION HOOK ---
task("compile", "Compiles the entire project and auto-extracts ABIs", async (_, hre, runSuper) => {
  // Run the normal Hardhat compile process
  await runSuper();

  const scriptPath = path.join(__dirname, "extract-abi-and-addresses.js");

  if (fs.existsSync(scriptPath)) {
    console.log("\n🔄 Running ABI extraction script...");
    try {
      execSync(`node "${scriptPath}"`, { stdio: "inherit" });
      console.log("✅ ABI extraction completed successfully!");
    } catch (err) {
      console.error("❌ ABI extraction failed:", err.message);
    }
  } else {
    console.warn("⚠️ ABI extraction script not found — skipping.");
  }
});
