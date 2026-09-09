// One-off: locate the Polygon Mainnet POL/MATIC row in the downloaded Chainlink addresses page
const fs = require("fs");
const html = fs.readFileSync("chainlink-addresses-page.html", "utf8");
console.log("bytes:", html.length);

// Split the page into "network sections" anchored on network labels
const networkLabels = [...html.matchAll(/Polygon Mainnet/g)].map((m) => m.index);
console.log("Polygon Mainnet mentions:", networkLabels.length);

const rows = [];
for (const start of networkLabels) {
  const section = html.slice(start, start + 400000);
  for (const pair of ["POL / USD", "MATIC / USD", "MATIC / POL"]) {
    const idx = section.indexOf(pair);
    if (idx !== -1) {
      const chunk = section.slice(idx - 200, idx + 600);
      const addrs = [...chunk.matchAll(/0x[a-fA-F0-9]{40}/g)].map((m) => m[0]);
      rows.push({ pair, addrs: [...new Set(addrs)] });
    }
  }
  if (rows.length) break; // first Polygon Mainnet section with a POL row is enough
}

if (!rows.length) {
  console.log("no POL rows in Polygon Mainnet sections — dumping nearby network names:");
  const i = html.indexOf("Polygon Mainnet");
  console.log(html.slice(i - 200, i + 400).replace(/\s+/g, " ").slice(0, 500));
} else {
  rows.forEach((r) => console.log(r.pair, "→", r.addrs.join(", ")));
  fs.writeFileSync("polygon-pol-candidates.json", JSON.stringify(rows, null, 2));
}
