// One-off: verify MATIC/USD official address + dump raw row context
const fs = require("fs");
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
    if (!r.result || r.result === "0x") throw new Error("call failed " + JSON.stringify(r.error || r.result) + " raw=" + r.raw);
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
  await probe("MATIC/USD", "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0");

  const html = fs.readFileSync("chainlink-addresses-page.html", "utf8");
  // dump context of each Polygon Mainnet mention
  let idx = 0;
  let n = 0;
  while ((idx = html.indexOf("Polygon Mainnet", idx)) !== -1) {
    n++;
    const ctx = html.slice(idx - 150, idx + 700).replace(/<[^>]+>/g, "|").replace(/\|+/g, "|").replace(/\s+/g, " ");
    console.log("\n--- Polygon Mainnet mention #" + n + " at " + idx + " ---");
    console.log(ctx.slice(0, 600));
    idx += 10;
  }
  // dump the POL / USD row context in the polygon section
  const polIdx = html.indexOf("POL / USD", idx === 0 ? 0 : html.indexOf("Polygon Mainnet"));
  const allPol = [];
  let p = 0;
  while ((p = html.indexOf("POL / USD", p)) !== -1) { allPol.push(p); p += 5; }
  console.log("\ntotal POL / USD occurrences:", allPol.length);
  const mainnetIdx = html.indexOf("Polygon Mainnet");
  const near = allPol.find((x) => x > mainnetIdx);
  if (near) {
    console.log("--- first POL / USD after Polygon Mainnet (raw) ---");
    console.log(html.slice(near - 300, near + 500).replace(/\s+/g, " "));
  }
})().catch((e) => console.log("ERR", e.message));
