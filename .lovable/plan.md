

**What needs fixing:**

1. **Fix `calculate_trade_pnl` DB function** — currently uses `* 100000` (forex pip multiplier) for ALL trades. Must branch by pair type:
   - **Crypto** (BTC/USD, ETH/USD, POL/USD, etc.): `(price_diff) * lot_size` — no multiplier; lot_size = units of base asset.
   - **Forex non-JPY** (EUR/USD, GBP/USD): `(price_diff) * lot_size * 100000` — standard lot.
   - **Forex JPY** (USD/JPY): `(price_diff) * lot_size * 1000` — JPY pip is 0.01.
   
   Detect crypto via pair list (`BTC/USD`, `ETH/USD`, `POL/USD`, `SOL/USD`, etc.) or by checking if pair is in `markets.ts` CRYPTO category.

2. **Migration: reset corrupted account balances + close stale trades**
   - For affected user (`271e5392…`): reset `demo_balance` to 10,000, `total_pnl` & `today_pnl` to 0.
   - Recalculate `pnl` on the 3 inflated closed trades using the corrected formula and update them in place (so trade history shows realistic numbers, not $365M).
   - Optionally close any lingering open POL/USD demo trades with corrupted entries.

3. **Add a "Reset Demo Account" button** on the Account page so users can self-recover from any future PnL corruption (zero out balances, close open demo trades, restore $10k). Already have `resetDemoBalance` in `useTrades.ts` — extend it to also call `cancel_trade` on open demos and zero the PnLs.

4. **Expire stale broken signals** — one-time UPDATE setting `status = 'expired'` on any `active` signal where SL is on the wrong side of entry mid (the geometry check). Prevents users from executing the few remaining bad signals.

**Files to change:**
- New migration: fix `calculate_trade_pnl`, reset balance, recompute the 3 bad trade PnLs, expire malformed active signals.
- `src/hooks/useTrades.ts` — extend `resetDemoBalance` to also close open demo trades + zero PnL fields.
- `src/pages/Account.tsx` (or wherever the demo balance card lives) — add "Reset Demo Account" button wired to the extended hook.

**No changes needed to `close_trade`** — it just calls `calculate_trade_pnl`, so fixing the function fixes everything downstream.

