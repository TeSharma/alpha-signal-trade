# Fix TP labelling and manual lot-size validation

## 1. "TP1 (executed)" is wrong wording

Trade History (and the open-positions card that shares it) always prints
`TP1 (executed):` next to a trade's target, even for a trade that is still open
and has never reached its target. The signal card has the same wording for the
first target.

Change:
- Trade History: label the target `TP1 (attached)` while the trade is open.
  Once a trade is closed, show `TP1 (hit)` only when the recorded exit actually
  reached the target (long: exit >= TP, short: exit <= TP); otherwise keep
  `TP1 (attached)`.
- Signal card: first target reads `· attached` instead of `· executed`;
  TP2/TP3 keep `· guidance only`.

No change to stored data, execution, or how the target is used.

## 2. Manually typed size must pass the same checks as the suggested size

Today the suggested size is computed by the risk engine, but a value typed by
hand is only checked for "greater than zero" (plus a minimum-margin and
collateral check in Live). Nothing stops a size whose required margin exceeds
the balance, or whose loss at the stop far exceeds the 1% limit. In Demo the
form also treats leverage as 1x for the risk panel while signal execution uses
30x, so the two paths disagree.

Change (desktop form and the narrow-screen trading panel, identically):
- Run every entered size through the existing sizing math (same contract sizes:
  forex 100,000 per lot, gold 100 oz per lot, crypto 1 unit — unchanged).
- Compute for the entered size: position value, required margin (using the same
  leverage the mode uses — 30x for Demo, the selected leverage in Live), and
  the dollar loss at the entered stop loss.
- Block execution with a visible, specific error when:
  - required margin exceeds available capital,
  - loss at the stop exceeds the 1% per-trade limit,
  - a stop loss is missing while a size larger than the suggested one is typed,
  - the entered size is zero, negative, or beyond the stored maximum.
- The error appears under the size field and the Execute button is disabled;
  the typed number is never silently reduced. A "Use suggested size" action
  stays available so the user can opt in to the compliant size.
- Suggested-size behaviour, the 1% rule itself, and the existing calculations
  stay exactly as they are.

Verification cases with the current ~$4,318 demo balance:
- GBP/USD 10 lots — position value ~$1.35m, margin at 30x ~$44,987: rejected
  (margin exceeds balance), and its stop distance also breaches the 1% limit.
- XAU/USD 1 lot — position value ~$431k, margin at 30x ~$14,368: rejected.
- The current correct suggestions (GBP/USD 0.2159 lots, gold sizing) stay valid
  and remain accepted.

## 3. The GBP/USD 1.76466 target — checked

Verified in the database: this is not a signal problem. Every recent GBP/USD
signal has sane targets (entry zone 1.34895–1.34995, targets 1.35245 / 1.35445 /
1.35645). The 1.76466 value belongs to a manually created trade, so it came from
the trade form, not the signal generator.

Related fix: the form's target check currently allows a target up to 5x away
from entry, so 1.76466 on a 1.3496 entry passed. Tighten the check for forex and
gold so a target more than a few percent away from entry is flagged as
unrealistic, while leaving crypto (which genuinely moves that far) with a looser
bound. Signal generation is untouched.

## Technical notes

- Files: `src/components/trading/TradeHistory.tsx`,
  `src/components/signals/EnhancedSignalCard.tsx`,
  `src/components/trading/TradingForm.tsx`,
  `src/components/trading/MobileTradingInterface.tsx`, and a small shared
  validation helper added to `src/lib/riskEngine.ts` (reusing
  `computeSignalSizing` / `getAssetMultiplier`; `RISK_PERCENT` and
  `DEMO_LEVERAGE` unchanged).
- Unchanged: smart contracts, oracle feeds, deployed addresses, market
  configuration, execution flow, the 1% rule and the contract-size table.
- Typecheck (`tsgo`) and production build run after the edits.
