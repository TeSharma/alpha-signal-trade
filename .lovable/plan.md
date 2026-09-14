# Automatic stop-loss / take-profit — keeper audit and two-phase plan

## Answers to your six questions

### 1. What the keeper currently does
There is no keeper repository inside this project, and no project named "alpha-signal-keeper" among the Lovable projects I can reach (I can see Skill Creator, Shtrader Agent Core, StreamSplit AI, project-continuum-spark). If it lives on GitHub or in another account, I cannot read it and will not guess at its behaviour. Everything below therefore treats the keeper as something ShTrader owns.

What exists in ShTrader today for automated closes:
- `liquidate(id)` in `TradingPlatformV2` — permissionless, but it fires only at the internal `liquidationPrice`, never at the stored stop loss or take profit. Nothing in the deployed contract ever reads `stopLoss` / `takeProfit` again after the position is opened.
- `closePosition(id)` — requires `p.trader == msg.sender`, so only the owner's wallet can close.
- Scheduled jobs: signal generation, signal evaluation, and the SEO monitor. No price/position monitor was running before this work.

Work already done in the previous turn (nothing deployed on-chain, nothing committed):
- `close_trade_system(trade_id, exit_price, reason)` exists in the database — service-role only, row-locked and idempotent, credits the correct demo/live balance and writes a portfolio snapshot in one transaction.
- `monitor-positions` edge function is deployed and running every minute; it currently closes demo triggers and, for live triggers, would attempt a keeper call.
- The broken client-side `calculate_trade_pnl` polling was removed.
- `closeWithTrigger` / `setKeeper` were added to the contract **source only** and tested locally (46 contract tests pass). No deploy happened, so the live contract is unchanged.

### 2. What must change to support SL/TP execution
- The monitor's live branch must stop attempting an on-chain close (the deployed contract cannot accept one) and instead record a pending exit plus a notification, leaving status `open`.
- Demo closes must go only through `close_trade_system` — already the case.
- `evaluate-signals` must not duplicate the monitor's work.
- Open Positions needs a highlighted "Target reached — close now" action so the user's wallet submits the close.

### 3. Is the keeper wallet/network configuration suitable for Polygon mainnet?
There is no keeper wallet configured today — no `KEEPER_PRIVATE_KEY` secret exists, and the platform contract on mainnet has no keeper mapping. So nothing is currently suitable, and nothing can act on live positions. For Phase 2 the requirement is a dedicated wallet used for nothing else, funded with a small POL balance, authorised only as a keeper (no owner rights, no access to collateral), with its key stored as a secret and never in code. The existing deployer wallet must not be reused.

### 4. Exact contract changes required for true automatic live SL/TP (Phase 2, not now)
One added function plus one admin setter, nothing else touched:
- `mapping(address => bool) public keepers;` with `setKeeper(address, bool) onlyOwner`.
- `closeWithTrigger(uint256 id)`: requires `keepers[msg.sender]`; requires the position open; reads the price for the position's pair from the existing `PriceOracleV2` and applies the existing 120-second staleness rule; requires a stored SL or TP to exist and to be genuinely breached in the position's direction (long: price ≤ SL or ≥ TP; short: price ≥ SL or ≤ TP); settles at the trigger price through the existing `_closePosition` path so fees, margin, leverage, the 300% profit cap and payout to the trader are unchanged; reverts if already closed, so a repeat call is harmless.
No new oracle, no new price source, no change to fees, risk or market config. It is a fresh deployment of the platform contract only; the oracle and its Chainlink registrations and the collateral token stay exactly as they are.

### 5. Security risks and safeguards
- A keeper key leak — safeguard: keeper can only call `closeWithTrigger`, and only on positions genuinely past their own stored trigger, with proceeds always going to the trader. Worst case is an early close at the user's own stop level. Revocable instantly with `setKeeper(addr, false)`.
- A keeper closing untriggered positions — prevented in the contract, not off-chain.
- Stale or manipulated price — the existing oracle and 120-second staleness rule apply; a stale feed reverts.
- Double execution — the contract reverts on a closed position, and `close_trade_system` is idempotent in the database.
- Database claiming a close that never happened — the database is only updated after a confirmed receipt; a revert leaves the trade open for the next run.
- Contract migration risk — positions on the old address remain closable manually; the new address is only introduced deliberately in config.

### 6. Gas and funding estimate
A trigger close is comparable to a normal close: roughly 200k–300k gas. On Polygon that is a fraction of a cent per close at current gas. 20 POL in the keeper wallet covers many thousands of closes with a wide margin; 5 POL is a reasonable starting float with a low-balance warning in the logs. The monitor itself runs 1,440 times a day and costs nothing on-chain when nothing triggers.

## Phase 1 — what I will build now (no deploy, no transactions)

1. **Live branch becomes pending-exit only.** `monitor-positions` detects a live trigger, writes a pending-exit marker with the trigger kind and price, sends the user a notification, and leaves the trade `open`. All on-chain keeper calling is removed from the function until Phase 2.
2. **Open Positions gets a "Target reached — close now" action** for a trade with a pending exit, submitting the normal owner-signed close; the trade is only marked closed after the transaction confirms.
3. **Demo auto-close stays as built** — trigger price as exit, atomic P&L, balance and snapshot through `close_trade_system`, idempotent so a price sitting past the trigger cannot close twice.
4. **Manual trades with no SL and no TP are skipped** by the monitor and stay open until the user closes them (already verified in a live run).
5. **`evaluate-signals`** keeps using `close_trade_system` so there is one close path.
6. **The broken `calculate_trade_pnl` poll stays removed**; open-trade P&L is displayed from live prices.
7. **Wording** in the trade form states plainly that live stop loss and take profit are monitored and require your wallet to confirm the close, and are optional.
8. **Clean up my verification leftovers**: remove the temporary BTC/USD demo test trade, its snapshot, and restore the $1 test loss to the demo balance (currently 5,407.97, should be 5,408.97).

The contract source keeps `closeWithTrigger` and its passing tests, unused until you approve Phase 2. Nothing is deployed and no transaction is sent.

## Phase 2 — proposed separately, only after your approval
Deploy the upgraded `TradingPlatformV2` from the prepared script, authorise a fresh keeper wallet, fund it, store its key as a secret, put the new address into config, and switch the monitor's live branch from pending-exit to a keeper close with receipt confirmation and in-flight tracking. Contract tests for keeper-only access, untriggered revert, no-trigger revert, long SL / long TP / short TP settlement and double-close revert are already written and passing.

## Untouched throughout
1% risk rule, contract sizes (forex 100,000, gold 100 oz, crypto per config), leverage and margin rules, fee structure, Chainlink feeds and oracle registrations, the 7 live markets, USD/JPY staying signals-only, wallet architecture, Demo/Live separation.

## Verification
- Demo BUY and SELL with SL and with TP close at the trigger price, with correct exit price, P&L, balance movement and snapshot; a repeat run creates no second close.
- A trade with no SL and no TP survives repeated monitor runs.
- A live trigger produces a notification and the "close now" action, and never a closed status without a confirmed transaction.
- Typecheck and production build clean; contract suite green. No transactions, nothing committed.
