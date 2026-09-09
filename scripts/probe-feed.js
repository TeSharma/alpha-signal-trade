// One-off: verify candidate POL/USD (MATIC/USD) Chainlink feed addresses on Polygon mainnet
const { ethers } = require("ethers");
const RPC = "https://polygon-bor-rpc.publicnode.com";
const iface = new ethers.Interface([
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);

async function probe(candidate) {
  try {
    const checksummed = ethers.getAddress(candidate.toLowerCase());
    const d = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: checksummed, data: iface.encodeFunctionData("description") }, "latest"] }),
    }).then((r) => r.json());
    if (!d.result || d.result === "0x") return null;
    const desc = iface.decodeFunctionResult("description", d.result)[0];
    const dd = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: checksummed, data: iface.encodeFunctionData("latestRoundData") }, "latest"] }),
    }).then((r) => r.json());
    if (!dd.result || dd.result === "0x") return { desc, note: "no round data" };
    const w = iface.decodeFunctionResult("latestRoundData", dd.result);
    const answer = Number(w[1]) / 1e8;
    const age = Math.floor(Date.now() / 1000) - Number(w[3]);
    return { desc, answer, age };
  } catch (e) {
    return null;
  }
}

(async () => {
  const candidates = [
    "0xab594600376ec9fd91f8e8dc3ef219f1735db59f",
    "0xab594600376ec9fd91f8e8dc3ef219f1735db591",
    "0xab594600376ec9fd91f8e8dc3ef219f1735db534",
  ];
  for (const c of candidates) {
    const r = await probe(c);
    console.log(c, r ? ('=> "' + r.desc + '" answer=$' + r.answer + " age=" + r.age + "s") : "=> no aggregator");
  }
})().catch((e) => console.log("ERR", e.message));
