# SL/TP execution audit and fix

## What I found (verified, not assumed)

**Live mode: SL/TP are stored but can never fire automatically.**
`TradingPlatformV2.closePosition(id)` requires `p.trader == msg.sender` — only the position owner's wallet can close. The only permissionless function is `liquidate(id)`, and it triggers exclusively at the internal `liquidationPrice`, never at the stored `stopLoss`/`takeProfit`. Those two values are written into the position struct and never read again anywhere in the contract.

Consequence: no off-chain service, keeper, or frontend code can close a live position at SL/TP with the currently deployed contract. Automation at contract level would require a contract change (a keeper-callable trigger close). Frontend code alone cannot provide it, and I will not present it as if it does.

**There is no keeper today.** Scheduled jobs are only: `generate-signal` (30 min), `evaluate-signals` (15 min), `gsc-monitor` (6 h). No position monitor exists.

**Demo mode: partially works, with real bugs.**
`evaluate-signals` does auto-close demo trades whose SL/TP is breached, but:
- it runs only every 15 minutes, so triggers are missed for long stretches;
- it marks the trade closed **without crediting the demo balance** and without a portfolio snapshot (the balance update lives in `close_trade`, which it can't call because that function uses `auth.uid()`), so realised P&L silently disappears from the account balance;
- it closes at exactly the SL/TP price, which is right, but writes P&L through a separate call, so a failure between the two steps leaves an inconsistent row.

**Separate live bug causing the console error flood.**
The browser updates open-trade P&L by calling `calculate_trade_pnl`, but that function's execute permission was revoked from `authenticated` during security hardening. Every poll fails with `permission denied for function calculate_trade_pnl` (visible repeatedly in the current logs). Display P&L is already computed client-side, so this call is both broken and unnecessary.

## What I will change

### 1. A real position monitor (keeper)
New edge function `monitor-positions`, scheduled every minute:
- reads all `open` trades (both modes), groups by pair, fetches one price per pair through the existing price functions (`crypto-prices` / `forex-prices`), skips forex when the market is closed;
- trigger rules exactly as specified — BUY: close at SL when price ≤ SL, at TP1 when price ≥ TP1; SELL: close at SL when price ≥ SL, at TP1 when price ≤ TP1;
- trades with no SL and no TP are left untouched and stay open until the user closes them;
- exit price recorded as the trigger price (SL or TP1), not the polled price.

### 2. Demo closes become correct and atomic
New security-definer function `close_trade_system(p_trade_id, p_exit_price, p_reason)`, callable by `service_role` only. In one transaction it: closes the trade **only if it is still `open`** (idempotent — a second call does nothing, so a price sitting beyond the trigger cannot close twice or double-credit), computes P&L with the existing `calculate_trade_pnl` logic and contract sizes, credits the correct demo/live balance, updates total/today P&L, and inserts a portfolio snapshot. The trade's owner is taken from the row, not from the session.

Demo auto-close in `evaluate-signals` switches to this function (single source of truth), and the monitor uses it too.

### 3. Live mode: honest behaviour now, plus the upgrade path
Because the deployed contract will not accept a keeper close, live triggers will:
- be detected by the monitor and recorded as a pending exit (a notification the user already receives through the existing notifications system: "GBP/USD take profit reached — close position");
- surface in Open Positions as a highlighted "Target reached — Close now" action that submits the normal `closePosition` transaction from the user's wallet, then updates the database on confirmation;
- never be labelled "hit" or "closed" until the on-chain close is confirmed.

The trade panel's current wording ("platform-monitored, not contract-enforced") is updated to state plainly that live SL/TP require confirmation from the user's wallet.

Smallest production-safe architecture for true live automation (**requires a contract deploy — not part of this change, your decision**):
add `closeWithTrigger(uint256 id)` to the platform, callable by any address holding a `KEEPER_ROLE`, which reads the Chainlink price through the existing oracle, requires the stored SL/TP to be genuinely breached in the position's direction, and then runs the same `_closePosition` settlement (proceeds still go to the trader). The keeper is then the same `monitor-positions` function signing with a funded keeper wallet key held as a secret. No new oracle, no new price source, no change to fees, margin, leverage or risk rules.

### 4. Stop the broken P&L call
Remove the client's `calculate_trade_pnl` call; open-trade P&L stays client-side from live prices, and the stored P&L is written once at close by `close_trade_system`. This clears the repeating permission error.

## Untouched
Smart contracts (no deploy, no ABI change), oracle registrations and Chainlink feeds, the 7-market config, USD/JPY staying signals-only, the 1% risk engine, contract sizes, leverage and margin rules, wallet architecture, and Demo/Live separation.

## Verification
- Demo BUY and SELL with SL and with TP1: monitor closes them at the trigger price, status becomes Closed, exit price and P&L correct, demo balance moves by exactly that P&L, snapshot written.
- Re-running the monitor while price stays beyond the trigger produces no second close and no second balance credit.
- A manual trade with no SL/TP stays open across monitor runs.
- Live: trigger detection produces the notification and the "Close now" action; nothing is marked closed without a confirmed transaction.
- Typecheck and production build clean. No blockchain transactions, nothing committed.
