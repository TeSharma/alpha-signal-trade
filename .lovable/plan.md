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

### 3. Live mode: true on-chain automatic execution (contract upgrade)
`TradingPlatformV2` gains one new function, `closeWithTrigger(uint256 id)`:
- callable only by an address holding a new `KEEPER_ROLE` (granted by the owner);
- reads the price for the position's pair through the existing `PriceOracleV2` and applies the same staleness limit;
- requires the stored SL or TP to be genuinely breached in the position's direction (long: price ≤ SL or ≥ TP; short: price ≥ SL or ≤ TP) — a keeper cannot close a position that is not triggered, and cannot close one with no SL and no TP;
- settles through the existing `_closePosition` path, so fees, margin, leverage, the 300% profit cap and payout to the trader are unchanged;
- reverts if the position is already closed, which makes a repeat call harmless.

Everything else in the contract is untouched. This is a new deployment of the platform contract; the oracle, its Chainlink registrations and the collateral token stay exactly as they are. New platform address goes into `src/config/contracts.ts`, and existing open positions on the old address keep working through manual close.

The keeper is `monitor-positions` itself: on a live trigger it signs `closeWithTrigger` with a dedicated keeper wallet (private key held as a secret, funded with a small amount of POL for gas, holding only `KEEPER_ROLE` — no admin rights, no access to user funds). It waits for the transaction receipt and only then marks the trade closed in the database with the on-chain exit price and settled P&L. A failed or reverted transaction leaves the trade open and is retried on the next run; an in-flight transaction is tracked so the same position is never submitted twice.

Requires from you: deploying the upgraded contract (I prepare the script and run nothing), granting `KEEPER_ROLE` to the keeper address, and funding that keeper wallet with gas.

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
