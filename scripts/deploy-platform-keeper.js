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

  if (keeper.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error("KEEPER_ADDRESS must not be the deployer/owner wallet");
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:      ", hre.ethers.formatEther(balance), "native");

  const Factory = await hre.ethers.getContractFactory("TradingPlatformV2");

  // ---- Transaction 2 only: authorise the keeper on an already deployed platform ----
  if (process.env.SET_KEEPER === "1") {
    const platformAddress = process.env.PLATFORM_ADDRESS;
    if (!platformAddress || !hre.ethers.isAddress(platformAddress)) {
      throw new Error("Set PLATFORM_ADDRESS to the deployed keeper-enabled platform address");
    }
    const platform = Factory.attach(platformAddress);
    const gas = await platform.setKeeper.estimateGas(keeper, true);
    console.log("\nsetKeeper gas estimate:", gas.toString());
    if (process.env.SUBMIT !== "1") {
      console.log("Dry run only. Re-run with SUBMIT=1 to send the authorisation.");
      return;
    }
    const tx = await platform.setKeeper(keeper, true);
    await tx.wait();
    console.log("Keeper authorised in tx:", tx.hash);
    return;
  }

  // ---- Transaction 1: deploy the keeper-enabled platform ----
  const deployTx = await Factory.getDeployTransaction(ORACLE, COLLATERAL);
  const deployGas = await hre.ethers.provider.estimateGas({
    from: deployer.address,
    data: deployTx.data,
  });
  const fee = await hre.ethers.provider.getFeeData();
  console.log("\nDeploy gas estimate:", deployGas.toString());
  console.log(
    "Fee data:          gasPrice",
    hre.ethers.formatUnits(fee.gasPrice ?? 0n, "gwei"),
    "gwei / maxFeePerGas",
    hre.ethers.formatUnits(fee.maxFeePerGas ?? 0n, "gwei"),
    "gwei",
  );
  console.log(
    "Estimated cost:   ",
    hre.ethers.formatEther(deployGas * (fee.gasPrice ?? 0n)),
    "-",
    hre.ethers.formatEther(deployGas * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n)),
    "POL",
  );

  if (process.env.SUBMIT !== "1") {
    console.log("\nDry run only. Re-run with SUBMIT=1 to send the deployment transaction.");
    console.log("The keeper is NOT authorised by this step; that is a separate transaction:");
    console.log("  SET_KEEPER=1 PLATFORM_ADDRESS=<new address> SUBMIT=1 ...");
    return;
  }

  const platform = await Factory.deploy(ORACLE, COLLATERAL);
  await platform.waitForDeployment();
  const address = await platform.getAddress();
  console.log("\nTradingPlatformV2 deployed:", address);
  console.log("Keeper NOT yet authorised. Verify the contract, then run:");
  console.log(`  SET_KEEPER=1 PLATFORM_ADDRESS=${address} KEEPER_ADDRESS=${keeper} SUBMIT=1 ...`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

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

  console.log(
    "Network:      ",
    net.chainId.toString(),
    net.chainId === 137n ? "(Polygon Mainnet)" : "(UNEXPECTED NETWORK)",
  );

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
  if (keeper === hre.ethers.ZeroAddress) {
    throw new Error("KEEPER_ADDRESS must not be the zero address");
  }

  if (keeper.toLowerCase() === deployer.address.toLowerCase()) {
    throw new Error("KEEPER_ADDRESS must not be the deployer/owner wallet");
  }

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:      ", hre.ethers.formatEther(balance), "native");

  const Factory = await hre.ethers.getContractFactory("TradingPlatformV2");

  // ---- Transaction 2 only: authorise the keeper on an already deployed platform ----
  if (process.env.SET_KEEPER === "1") {
    const platformAddress = process.env.PLATFORM_ADDRESS;
    if (!platformAddress || !hre.ethers.isAddress(platformAddress)) {
      throw new Error("Set PLATFORM_ADDRESS to the deployed keeper-enabled platform address");
    }
    const platform = Factory.attach(platformAddress);
    const gas = await platform.setKeeper.estimateGas(keeper, true);
    console.log("\nsetKeeper gas estimate:", gas.toString());
    if (process.env.SUBMIT !== "1") {
      console.log("Dry run only. Re-run with SUBMIT=1 to send the authorisation.");
      return;
    }
    const tx = await platform.setKeeper(keeper, true);
    await tx.wait();
    console.log("Keeper authorised in tx:", tx.hash);
    return;
  }

  // ---- Transaction 1: deploy the keeper-enabled platform ----
  const deployTx = await Factory.getDeployTransaction(ORACLE, COLLATERAL);
  const deployGas = await hre.ethers.provider.estimateGas({
    from: deployer.address,
    data: deployTx.data,
  });
  const fee = await hre.ethers.provider.getFeeData();
  console.log("\nDeploy gas estimate:", deployGas.toString());
  console.log(
    "Fee data:          gasPrice",
    hre.ethers.formatUnits(fee.gasPrice ?? 0n, "gwei"),
    "gwei / maxFeePerGas",
    hre.ethers.formatUnits(fee.maxFeePerGas ?? 0n, "gwei"),
    "gwei",
  );
  console.log(
    "Estimated cost:   ",
    hre.ethers.formatEther(deployGas * (fee.gasPrice ?? 0n)),
    "-",
    hre.ethers.formatEther(deployGas * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n)),
    "POL",
  );

  if (process.env.SUBMIT !== "1") {
    console.log("\nDry run only. Re-run with SUBMIT=1 to send the deployment transaction.");
    console.log("The keeper is NOT authorised by this step; that is a separate transaction:");
    console.log("  SET_KEEPER=1 PLATFORM_ADDRESS=<new address> SUBMIT=1 ...");
    return;
  }

  const platform = await Factory.deploy(ORACLE, COLLATERAL);
  console.log(
    "\nDeployment tx sent:",
    platform.deploymentTransaction()?.hash ?? "(hash unavailable)",
  );
  await platform.waitForDeployment();
  const address = await platform.getAddress();
  console.log("TradingPlatformV2 deployed:", address);
  console.log("Keeper NOT yet authorised. Verify the contract, then run:");
  console.log(`  SET_KEEPER=1 PLATFORM_ADDRESS=${address} KEEPER_ADDRESS=${keeper} SUBMIT=1 ...`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
