// One-off: find the data API endpoint used by the Chainlink addresses page
(async () => {
  const res = await fetch("https://docs.chain.link/data-feeds/price-feeds", {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  const html = await res.text();

  const urls = new Set();
  for (const m of html.matchAll(/https?:\/\/[^"'\\\s]+/g)) {
    const u = m[0];
    if (/api|feed|json|addresses/i.test(u) && !/google|w3\.org|schema\.org|fonts|npmjs/.test(u)) urls.add(u);
  }
  for (const m of html.matchAll(/["'](\/[^"']*(?:api|feed|address)[^"']*)["']/gi)) {
    urls.add(m[1]);
  }
  console.log([...urls].slice(0, 40).join("\n"));

  const hasData = /"pair"|latestRound|"docAddress"|networkName/i.test(html);
  console.log("\nembedded feed data present:", hasData);
})().catch((e) => console.log("ERR", e.message));
