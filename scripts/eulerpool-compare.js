// Eulerpool vs Twelve Data comparison probe — TEST-ONLY, quota-conscious.
// CommonJS requires (repo package.json has "type": "commonjs") so it runs
// with plain `node`. No ts-node, no .mjs rename, no second copy.
// Usage:
//   node scripts/eulerpool-compare.js            (spot compare, 4 FX pairs)
//   node scripts/eulerpool-compare.js --candles  (also probe eulerpool-candles)
// Reads Supabase URL/anon key from .env (server-side, never prints secrets).
// Compares: provider, symbol, price, timestamp, response time, HTTP status,
// error/fallback status, data availability (+ OHLC for candles).
// Twelve Data path (forex-prices) is only READ for comparison, never modified.
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const envRaw = fs.readFileSync(path.join(root, ".env"), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPA_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_ANON) {
  console.error("missing Supabase URL/anon key in .env");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function invoke(fn, query = "") {
  const t0 = Date.now();
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/${fn}${query}`, {
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` },
    });
    const ms = Date.now() - t0;
    const body = await r.json().catch(() => ({}));
    return { fn, httpStatus: r.status, ms, body, error: null };
  } catch (e) {
    return { fn, httpStatus: -1, ms: Date.now() - t0, body: {}, error: String(e?.message || e) };
  }
}

function redact(o) {
  // Defense-in-depth: never print anything resembling a key/token.
  return JSON.parse(
    JSON.stringify(o, (k, v) => (/key|token|secret|auth/i.test(k) ? "[redacted]" : v)),
  );
}

const withCandles = process.argv.includes("--candles");

async function main() {
  console.log("provider,symbol,price,timestamp,responseMs,httpStatus,error,source,delayed,extra");

  const td = await invoke("forex-prices");
for (const [pair, price] of Object.entries(td.body?.prices || {})) {
    console.log(
      ["twelvedata", pair, price, td.body.timestamp, td.ms, td.httpStatus, td.body.error || "", td.body.source || "", td.body.cached ? "cached" : "live", ""].join(","),
    );
  }
  if (!Object.keys(td.body?.prices || {}).length) {
    console.log(["twelvedata", "-", "-", td.body?.timestamp || "", td.ms, td.httpStatus, td.body?.error || "no_prices", td.body?.source || "", "", ""].join(","));
  }

  await sleep(1500);
  const ep = await invoke("eulerpool-prices");
  for (const [pair, price] of Object.entries(ep.body?.prices || {})) {
    console.log(
      ["eulerpool", pair, price, ep.body.timestamp, ep.ms, ep.httpStatus, ep.body.error || "", ep.body.source || "", ep.body.delayed ? "delayed" : "", "upstream=" + (ep.body.upstreamStatus ?? "")].join(","),
    );
  }
  for (const m of ep.body?.missing || []) {
    console.log(["eulerpool", m, "MISSING", ep.body.timestamp, ep.ms, ep.httpStatus, "", ep.body.source || "", "delayed", ""].join(","));
  }
  if (ep.body?.error && !Object.keys(ep.body?.prices || {}).length) {
    console.log(["eulerpool", "-", "-", "", ep.ms, ep.httpStatus, ep.body.error, "", "", ""].join(","));
  }

  if (withCandles) {
    await sleep(1500);
    const c = await invoke("eulerpool-candles", "?identifier=AAPL&interval=daily");
    const candles = c.body?.candles || [];
    const last = candles[candles.length - 1];
    console.log(
      ["eulerpool-candles", c.body?.symbol || "AAPL", last ? last.close : "none", c.body?.timestamp || "", c.ms, c.httpStatus, c.body?.error || "", "eulerpool", "delayed", `interval=${c.body?.interval || ""} count=${c.body?.count ?? candles.length}`].join(","),
    );
    if (last) {
      console.log(redact({ sampleLastCandle: last }));
    }
  }

  console.log(redact({ done: true, notes: "Twelve Data production path untouched; Eulerpool test-only." }));
}

main().catch((e) => {
  console.error("compare failed:", e?.message || e);
  process.exit(1);
});
