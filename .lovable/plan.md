## Goals

1. Repoint the keeper bot to the existing **Amoy V2** deployment (no mainnet contracts yet) with a clean network switch for later.
2. Fix the **SL/TP "interchanging"** bug on signal cards (root cause: direction label mismatch, not geometry).
3. Make signals materially better: tighter entries, stricter RR ladder, server-side geometry validation, live price marker on the card, and a real **SL/TP auto-close watcher** so signals actually finish when price hits SL or TP.
4. Improve signal logic with **market-structure** features (swing highs/lows, BoS, support/resistance) so SL/TP sit on real levels rather than fixed % buffers.

---

## Part A — Keeper bot on Amoy

- Add `NETWORK` env var (`amoy` | `polygon`), default `amoy`.
- `src/config/network.ts` in keeper repo maps:
  - `amoy` → `TradingPlatformV2 0x133DC29e4D6f366E8Ad05454eba452c7BC56573D`, `PriceOracleV2 0x5D58135A49C5035C5836E682B7A68B0d3d8816fF`, chainId `80002`, RPC = `VITE_ALCHEMY_AMOY_RPC`.
  - `polygon` → placeholders (left empty until mainnet deploy).
- Update `fly.toml` env to `NETWORK=amoy`, `DRY_RUN=true` for first run.
- Block startup if addresses for the selected network are missing (fail fast).
- Log selected network + addresses at boot for confirmation.
- Lower scanner backfill window from 300k blocks to 50k (Amoy has fast blocks; smaller history is enough for active positions).

## Part B — Fix SL/TP label bug (root cause)

The DB stores `direction` as `'buy'`/`'sell'` (lowercase), but `EnhancedSignalCard` and friends only check `=== 'LONG'`. `useSignalList` passes `row.direction` through unchanged, so every loaded signal renders as SHORT and the SL/TP look "inverted" relative to the (correct) underlying numbers.

Fix:
- In `src/hooks/useSignalList.ts` (line 178), normalize: `direction: row.direction === 'buy' || row.direction === 'long' ? 'LONG' : 'SHORT'` (mirror what `useSignals.ts:30` already does).
- Audit `SignalCard`, `EnhancedSignalCard`, `ExecuteTradeDialog`, `SignalAnalytics`, `SignalFilters` for any other raw `'LONG'`/`'SHORT'` comparisons and centralize via a small `normalizeDirection()` helper in `src/types/signal.ts`.

## Part C — Signal generation upgrades (`generate-signal`)

1. **Tighten entries** — clamp entry zone to current price ± a small band:
   - Crypto: ±0.10% around current price (so entry is immediately actionable).
   - Forex: ±5 pips (±0.0005, JPY ±0.05).
   - Override AI's entry_low/entry_high if outside the band; preserve direction.
2. **Re-balance RR ladder** — TP1 = 1.5R, TP2 = 2.5R, TP3 = max(3.5R, AI rr).
3. **Server-side geometry validator** — after `normalizeSignalGeometry`, assert:
   - LONG: `stop_loss < entry_low` and `tp1 > entry_high`.
   - SHORT: `stop_loss > entry_high` and `tp1 < entry_low`.
   - Reject (don't insert) on violation; log + return `{ filtered: true, reason: 'geometry' }`.
4. **Market-structure inputs (lightweight)** — fetch last 60 candles (Binance for crypto, Twelve Data for forex), compute:
   - Recent swing high / swing low (last 20 candles).
   - Nearest support/resistance cluster.
   - Pass these into the AI prompt as context, and use swing high/low as a **floor** for SL placement (e.g. LONG SL = min(entry − buffer, swing_low − small_buffer)).
5. Keep `confidence ≥ 0.75` and `RR ≥ 2.2` filters.

## Part D — Auto-close on SL/TP hit (the "actually implemented" piece)

Today `evaluate-signals` exists but only marks signals expired/wins for stats. We need a real watcher that closes user **trades** opened from signals when the live price crosses SL or TP.

- New cron (every minute) calling existing `evaluate-signals` — extend it to:
  - For every `trades` row where `status='open'` AND `account_mode='demo'` AND `signal_id` is set (or SL/TP columns are set):
    - Fetch current price (Binance / Twelve Data) for `pair`.
    - If `direction='buy'` and `price ≥ take_profit` → call `close_trade(trade_id, take_profit)`.
    - If `direction='buy'` and `price ≤ stop_loss` → call `close_trade(trade_id, stop_loss)`.
    - Inverse for `direction='sell'`.
  - For `trading_signals` itself, also mark as `tp_hit`/`sl_hit` to feed the performance loop.
- Live trades on Amoy continue to be liquidated by the keeper bot (Part A); this watcher is **demo-only** off-chain settlement.

## Part E — Live price marker on signal card

- Add a small `useLivePrice(pair, market)` hook (reuse existing `useMarketData`/Binance WS).
- In `EnhancedSignalCard`, render a "Live: $X.XX" pill colored:
  - Green if price between entry and TP1 (in trade direction).
  - Red if price beyond SL.
  - Neutral if outside entry zone but pre-trigger.
- Visually shows the user that SL/TP are on the right side of price.

---

## Technical notes

```text
Files touched (build-mode):
  alpha-signal-keeper/  (separate repo)
    src/config/network.ts          NEW   — NETWORK switch + address map
    src/index.ts                   EDIT  — fail-fast on missing addrs
    fly.toml                       EDIT  — NETWORK=amoy
    .env.example                   EDIT
    README.md                      EDIT  — Amoy-first instructions

  This repo:
    src/types/signal.ts            EDIT  — normalizeDirection() helper
    src/hooks/useSignalList.ts     EDIT  — normalize direction on map
    src/components/signals/EnhancedSignalCard.tsx  EDIT  — live price pill
    src/hooks/useLivePrice.ts      NEW   — thin wrapper over market data
    supabase/functions/generate-signal/index.ts    EDIT
        - tightenEntryZone(), structure features, geometry validator,
          new RR ladder
    supabase/functions/evaluate-signals/index.ts   EDIT
        - SL/TP auto-close for open demo trades
    DB cron (insert tool, not migration): keep evaluate-signals at 1-min cadence
```

No schema changes. No new tables. RLS unchanged. `close_trade` RPC already exists and handles balance/portfolio snapshot updates.

## Out of scope (future)

- Mainnet contract deploy + keeper switch to `polygon`.
- ERC-4337 paymaster / gasless trading.
- Pyth forex oracle for live forex execution.
- Full ICT/SMC market-structure engine — this round adds only swing high/low + S/R clusters.
