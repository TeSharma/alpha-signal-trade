// scripts/register-mainnet-forex-feeds.js
//
// Registers the EUR/USD, GBP/USD, AUD/USD and XAU/USD Chainlink aggregators on
// the already-deployed PriceOracleV2 on Polygon mainnet. Existing BTC/USD,
// ETH/USD and POL/USD registrations are left untouched.
//
// Read-only report (safe, no transaction):
//   npx hardhat run scripts/register-mainnet-forex-feeds.js --network polygon
//
// Submit the single owner transaction:
//   SUBMIT=1 npx hardhat run scripts/register-mainnet-forex-feeds.js --network polygon

const hre = require("hardhat");

const PRICE_ORACLE_V2 = "0xf61e4881f363b30384dfbcf1c72845cce94d4f9f";

// Verified 2026-09-14 against the live aggregators: 8 decimals, base/USD quote
// direction matching ShTrader pair naming, ages well inside priceTimeout (120s).
const FEEDS_TO_REGISTER = {
  "EUR/USD": "0x73366Fe0AA0Ded304479862808e02506FE556a98",
  "GBP/USD": "0x099a2540848573e94fb1Ca0Fa420b00acbBc845a",
  "AUD/USD": "0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f",
  "XAU/USD": "0x0C466540B2ee1a31b441671eac0ca886e051E410",
};

const ALREADY_LIVE = ["BTC/USD", "ETH/USD", "POL/USD"];

const PRICE_TIMEOUT_SECONDS = 120;

const ORACLE_ABI = [
  "function owner() view returns (address)",
  "function hasFeed(bytes32 pairId) view returns (bool)",
  "function priceFeeds(bytes32 pairId) view returns (address)",
  "function setPriceFeeds(bytes32[] pairIds, address[] feedAddresses)",
];

const AGGREGATOR_ABI = [
  "function description() view returns (string)",
  "function decimals() view returns (uint8)",
  "function version() view returns (uint256)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

const pairId = (pair) => hre.ethers.keccak256(hre.ethers.toUtf8Bytes(pair));

async function main() {
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  if (chainId !== 137) {
    throw new Error(`Expected Polygon mainnet (137), got ${chainId}. Use --network polygon`);
  }

  const [signer] = await hre.ethers.getSigners();
  const oracle = new hre.ethers.Contract(PRICE_ORACLE_V2, ORACLE_ABI, signer);
  const owner = await oracle.owner();

  console.log(`\nPriceOracleV2: ${PRICE_ORACLE_V2}`);
  console.log(`Oracle owner:  ${owner}`);
  console.log(`Signer:        ${signer.address}`);

  const now = Math.floor(Date.now() / 1000);
  const pairIds = [];
  const feedAddresses = [];
  let blocking = false;

  console.log("\nFeeds to register:");
  for (const [pair, feed] of Object.entries(FEEDS_TO_REGISTER)) {
    const id = pairId(pair);
    const agg = new hre.ethers.Contract(feed, AGGREGATOR_ABI, hre.ethers.provider);

    const [description, decimals, version, round, registered] = await Promise.all([
      agg.description(),
      agg.decimals(),
      agg.version().catch(() => "n/a"),
      agg.latestRoundData(),
      oracle.hasFeed(id),
    ]);

    const age = now - Number(round.updatedAt);
    const fresh = age <= PRICE_TIMEOUT_SECONDS;
    const price = Number(round.answer) / 10 ** Number(decimals);

    console.log(`\n  ${pair}`);
    console.log(`    pairId:      ${id}`);
    console.log(`    aggregator:  ${feed}`);
    console.log(`    description: "${description}" | decimals: ${decimals} | version: ${version}`);
    console.log(`    answer:      ${price} | roundId: ${round.roundId} | age: ${age}s`);
    console.log(`    fresh(<=${PRICE_TIMEOUT_SECONDS}s): ${fresh} | already registered: ${registered}`);

    if (Number(decimals) !== 8) {
      console.log("    BLOCKING: unexpected decimals, expected 8");
      blocking = true;
    }
    if (!fresh) {
      console.log("    BLOCKING: feed is staler than priceTimeout");
      blocking = true;
    }
    if (registered) {
      console.log("    SKIP: already registered, not resubmitting");
      continue;
    }

    pairIds.push(id);
    feedAddresses.push(feed);
  }

  console.log("\nExisting registrations (must stay unchanged):");
  for (const pair of ALREADY_LIVE) {
    const id = pairId(pair);
    console.log(`  ${pair}: ${await oracle.priceFeeds(id)}`);
  }

  if (blocking) {
    console.log("\nAborting: one or more feeds failed verification. No transaction sent.");
    return;
  }
  if (pairIds.length === 0) {
    console.log("\nNothing to do: all target feeds are already registered.");
    return;
  }

  console.log("\nTransaction to submit (single call):");
  console.log("  PriceOracleV2.setPriceFeeds(bytes32[], address[])");
  console.log(`  pairIds:       ${JSON.stringify(pairIds, null, 2)}`);
  console.log(`  feedAddresses: ${JSON.stringify(feedAddresses, null, 2)}`);

  const gas = await oracle.setPriceFeeds.estimateGas(pairIds, feedAddresses);
  const fee = await hre.ethers.provider.getFeeData();
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice;
  console.log(`  estimated gas: ${gas} at ${hre.ethers.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`  estimated cost: ${hre.ethers.formatEther(gas * gasPrice)} POL`);

  if (process.env.SUBMIT !== "1") {
    console.log("\nDry run only. Re-run with SUBMIT=1 to send the transaction.");
    return;
  }

  if (signer.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the oracle owner ${owner}`);
  }

  console.log("\nSubmitting...");
  const tx = await oracle.setPriceFeeds(pairIds, feedAddresses);
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  mined in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`);

  console.log("\nPost-registration check:");
  for (const pair of [...Object.keys(FEEDS_TO_REGISTER), ...ALREADY_LIVE]) {
    const id = pairId(pair);
    console.log(`  ${pair}: registered=${await oracle.hasFeed(id)} feed=${await oracle.priceFeeds(id)}`);
  }
  console.log("\nDone. Tell the app side to flip these pairs back to on-chain.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
