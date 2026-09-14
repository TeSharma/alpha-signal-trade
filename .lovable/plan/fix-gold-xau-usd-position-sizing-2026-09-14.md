# Fix gold (XAU/USD) position sizing

## What's wrong

Gold is being treated as a standard currency lot: 1 lot = 100,000 units. The real
contract size for gold is 100 ounces per lot. Everything downstream is therefore
1,000x too big.

Your test, checked against the code:

- Position value shown: 0.1 x 4310.50 x 100,000 = $43,105,000
- Correct: 0.1 x 4310.50 x 100 = $43,105
- P&L shown: +$3,000 -> correct: +$3.00
- Loss at stop shown: -$4,250,000 -> correct: -$4,250 (0.1 x 42.50 x 100)

Confirmed in three places that all share the same assumption:

1. `src/lib/pnl.ts` — `getAssetMultiplier` returns 100,000 for anything that
   isn't crypto or a JPY pair, so gold falls into the currency bucket.
2. The database P&L function `calculate_trade_pnl` repeats the same three-way
   rule (crypto 1 / JPY 1,000 / else 100,000).
3. The signal execution function `supabase/functions/execute-trade/index.ts`
   repeats it again for position-size capping.

Bitcoin, Ethereum, POL, Euro, Pound and Aussie all keep their current numbers —
only gold changes.

## The fix

Add a metals contract size of 100 per lot and use it everywhere the multiplier is
derived, so position value, live P&L, loss at stop, take-profit value and the
1%-risk sizing all agree for gold.

- One shared rule in `src/lib/pnl.ts`, used by the risk engine, the trade forms,
  the signal execution dialog and Trade History (they all already call it).
- The same rule in the database P&L function, so stored P&L matches the screen.
- The same rule in the signal execution function's sizing cap.
- Remove the one hardcoded 100,000 left in the desktop trade form
  (`TradingForm.tsx`, position-value line) so it uses the shared rule too.

The 1% risk engine is unaffected in behaviour: it divides risk by
(stop distance x contract size), so with the correct gold contract size it will
simply suggest a 1,000x larger gold lot that still risks exactly 1% at the stop.
Leverage still only affects margin, never the loss at the stop. Currency and
crypto sizing is untouched.

## Existing data

There is one gold trade in the database (demo, sell, 0.1 lots, entry 4310.50,
already closed) whose stored profit of $43,000 was credited to your demo
balance using the wrong contract size. Correct value is $43.00. I'll correct
that single row's P&L and adjust the demo balance by the difference so your demo
account isn't inflated. No other pair has gold-affected rows.

## Out of scope

No smart contract, oracle feed, Chainlink registration, deployed address, wallet
or execution-flow changes. The bug is purely in the unit conversion.

## Verification

- Recompute your exact test case and confirm: position value $43,105,
  P&L +$3.00, loss at stop -$4,250.
- Confirm a BTC/USD and a GBP/USD case produce identical numbers to today.
- Confirm the 1% risk suggestion for gold lands on 1.000% loss at the stop.
- Typecheck and production build.
