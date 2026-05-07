# Fix PnL accounting, signal calculators & live price card

I traced your three complaints into the data and found the root causes. They are all related: the **asset-class multiplier** (1 for crypto, 1 000 for JPY pairs, 100 000 for the rest of forex) is applied correctly in the database close function, but the **frontend and the `execute-trade` edge function ignore it**. That single mismatch produces every symptom you described.

## What's actually broken (evidence from your trades)

```text
Trade                      lot   entry      exit      DB PnL    UI showed
POL/USD sell  (signal)     10    0.10000    0.10330   -$0.03    ~ -$3 300  (×100 000 too high)
USD/JPY sell  (signal)     17.3  156.185    156.400   -$3 716   ~ -$3 716  (× wrong base — JPY needs 1 000)
GBP/USD sell  (signal)    100    1.35535    1.35608   -$7 300   correct in DB but suggested lot was 100× too big
BTC/USD sell  (manual)     10    81 701     81 400    +$3 011   ~ +$301 mil while open (×100 000)
```

The "PnL changes wildly when the trade closes" is the live-PnL ticker in `TradeHistory` always multiplying by `100 000`, then the DB recomputing with the correct multiplier on close. Same formula bug makes the **suggested lot size** in the Execute-Signal dialog wildly wrong for crypto (way too small) and JPY (1 000× too big), which is why the GBP and JPY signal trades blew up.

## Fixes

### 1. Single source of truth for the asset multiplier
- New file `src/lib/pnl.ts` exporting `getAssetMultiplier(pair)` and `computePnL(pair, direction, entry, current, lot)` that mirrors the DB function exactly (crypto=1, JPY=1 000, FX=100 000).
- Replace the inline `* 100000` math in:
  - `src/components/trading/TradeHistory.tsx` (`calculateCurrentPnL`)
  - any other component doing the same naive math (`MobileTradingInterface`, `TradePanel` if they recompute PnL).

### 2. Correct lot-size & risk calculator in `ExecuteTradeDialog.tsx`
- Suggested size becomes `riskAmount / (stopDistance * multiplier)`.
- "Risk if SL hit" displayed = `lot * stopDistance * multiplier`.
- "Notional" stays `lot * entry * multiplier` (so the balance check is meaningful for forex).
- Cap by balance using the same multiplier-aware notional.

### 3. Same fix server-side in `supabase/functions/execute-trade/index.ts`
- Compute `multiplier` from pair, then `positionSize = riskAmount / (stopDistance * multiplier)`.
- Cap `positionSize` by `accountBalance / (entryPrice * multiplier)`.
- This stops the engine from auto-suggesting 100 lots of GBP/USD on a $10k demo.

### 4. Live-price card on `EnhancedSignalCard` (the "price card not fixed")
The card already renders a live pill but every card mounts its **own** copy of `useMarketData`, which spins up its own crypto+forex polling loop. With 5 cards visible that's 5 redundant edge-function calls every 10 s and the pill often shows nothing.
- Promote market data to a shared context: new `MarketDataProvider` in `src/contexts/MarketDataContext.tsx` that runs `useMarketData` once and exposes `pricesMap`.
- Wrap the app in `App.tsx`.
- Rewrite `useLivePrice` to read from this context — instant updates, one network loop.
- Also show a tiny **live unrealised PnL** under the Trade Context block when `signal.trade_id && trade_status === 'OPEN'`, computed with the shared `computePnL` helper, so the executed-trade panel actually moves.

### 5. Small cleanups discovered along the way
- Remove the duplicate "Trade Closed" toast in `TradeHistory.handleCloseTrade` (the `useTrades.closeTrade` hook already toasts).
- Clamp `getCurrentPrice` polling in `TradeHistory` to skip pairs whose live price is `0` (avoids a bogus PnL flash to `-entry*lot*mult`).

## Files touched
- new: `src/lib/pnl.ts`, `src/contexts/MarketDataContext.tsx`
- edit: `src/hooks/useLivePrice.ts`, `src/components/signals/EnhancedSignalCard.tsx`, `src/components/signals/ExecuteTradeDialog.tsx`, `src/components/trading/TradeHistory.tsx`, `src/App.tsx`
- edit edge fn: `supabase/functions/execute-trade/index.ts`

## Out of scope for this round
- Re-tuning AI signal quality (entry zone width, RR ladder, market-structure SL placement) — already shipped last round; we can iterate after the math is trustworthy again.
- Auto-close on SL/TP for **manual** (non-signal) trades — currently `evaluate-signals` only watches trades with a `signal_id`. Tell me if you want that extended.
- Mainnet keeper bot work.

After approval I'll implement and you can re-open a demo signal trade to verify the PnL stays consistent from open → close.
