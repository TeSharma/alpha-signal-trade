# Fix: Forex fallback returning "no usable rates"

## Root cause

Edge logs show:
```
[forex-prices] Twelve Data rate-limited; falling back.
[forex-prices] Fallback failed: exchangerate.host returned no usable rates
```

`exchangerate.host` silently moved to a key-required model — anonymous `/latest` calls now respond without the `rates` object, so our fallback throws and the function returns `{ prices: {}, error: "all_providers_failed" }`. That's why forex went dark the moment Twelve Data hit its per-minute cap.

## Change (edge function only: `supabase/functions/forex-prices/index.ts`)

Replace the single `exchangerate.host` fallback with a multi-provider chain that does not require any new secrets:

1. **Primary** — Twelve Data (unchanged).
2. **Fallback A — Frankfurter** (`https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY`). Free, no key, ECB-sourced, very reliable. Covers EUR/USD, GBP/USD, USD/JPY. Map: `EUR/USD = 1/rates.EUR`, `GBP/USD = 1/rates.GBP`, `USD/JPY = rates.JPY`.
3. **Fallback B — open.er-api.com** (`https://open.er-api.com/v6/latest/USD`). Free, no key. Used only for pairs Frankfurter didn't return.
4. **XAU/USD fallback — Stooq CSV** (`https://stooq.com/q/l/?s=xauusd&f=sd2t2c&h&e=csv`). Free, no key. Parse the last column for the latest close. Skipped silently if it fails (gold isn't critical to the forex layer).
5. **Merging** — collect whatever each provider returns into a single `prices` object. As long as ≥1 pair is filled, return 200 with `source: "fallback"` and a per-pair `sources` map (so the UI can keep showing the existing source badge).
6. **All-failed path** — keep returning HTTP 200 with cached/stale data when available, else `{ prices: {}, error: "all_providers_failed" }` (unchanged).

Logging: keep the existing `[forex-prices] Twelve Data rate-limited; falling back.` warning, add one `info` log per fallback provider used.

## Out of scope

- No new secrets.
- No frontend changes — `useMarketData.ts` already accepts `data.source === 'exchangerate.host'`; we'll keep emitting a recognized string (`'exchangerate.host'` stays as the generic fallback label) so the existing UI badge logic is untouched. (If you'd prefer a new badge name like "Backup feed", say so and I'll add it.)
- No changes to crypto or any UI.

## Verification

1. Invoke `forex-prices` directly; confirm 200 with non-empty `prices` even while Twelve Data is rate-limited.
2. Watch edge logs: expect "falling back" followed by a success log, not the current "Fallback failed".
3. Reload `/trade`; confirm EUR/USD, GBP/USD, USD/JPY render; XAU/USD renders when Stooq responds.
