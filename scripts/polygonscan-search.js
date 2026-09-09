// One-off: search Polygonscan for the Chainlink Matic_USD aggregator proxy contract
(async () => {
  for (const q of ["Matic_USD", "MATIC_USD", "MaticUsd"]) {
    try {
      const url = "https://polygonscan.com/search?q=" + encodeURIComponent(q) + "&filter=address&subfilter=contracts";
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
      const t = await r.text();
      const rows = [];
      const re = /href="\/address\/(0x[a-fA-F0-9]{40})"[^>]*>([^<]{0,80})</g;
      let m;
      while ((m = re.exec(t)) !== null) {
        rows.push(m[1] + "  " + m[2].trim());
      }
      const uniq = [...new Set(rows)];
      console.log("query=" + q + " -> " + uniq.length + " contract hits");
      uniq.slice(0, 10).forEach((x) => console.log("   " + x));
      if (uniq.length) return;
    } catch (e) {
      console.log("ERR for " + q + ": " + e.message);
    }
  }
})();
