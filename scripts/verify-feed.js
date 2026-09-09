// One-off: verify candidate Chainlink MATIC/USD aggregator proxy on Polygon mainnet
const { ethers } = require("ethers");
const RPC = "https://polygon-bor-rpc.publicnode.com";
const CANDIDATE = "0xEB2E324F989955a4E343D957BC34ec14322be5cA";
const iface = new ethers.Interface([
  "function description() view returns (string)",
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);

(async () => {
  const call = async (data) => {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: CANDIDATE, data }, "latest"] }),
    }).then((x) => x.json());
    if (!r.result || r.result === "0x") throw new Error("call failed: " + JSON.stringify(r.error || r.result));
    return r.result;
  };

  const code = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [CANDIDATE, "latest"] }),
  }).then((x) => x.json());
  console.log("code bytes:", (code.result.length - 2) / 2);

  const desc = iface.decodeFunctionResult("description", await call(iface.encodeFunctionData("description")))[0];
  const dec = iface.decodeFunctionResult("decimals", await call(iface.encodeFunctionData("decimals")))[0];
  const w = iface.decodeFunctionResult("latestRoundData", await call(iface.encodeFunctionData("latestRoundData")));
  const age = Math.floor(Date.now() / 1000) - Number(w[3]);

  console.log("description:", JSON.stringify(desc));
  console.log("decimals:", Number(dec));
  console.log("latest answer: $" + Number(w[1]) / 1e8);
  console.log("updatedAt age:", age + "s");
})().catch((e) => console.log("ERR", e.message));
