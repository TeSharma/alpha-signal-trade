// One-off: extract POL/USD + MATIC/USD feed addresses from Chainlink's official addresses page
(async () => {
  const res = await fetch("https://docs.chain.link/data-feeds/price-feeds", {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  console.log("HTTP", res.status, "bytes:", (await res.clone().arrayBuffer()).byteLength);
  const html = await res.text();
  console.log("html chars:", html.length);

  const find = (label) => {
    const out = [];
    let idx = 0;
    while ((idx = html.indexOf(label, idx)) !== -1) {
      const chunk = html.slice(Math.max(0, idx - 400), idx + 400);
      const addrs = [...chunk.matchAll(/0x[a-fA-F0-9]{40}/g)].map((m) => m[0]);
      if (addrs.length) out.push(addrs);
      idx += label.length;
    }
    return out;
  };

  for (const label of ["POL / USD", "MATIC / USD", "POL/USD", "MATIC/USD"]) {
    const hits = find(label);
    if (hits.length) {
      console.log("\n=== " + label + " ===");
      hits.slice(0, 4).forEach((addrs) => console.log("  ->", addrs.join(", ")));
    }
  }
  console.log("\n=== BTC / USD (sanity check) ===");
  find("BTC / USD").slice(0, 2).forEach((addrs) => console.log("  ->", addrs.join(", ")));
})().catch((e) => console.log("ERR", e.message));
