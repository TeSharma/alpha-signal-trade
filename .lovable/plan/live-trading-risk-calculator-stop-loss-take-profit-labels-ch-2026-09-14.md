# Live trading: risk calculator, Stop Loss / Take Profit, labels, chart

Frontend-only work. No contract, oracle, feed, execution-path or market-list changes.

## 1. Risk calculator (the "Calculate" button)

Today the button ignores the stop loss entirely: it takes 2% of the balance and divides by 10,000, so the number it fills in has no relation to the entered stop loss, the market price or the leverage.

Replace it with the 1%-risk rule already used elsewhere in the app (the signal execution dialog uses exactly this math):

- Risk amount = 1% of available trading capital (demo balance in Demo, on-chain collateral in Live).
- Stop-loss distance = |entry price − stop loss|, where entry is the ask for Buy and the bid for Sell (limit price when a limit order is set).
- Position size = risk amount ÷ (stop-loss distance × the pair's contract multiplier).
- In Live mode the field the user submits is margin, so also derive the margin the position size needs at the chosen leverage, and clamp it to the available collateral, the network minimum margin, and the platform's max leverage.
- If no stop loss is entered yet, the button explains that a stop loss is required rather than filling in an arbitrary number.

A new panel under the inputs always shows: risk amount (and % of capital), stop-loss distance, resulting position size / notional, potential loss at SL, potential profit at TP, and R:R. Values recompute live as direction, price, SL, TP, margin or leverage change.

## 2. Stop Loss / Take Profit validation

Both fields get real validation before a trade can be submitted:

- Buy: stop loss must be below entry, take profit above entry.
- Sell: stop loss must be above entry, take profit below entry.
- Both must be positive numbers within a sane distance of the current price.
- Invalid values disable the submit button with an inline message naming the problem.

Values continue to flow into the existing trade record (Supabase `stop_loss` / `take_profit`) unchanged, and the same checks are added to the mobile trading screen so both surfaces behave alike.

Existing risk limits (1% per trade guidance, minimum margin, oracle-health gate, gas gate, network gate, leverage cap) stay exactly as they are — nothing is bypassed. If the computed loss at the stop loss exceeds 1% of capital, the summary flags it before submission.

## 3. Risk label

The "Risk-free" badge in the account panel becomes mode-aware: "Risk-free" while Demo is selected, "AI Risk Managed" in Live. Demo behaviour is otherwise untouched.

## 4. TradingView chart

Keep the existing embedded TradingView widget. Fixes:

- Remove the current mount race so the widget rebuilds cleanly whenever the selected market changes, instead of occasionally leaving an empty box.
- Show a loading state until the widget's iframe actually appears, and fall back to the existing "could not load / open on TradingView" message if it never does or the script is blocked.
- The chart's market selector follows the mode-aware market list so Live shows the seven live markets.

## Technical notes

- Files: `src/components/trading/TradingForm.tsx`, `src/components/trading/MobileTradingInterface.tsx`, `src/components/trading/AccountBalance.tsx`, `src/components/trading/TradingViewChart.tsx`, plus a small shared helper for the risk math (reusing `getAssetMultiplier` from `src/lib/pnl.ts` so UI and database PnL stay in sync).
- Deployed `TradingPlatformV2.openPosition` accepts `stopLoss` / `takeProfit` arguments but the deployed bytecode only stores them — it never auto-closes on them. So SL/TP stay authoritative off-chain (Supabase record + existing close flow) and the on-chain arguments remain `0, 0`; changing that would require a contract change, which is out of scope. The UI will not claim SL/TP are enforced on-chain.
- No changes to `useOnChainTradingV2` write paths, `src/config/markets.ts`, `src/config/contracts.ts`, wallet code, or the oracle hooks.

## Verification

Typecheck and production build, plus the existing test suite. Then, in the preview: Buy and Sell with SL/TP on a live market, confirm the 1% risk figure matches the shown risk amount, leverage cap respected, R:R correct, invalid SL/TP blocked, chart renders on every market switch, Live still shows 7/7 oracle feeds and all seven markets, USD/JPY still signals-only, Demo unchanged.
