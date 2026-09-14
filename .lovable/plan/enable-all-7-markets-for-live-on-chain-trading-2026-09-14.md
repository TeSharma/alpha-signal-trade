# Enable all 7 markets for live on-chain trading

The four new Chainlink feeds are confirmed live on the price contract. I read all seven feeds from Polygon mainnet just now — every one is registered, positive, and seconds old:

| Market | Registered | Price | Age |
|---|---|---|---|
| BTC/USD | yes | 78,764 | 8s |
| ETH/USD | yes | 2,530 | 13s |
| POL/USD | yes | 0.0978 | 29s |
| EUR/USD | yes | 1.1562 | 29s |
| GBP/USD | yes | 1.3507 | 29s |
| AUD/USD | yes | 0.7148 | 14s |
| XAU/USD | yes | 4,316 | fresh |

Only app-side presentation and market-list changes follow. No contracts, deployments, feed addresses, wallet code, risk engine, or execution logic are touched.

## Changes

### 1. `src/config/markets.ts`
- `V1_MAINNET_FOREX_MARKETS`: `['EUR/USD', 'GBP/USD', 'AUD/USD', 'XAU/USD']` (replaces the empty list), with the comment updated to record the registration transaction and verification date.
- Metadata for EUR/USD, GBP/USD, AUD/USD, XAU/USD: `layer: 'on-chain'`, remove the "AI Signals Only" descriptions (Gold keeps a plain "Gold" description). USD/JPY stays signal-only — its feed is quoted inverted and is not registered.
- `isTradingMarket` / `isSignalMarket` become mode-aware helpers so the four pairs count as tradable in live mode while demo behaviour is unchanged. `V1_SIGNAL_MARKETS` stays as-is so demo mode and the AI signal layer keep listing the same pairs.

Result of `getMarketsForMode('live')`: BTC/USD, ETH/USD, POL/USD, EUR/USD, GBP/USD, AUD/USD, XAU/USD.

### 2. `src/components/trading/MarketOverview.tsx`
Replace the notice text: in Live mode it states that all seven markets trade on-chain via Chainlink feeds, and that USD/JPY remains AI-signals only. Demo wording unchanged.

### 3. `src/components/trading/TradingForm.tsx`
The forex-market-hours block and the submit-button guard currently use `isSignalMarket(selectedPair)`; both are already scoped to `accountMode === 'demo'`, so live trading of the four pairs is unblocked by the config change. Switch those calls to the mode-aware helper so behaviour stays explicit rather than incidental.

### 4. `src/components/trading/OracleStatus.tsx`
No logic change needed — it iterates `getMarketsForMode(accountMode)` and checks `hasFeed` + staleness per pair, so it will read 7/7 in Live mode once the config lists seven pairs. One correction while here: the tooltip converts the oracle price with `fromWei(..., 'ether')`, but the oracle reports 8-decimal prices, so the value is wrong by 10 orders of magnitude. Fix the conversion so the displayed number matches the real price. Status thresholds (5m stale, 30m critical) untouched.

## Verification
- `bunx tsgo --noEmit` and `bun run build`.
- Re-run the read-only mainnet script against the oracle: assert all 7 have `hasFeed=true`, positive price, age under 120s.
- Assert `getMarketsForMode('live')` returns the seven pairs and that none of the four is treated as signal-only in live mode.
- Confirm via diff that no wallet, contract, risk-engine, or execution file changed.

## Known limitation
The rendered 7/7 badge and the Live market dropdown cannot be checked in a browser here: this project uses an external Supabase, so no authenticated session can be created in the sandbox and the trading pages sit behind login. Verification is code-level plus the live on-chain read; you confirm the badge visually in the preview. Nothing is committed or published.
