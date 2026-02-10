

## Amoy Oracle Fix: POL/USD Only + Network-Aware Market Config

### Problem

Chainlink on Polygon Amoy only has a reliable POL/USD feed. BTC/USD and ETH/USD feeds do not exist on Amoy. The current code registers all three pairs, causing reverts and oracle-offline errors.

### Solution

Make the market configuration network-aware: on Amoy, only POL/USD is tradable on-chain. BTC/USD and ETH/USD are shown as "Mainnet only" in the UI. On future mainnet deployment, all three pairs activate automatically.

---

### Changes

#### 1. Update `src/config/markets.ts`

- Rename `MATIC/USD` to `POL/USD` everywhere (symbol, icon, metadata key)
- Add a new `network` field to `MarketMeta`: `'amoy-only' | 'mainnet-only' | 'all'`
- Mark `BTC/USD` and `ETH/USD` as `network: 'mainnet-only'`
- Mark `POL/USD` as `network: 'all'`
- Add helper: `getAmoyTradingMarkets()` returns `['POL/USD']`
- Add helper: `getMainnetTradingMarkets()` returns `['BTC/USD', 'ETH/USD', 'POL/USD']`
- Keep `V1_TRADING_MARKETS` as the full list for reference, but add `V1_AMOY_MARKETS` and `V1_MAINNET_MARKETS`

#### 2. Update `src/hooks/useOnChainTradingV2.ts`

- Change `PAIR_IDS` from `{ 'BTC/USD', 'ETH/USD', 'MATIC/USD' }` to `{ 'POL/USD' }` (Amoy-only)
- Keep `BTC/USD` and `ETH/USD` entries but mark them with comments for mainnet activation
- The `initPairIds()` function stays the same -- it just hashes fewer pairs

#### 3. Update `src/hooks/useMarketData.ts`

- Change `ORACLE_PAIRS` from `[...V1_TRADING_MARKETS]` to `['POL/USD']` (import from markets config)
- Only POL/USD will be fetched from the oracle; BTC/USD and ETH/USD won't be queried on Amoy

#### 4. Update `src/components/trading/TradingForm.tsx`

- Default selected pair: `POL/USD` instead of `BTC/USD`
- Filter pair selector to only show pairs with active oracle feeds (on Amoy: POL/USD only)
- Show BTC/USD and ETH/USD in the selector but grayed out with "Mainnet only" badge
- Keep all existing precondition checks unchanged

#### 5. Update `src/components/trading/MobileTradingInterface.tsx`

- Same changes as TradingForm: default to POL/USD, show BTC/ETH as disabled "Mainnet only"

#### 6. Update `src/components/trading/MarketOverview.tsx`

- Show POL/USD with live data
- Show BTC/USD and ETH/USD cards with "Mainnet only" label and no price data
- Existing "Forex coming in v2" banner stays

#### 7. Update `scripts/setup-crypto-feeds.js`

- Remove BTC/USD and ETH/USD entries from the `FEEDS` array
- Rename MATIC/USD to POL/USD
- Keep the confirmed aggregator address `0x001382149eBa3441043c1c66972b4772963f5D43` for POL/USD

---

### Files to Modify

| File | Change |
|---|---|
| `src/config/markets.ts` | Rename MATIC to POL, add network-aware helpers, mark BTC/ETH as mainnet-only |
| `src/hooks/useOnChainTradingV2.ts` | PAIR_IDS = POL/USD only |
| `src/hooks/useMarketData.ts` | ORACLE_PAIRS = POL/USD only |
| `src/components/trading/TradingForm.tsx` | Default to POL/USD, gray out BTC/ETH with "Mainnet only" |
| `src/components/trading/MobileTradingInterface.tsx` | Same as TradingForm |
| `src/components/trading/MarketOverview.tsx` | POL/USD live, BTC/ETH shown as "Mainnet only" |
| `scripts/setup-crypto-feeds.js` | POL/USD only, remove BTC/ETH entries |

### What Does NOT Change

- Trading engine, PnL, margin, liquidation logic -- pair-agnostic
- Network enforcement, wallet logic, faucet -- untouched
- AI Signal layer (Forex) -- untouched
- Contract addresses -- untouched (PriceOracleV2 already deployed)
- RPC configuration -- just updated in previous change

