# Real-Time Market Prices: Binance WebSocket + Twelve Data API

## Overview

Replace the non-functional oracle-only price feed with real-time API prices. Crypto pairs get sub-second updates via Binance WebSocket. Forex pairs get updates via Twelve Data REST API (polled every 60s). The oracle remains as an optional overlay for future live on-chain execution.

## Architecture

```text
Frontend (useMarketData)
├── Crypto (BTC/USD, ETH/USD, POL/USD)
│   └── Binance WebSocket: wss://stream.binance.com:9443/ws
│       streams: btcusdt@miniTicker, ethusdt@miniTicker, maticusdt@miniTicker
│
├── Forex (EUR/USD, GBP/USD, USD/JPY)
│   └── Twelve Data REST via Edge Function proxy (every 60s)
│       GET /functions/v1/forex-prices → Twelve Data /price?symbol=EUR/USD,GBP/USD,USD/JPY
│
└── Oracle (future — optional overlay when available)

Edge Function (generate-signal)
├── Crypto: Binance REST /api/v3/ticker/price (free, no key)
└── Forex: Twelve Data /price (uses TWELVE_DATA_API_KEY secret)
```

## Changes

### 1. Add `TWELVE_DATA_API_KEY` secret

- Twelve Data free tier gives 8 requests/minute and 800/day — sufficient for our 60s polling and edge function use. The user will need to sign up at [https://twelvedata.com](https://twelvedata.com) and get a free API key.

### 2. New edge function: `supabase/functions/forex-prices/index.ts`

A lightweight proxy that calls Twelve Data `/price` endpoint for EUR/USD, GBP/USD, USD/JPY and returns the results. This keeps the API key server-side. Frontend calls this every 60 seconds.

### 3. Rewrite `src/hooks/useMarketData.ts`

Remove all Web3/oracle code. Replace with:

- **Binance WebSocket** for crypto: Connect to `wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker/maticusdt@miniTicker`. Parse `miniTicker` events for close price, high, low, volume. Map Binance symbols to our pair format (btcusdt → BTC/USD).
- **Forex REST polling**: Call `forex-prices` edge function every 60 seconds for forex pairs.
- **24h change calculation**: Use Binance `@ticker` stream (or initial REST call to `/api/v3/ticker/24hr`) for 24h change data. For forex, calculate change from first price of session.
- Keep `MarketPrice` interface and all existing return values (`prices`, `pricesMap`, `getPrice`, `getCurrentPrice`, `getBidPrice`, `getAskPrice`).
- `isOraclePrice` becomes `false` for API prices; `oracleAvailable` stays for future use.
- WebSocket reconnection logic with exponential backoff.

### 4. Update `src/hooks/useOraclePrice.ts`

Keep as-is for future on-chain use. No changes needed — nothing currently imports it for display.

### 5. Update `supabase/functions/generate-signal/index.ts`

Inject **real current prices** into the AI prompt so signals correlate with actual market prices:

- Crypto: Fetch from Binance REST `https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT` (free, no key)
- Forex: Fetch from Twelve Data `/price?symbol=EUR/USD&apikey=...`
- Add current price to the AI user message: "Current price of BTC/USD is $104,250. Generate a 30m signal..."

### 6. Update `src/config/markets.ts`

Add a `binanceSymbol` field to `MARKET_METADATA` for mapping (e.g., `'BTC/USD'` → `'btcusdt'`).

### 7. Update `src/components/trading/MarketOverview.tsx`

- Replace "Chainlink" badge with "Binance" / "Twelve Data" source indicator
- Update "Waiting for oracle data..." to "Connecting..."
- Show forex pairs in the market overview (currently only shows `getMarketsForMode` which excludes forex)

### 8. Save memory

Update `mem://architecture/market-config-centralization` and create `mem://infrastructure/price-feed-sources` documenting the hybrid Binance WS + Twelve Data setup.

## Files


| File                                          | Action                                                      |
| --------------------------------------------- | ----------------------------------------------------------- |
| `src/hooks/useMarketData.ts`                  | **Rewrite** — Binance WS for crypto, REST polling for forex |
| `src/config/markets.ts`                       | **Edit** — add `binanceSymbol` to metadata                  |
| `supabase/functions/forex-prices/index.ts`    | **Create** — Twelve Data proxy                              |
| `supabase/functions/generate-signal/index.ts` | **Edit** — fetch real prices before AI call                 |
| `src/components/trading/MarketOverview.tsx`   | **Edit** — update source badges and include forex           |
| Secret: `TWELVE_DATA_API_KEY`                 | **Add** — user provides from twelvedata.com                 |


## Twelve Data API Key

Before implementation, the user needs to:

1. Sign up at [https://twelvedata.com](https://twelvedata.com) (free)
2. Copy the API key from the dashboard
3. We'll store it as a Supabase edge function secret

## Oracle Integrity

Per the oracle integrity policy: API prices are used for display and demo trading only. Live on-chain trades will still require a working Chainlink oracle feed before execution is permitted. This is enforced in the trading preconditions check.  
  
This is the Twelve_Data_Api_key 1b93078cf3c740d1bf9a24cabaec98f7