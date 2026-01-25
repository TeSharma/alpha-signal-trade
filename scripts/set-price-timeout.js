// Script to update priceTimeout on TradingPlatformV2
// Run with: npx hardhat run scripts/set-price-timeout.js --network amoy

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Setting price timeout with account:", deployer.address);

  // TradingPlatformV2 address from deployment
  const TRADING_PLATFORM_V2_ADDRESS = "0x133DC29e4D6f366E8Ad05454eba452c7BC56573D";
  
  // New timeout in seconds (1 hour = 3600, 15 min = 900, 30 min = 1800)
  const NEW_TIMEOUT = 3600; // 1 hour - more testnet-friendly

  // Get contract instance
  const TradingPlatformV2 = await hre.ethers.getContractAt(
    "TradingPlatformV2",
    TRADING_PLATFORM_V2_ADDRESS
  );

  // Check current timeout
  const currentTimeout = await TradingPlatformV2.priceTimeout();
  console.log("Current priceTimeout:", currentTimeout.toString(), "seconds");

  // Check if we're the owner
  const owner = await TradingPlatformV2.owner();
  console.log("Contract owner:", owner);
  console.log("Your address:", deployer.address);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: You are not the contract owner. Cannot update priceTimeout.");
    console.log("Owner wallet required:", owner);
    process.exit(1);
  }

  // Set new timeout
  console.log(`Setting priceTimeout to ${NEW_TIMEOUT} seconds (${NEW_TIMEOUT / 60} minutes)...`);
  
  const tx = await TradingPlatformV2.setPriceTimeout(NEW_TIMEOUT);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify new timeout
  const newTimeout = await TradingPlatformV2.priceTimeout();
  console.log("New priceTimeout:", newTimeout.toString(), "seconds");
  
  console.log("\n✅ Price timeout updated successfully!");
  console.log("Trades should now work even if oracle price is up to", NEW_TIMEOUT / 60, "minutes old.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
