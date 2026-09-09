// One-off: find archived data.chain.link MATIC/POL feed pages via Wayback CDX
(async () => {
  const urls = [
    "data.chain.link/polygon/mainnet/matic-usd",
    "data.chain.link/feeds/polygon/mainnet/matic-usd",
    "data.chain.link/polygon/mainnet/pol-usd",
  ];
  for (const u of urls) {
    try {
      const api = "http://web.archive.org/cdx/search/cdx?url=" + encodeURIComponent(u) + "&output=json&limit=5";
      const rows = await fetch(api).then((x) => x.json());
      console.log(u + " -> snapshots: " + (rows.length ? rows.slice(1).map((r) => r[1]).join(", ") : "none"));
      if (rows.length > 1) {
        const ts = rows[1][1];
        const snap = "https://web.archive.org/web/" + ts + "/" + rows[1][2];
        const t = await fetch(snap).then((x) => x.text());
        const addrs = [...new Set(t.match(/0x[a-fA-F0-9]{40}/g) || [])];
        console.log("  snapshot " + ts + " addrs: " + addrs.slice(0, 12).join(", "));
        return;
      }
    } catch (e) {
      console.log("ERR for " + u + ": " + e.message);
    }
  }
})();
