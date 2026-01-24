const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// tUSD contract address on Amoy (from existing deployment)
const TUSD_ADDRESS = "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164";

// MINTER_ROLE hash (keccak256("MINTER_ROLE"))
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TUSDFaucet with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy TUSDFaucet
  console.log("\n1. Deploying TUSDFaucet...");
  const TUSDFaucet = await hre.ethers.getContractFactory("src/contracts/TUSDFaucet.sol:TUSDFaucet");
  const faucet = await TUSDFaucet.deploy(TUSD_ADDRESS);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log("   TUSDFaucet deployed to:", faucetAddress);

  // Grant MINTER_ROLE to faucet on tUSD contract
  console.log("\n2. Granting MINTER_ROLE to faucet...");
  const TokenizedCurrency = await hre.ethers.getContractFactory("src/contracts/TokenizedCurrency.sol:TokenizedCurrency");
  const tUSD = TokenizedCurrency.attach(TUSD_ADDRESS);
  
  // Check if deployer has admin role
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const hasAdminRole = await tUSD.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  
  if (hasAdminRole) {
    const tx = await tUSD.grantRole(MINTER_ROLE, faucetAddress);
    await tx.wait();
    console.log("   MINTER_ROLE granted to faucet");
  } else {
    console.log("   WARNING: Deployer does not have admin role on tUSD.");
    console.log("   You need to manually grant MINTER_ROLE to:", faucetAddress);
    console.log("   Run: tUSD.grantRole(MINTER_ROLE, faucetAddress)");
  }

  // Verify faucet has MINTER_ROLE
  const hasMinterRole = await tUSD.hasRole(MINTER_ROLE, faucetAddress);
  console.log("   Faucet has MINTER_ROLE:", hasMinterRole);

  // Save deployment info
  const deployment = {
    network: "amoy",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      TUSDFaucet: faucetAddress,
      tUSD: TUSD_ADDRESS
    },
    configuration: {
      claimAmount: "1000 tUSD",
      claimCooldown: "24 hours"
    },
    notes: [
      "TESTNET ONLY - Remove for mainnet",
      "Faucet has MINTER_ROLE: " + hasMinterRole
    ]
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "amoy-faucet.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("\n3. Deployment info saved to deployments/amoy-faucet.json");

  // Update contracts config reminder
  console.log("\n========================================");
  console.log("NEXT STEPS:");
  console.log("========================================");
  console.log("1. Update src/config/contracts.ts with:");
  console.log(`   TUSDFaucet: "${faucetAddress}"`);
  console.log("\n2. Verify contract on PolygonScan:");
  console.log(`   npx hardhat verify --network amoy ${faucetAddress} ${TUSD_ADDRESS}`);
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
