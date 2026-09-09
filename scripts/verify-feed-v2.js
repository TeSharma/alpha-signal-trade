// One-off: verify the two official Polygon POL/MATIC feed candidates
const { ethers } = require("ethers");
const RPC = "https://polygon-bor-rpc.publicnode.com";
const iface = new ethers.Interface([
  "function description() view returns (string)",
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);

async function probe(name, addr) {
  const call = async (data) => {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: addr, data }, "latest"] }),
    }).then((x) => x.json());
    if (!r.result || r.result === "0x") throw new Error("call failed " + JSON.stringify(r.error || r.result));
    return r.result;
  };
  const code = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [addr, "latest"] }),
  }).then((x) => x.json());
  const desc = iface.decodeFunctionResult("description", await call(iface.encodeFunctionData("description")))[0];
  const dec = iface.decodeFunctionResult("decimals", await call(iface.encodeFunctionData("decimals")))[0];
  const w = iface.decodeFunctionResult("latestRoundData", await call(iface.encodeFunctionData("latestRoundData")));
  const age = Math.floor(Date.now() / 1000) - Number(w[3]);
  console.log(name + " " + addr);
  console.log("  code=" + (code.result.length - 2) / 2 + "B  description=" + JSON.stringify(desc) + "  decimals=" + Number(dec));
  console.log("  latest answer=$" + Number(w[1]) / 1e8 + "  updatedAt age=" + age + "s");
}

(async () => {
  await probe("POL/USD  ", "0x44285b60Cc13557935CA4945d20475BD1f1058f4");
  await probe("MATIC/USD", "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0");
})().catch((e) => console.log("ERR", e.message));
