/**
 * Deploy the upgraded TradingPlatformV2 (adds keeper-authorised closeWithTrigger)
 * and authorise the keeper wallet.
 *
 * The oracle, its Chainlink registrations and the collateral token are NOT touched.
 *
 * Usage (from the owner wallet, Polygon mainnet):
 *   KEEPER_ADDRESS=0x... npx hardhat run scripts/deploy-platform-keeper.js --network polygon
 *
 * Dry report (no transactions):
 *   KEEPER_ADDRESS=0x... npx hardhat run scripts/deploy-platform-keeper.js --network polygon
 *   -> prints the plan and requires SUBMIT=1 to actually deploy.
 */
const hre = require("hardhat");

const ORACLE = "0xf61E4881F363b30384DFbcf1C72845CcE94d4f9f"; // PriceOracleV2 (unchanged)
const COLLATERAL = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // native USDC on Polygon

async function main() {
  const net = await hre.ethers.provider.getNetwork();
  const keeper = process.env.KEEPER_ADDRESS;

  console.log("Network:      ", net.chainId.toString());

  if (net.chainId !== 137n) {
    throw new Error(`Wrong network: expected Polygon Mainnet (137), got ${net.chainId}`);
  }

  const signers = await hre.ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      "No signer configured. Set PRIVATE_KEY (owner wallet) in the environment before deploying.",
    );
  }
  const [deployer] = signers;

  console.log("Deployer:     ", deployer.address);
  console.log("Oracle:       ", ORACLE, "(reused, not redeployed)");
  console.log("Collateral:   ", COLLATERAL, "(reused)");
  console.log("Keeper:       ", keeper || "(none provided)");

  if (!keeper) {
    throw new Error("Set KEEPER_ADDRESS to the keeper wallet address");
  }
  if (!hre.ethers.isAddress(keeper)) {
    throw new Error(`KEEPER_ADDRESS is not a valid address: ${keeper}`);
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:      ", hre.ethers.formatEther(balance), "native");

  if (process.env.SUBMIT !== "1") {
    console.log("\nDry run only. Re-run with SUBMIT=1 to deploy and authorise the keeper.");
    return;
  }

  const Factory = await hre.ethers.getContractFactory("TradingPlatformV2");
  const platform = await Factory.deploy(ORACLE, COLLATERAL);
  await platform.waitForDeployment();
  const address = await platform.getAddress();
  console.log("\nTradingPlatformV2 deployed:", address);

  const tx = await platform.setKeeper(keeper, true);
  await tx.wait();
  console.log("Keeper authorised in tx:", tx.hash);

  console.log("\nNext steps:");
  console.log("  1. Put", address, "into CONTRACT_ADDRESSES.polygon.TradingPlatformV2");
  console.log("  2. Fund the keeper wallet with a small amount of POL for gas");
  console.log("  3. Store the keeper private key as the KEEPER_PRIVATE_KEY secret");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
