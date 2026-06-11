## Goal
Make `supabase/functions/forex-prices` resilient by adding a secondary forex provider that's used when Twelve Data returns 429 (or fails) and the in-memory cache is empty/stale.

## Provider choice
Use **exchangerate.host** as the fallback:
- Free, no API key required (zero-config, no new secret)
- Supports EUR/USD, GBP/USD, USD/JPY, XAU/USD via `/latest?base=USD&symbols=EUR,GBP,JPY,XAU`
- Returns rates relative to USD, which we invert for EUR/USD and GBP/USD and use directly for USD/JPY; XAU rate is inverted to get XAU/USD price

Optional second-tier fallback (only if user wants a paid/keyed source later): Alpha Vantage or Finnhub via a new secret. Not included by default to avoid asking for keys.

## Edge function changes (`supabase/functions/forex-prices/index.ts`)
1. Keep current 60s in-memory cache and rate-limit backoff.
2. Refactor fetch into two functions:
   - `fetchFromTwelveData()` — current behavior; throws a tagged `RateLimitError` on 429.
   - `fetchFromExchangerateHost()` — fetches `https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP,JPY,XAU`, maps to our pair format.
3. Resolution order on each request (cache miss):
   1. Twelve Data (primary)
   2. On 429 or non-2xx → exchangerate.host (fallback)
   3. On both failing → serve stale cache if present, else `{ prices: {}, error: 'all_providers_failed' }` with HTTP 200
4. Tag each response with `source: 'twelvedata' | 'exchangerate.host' | 'cache'` so the client can show which feed is live.
5. Keep `marketOpen` logic and CORS unchanged. All error paths return HTTP 200 with structured JSON (no more 500s).

## Frontend changes (`src/hooks/useMarketData.ts`)
- Read `source` from the response and pass through to each `MarketPrice.source` (extend the union to include `'exchangerate.host'`).
- No UI rewrite; `MarketOverview` already renders a source badge — add a label mapping for the new source ("Exchangerate").

## Out of scope
- No new secrets, no paid providers, no schema changes, no UI redesign.
- No changes to crypto pricing or trading logic.

## Verification
- Manually invoke `forex-prices` after deploy; confirm normal response includes `source: 'twelvedata'`.
- Temporarily force the primary to fail (e.g., bad key path in a one-off test) and confirm response switches to `source: 'exchangerate.host'` and UI keeps rendering prices with no 500s in console.
