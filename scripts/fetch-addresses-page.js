// One-off: download Chainlink's full price-feed addresses page and extract Polygon rows
const fs = require("fs");
(async () => {
  const res = await fetch("https://docs.chain.link/data-feeds/price-feeds/addresses?network=polygon-mainnet", {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  console.log("HTTP", res.status);
  const html = await res.text();
  console.log("bytes:", html.length);
  fs.writeFileSync("chainlink-addresses-page.html", html);

  const scan = (label) => {
    const hits = [];
    let idx = 0;
    const low = html;
    while ((idx = low.indexOf(label, idx)) !== -1) {
      const chunk = low.slice(Math.max(0, idx - 500), idx + 500);
      const addrs = [...chunk.matchAll(/0x[a-fA-F0-9]{40}/g)].map((m) => m[0]);
      if (addrs.length) hits.push([label, ...addrs]);
      idx += label.length;
    }
    return hits;
  };

  for (const label of ["POL / USD", "MATIC / USD", "POL/USD", "MATIC/USD", '"POL"', '"MATIC"']) {
    const hits = scan(label);
    if (hits.length) {
      console.log("=== " + label + " ===");
      hits.slice(0, 5).forEach((h) => console.log("  " + h.join("  ")));
    }
  }
  // sanity: find BTC rows to confirm the page structure contains addresses
  const btc = scan("BTC / USD");
  console.log("BTC / USD hits:", btc.length);
  if (btc.length) btc.slice(0, 3).forEach((h) => console.log("  " + h.join("  ")));
})().catch((e) => console.log("ERR", e.message));
