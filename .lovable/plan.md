# Fix: Crypto prices not connecting

## Root cause

`supabase/functions/crypto-prices/index.ts` returns each pair as:
`{ lastPrice, priceChange, priceChangePercent, highPrice, lowPrice, volume, source }`

But `src/hooks/useMarketData.ts` reads `market.openPrice`, `market.bidPrice`, `market.askPrice`, and `market.quoteVolume`. Those fields don't exist, so `openPrice` parses to `NaN`, the `Number.isFinite(openPrice) && openPrice > 0` guard rejects every pair, and the hook reports crypto as disconnected.

This is purely a frontend mapping bug — the edge function (verified live) responds 200 with valid Binance data and a CoinGecko fallback.

## Change

Update only the crypto branch in `src/hooks/useMarketData.ts` (`fetch24hrData`) to consume the actual response shape:

- Derive `change` and `changePercent` directly from `priceChange` / `priceChangePercent` (no `openPrice` needed).
- Use `volume` for the formatted volume (Binance base-asset volume; fine for display) instead of the missing `quoteVolume`.
- Drop the bid/ask read — the edge function doesn't return them — and synthesize bid/ask from `lastPrice` using the existing `derivedSpread = price * 0.0001` already in the file.
- Tag `source` from `market.source` (`'binance' | 'coingecko'`) so the `MarketPrice.source` union must add `'coingecko'`. Update the union in the same file (and nothing else — `MarketOverview.tsx` already has a generic fallback badge).

No edge function changes, no UI redesign, no changes to forex logic, no schema changes.

## Verification

1. Reload `/trade`; confirm BTC/USD, ETH/USD, POL/USD render prices and the connection indicator turns green.
2. Confirm `change` / `changePercent` match the values shown by Binance.
3. Confirm forex pairs continue to work (untouched code path).
