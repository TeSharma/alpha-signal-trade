# Phase 2 — keeper-only automatic Live stop-loss / take-profit

Nothing is deployed and no transaction is sent by this plan. Everything below is verified against the code as it stands now.

## 1. Exact source that will be deployed
`src/contracts/TradingPlatformV2.sol` at commit `8568e9f` (494 lines, Solidity, constructor `(oracle, collateral)`). The keeper capability was added in exactly three commits, all pure additions:

```text
c5bacd4   +5  lines   keepers mapping + comment
f4d4a09  +48  lines   closeWithTrigger(), setKeeper(), KeeperUpdated, PositionTriggerClosed
8568e9f   +7  lines   comment/doc lines
total    +60  insertions, 0 deletions
```

The last change to any pre-existing trading logic was commit `6956c6c` (the fee/revenue model), which is already in the deployed contract. There are no uncommitted changes to the contract, scripts or tests.

## 2. The exact contract changes
- `mapping(address => bool) public keepers;`
- `event KeeperUpdated(address indexed keeper, bool allowed);`
- `event PositionTriggerClosed(id, trader, keeper, exitPrice, wasStopLoss);`
- `setKeeper(address keeper, bool allowed) external onlyOwner` — rejects the zero address, emits `KeeperUpdated`.
- `closeWithTrigger(uint256 id) external nonReentrant`:
  1. `require(keepers[msg.sender], "Not keeper")`
  2. `require(p.isOpen, "Position closed")`
  3. `require(p.stopLoss > 0 || p.takeProfit > 0, "No trigger set")`
  4. reads `oracle.getPrice(p.pairId)`, requires `price > 0` and `block.timestamp - updatedAt <= priceTimeout`
  5. long: SL hit when `price <= stopLoss`, TP hit when `price >= takeProfit`; short: SL when `price >= stopLoss`, TP when `price <= takeProfit`; `require(slHit || tpHit, "Trigger not reached")`
  6. settles at the trigger level (`stopLoss` or `takeProfit`), not the polled price, so drift between breach and transaction cannot hurt the trader
  7. calls the existing internal `_closePosition(id, exitPrice)` and emits `PositionTriggerClosed`

## 3. Settlement, P&L, fees, leverage, margin, liquidation and profit cap unchanged
`closeWithTrigger` contains no arithmetic of its own — it calls the same `_closePosition(id, price)` used by `closePosition`. `maxProfitBps = 30000` (300%), `priceTimeout = 120`, `liquidatorRewardBps`, the open/close fee logic, margin and liquidation-price maths and `liquidate()` are untouched, and the diff above shows zero deleted or modified lines in any of them. Payout still goes to `p.trader`; the keeper receives nothing (unlike `liquidate`, which pays a liquidator reward).

## 4. Only an authorised keeper can call it
First statement is `require(keepers[msg.sender], "Not keeper")`, and `keepers` is writable only through `setKeeper`, which is `onlyOwner`. Covered by tests "only an authorised keeper may call closeWithTrigger" and "a revoked keeper can no longer close".

## 5. The contract verifies the price and the trigger itself
The price comes from `oracle.getPrice(p.pairId)` inside the transaction — the keeper cannot supply a price, a pair or an exit level. The stored `stopLoss`/`takeProfit` on the position are the only levels used.

## 6-9. Behaviour already verified by the suite
The full suite runs green today: **46 passing**, including the 8 keeper tests — keeper-only access, revert when the trigger is not reached, revert when no SL and no TP are set, long closed at its stop loss with settlement to the trader, long closed at its take profit, short closed at its take profit, revert on closing the same position twice, revoked keeper reverts.

Missing coverage I will add before deployment:
- short closed at its **stop loss** (only short TP is covered today)
- **stale oracle data** rejected in `closeWithTrigger` at the existing 120-second timeout, and accepted at 119 seconds
- boundary equality: trigger fires when price is exactly equal to SL and exactly equal to TP
- zero/invalid oracle price rejected
- `setKeeper` reverts from a non-owner and on the zero address; `KeeperUpdated` emitted
- fee and profit-cap parity: a trigger close and a manual close at the same price produce identical trader payout and treasury fee
- the keeper receives no payout and cannot call `closePosition` on someone else's position

## 10. Existing live positions on the current address
Deployment creates a **new** platform address; positions on `0x0465161D9aeD6e1C2F9E986Be97F5628E46421D3` stay exactly where they are and remain closable and liquidatable there. The app keeps the old address available for reading and closing existing positions, and opens all new live positions on the new address. Recommended sequence: deploy, keep the old address in the config as a legacy read/close target, and only switch new-position opening once you confirm. No migration of positions and no user action for existing trades beyond closing them normally. The oracle, its Chainlink registrations and the collateral token are reused unchanged.

## 11. Exact frontend / monitor changes
- `src/config/contracts.ts`: add the new platform address for chain 137 and a `LEGACY_TRADING_PLATFORM_V2` entry holding the current address. Amoy untouched.
- `src/hooks/useOnChainTradingV2.ts`: ABI gains `closeWithTrigger`, `keepers`, `setKeeper`, `PositionTriggerClosed` (read-only additions; open/close paths unchanged). Position reads query the new address plus the legacy address so old positions still appear.
- `supabase/functions/monitor-positions/index.ts`: the live branch stops at "pending exit" only for trades on the legacy address; for trades on the new address it signs `closeWithTrigger(chain_position_id)` with the keeper wallet, waits for the receipt, then records the close.
- Database: no schema change needed — `chain_position_id`, `close_tx_hash`, `close_requested_at`, `pending_exit_kind/price/at` already exist. One new column `platform_address TEXT` on `trades` so a trade knows which platform contract holds it.
- One new secret: `KEEPER_PRIVATE_KEY`.

## 12. When the database is updated
Only after the receipt confirms. Order per live trigger: mark `close_requested_at` and store the submitted `close_tx_hash` → wait for the receipt → on success write status `closed`, the on-chain exit price and settled P&L; on revert or failure the trade stays `open`, the hash is cleared and it is retried on the next run. A transaction already in flight within the last 5 minutes is never resubmitted, and the contract itself reverts a second close, so a duplicate is impossible even if the monitor is restarted.

## 13. Keeper wallet setup
A brand-new wallet used for nothing else — not the deployer, no collateral, no owner rights. You generate it in your own wallet software, give me only the public address, authorise it with `setKeeper(address, true)` from the owner wallet, fund it with POL for gas, and save the private key through the secure secret form as `KEEPER_PRIVATE_KEY` (stored server-side, readable only by the edge function at runtime, never in code, never in the browser, never printed in logs). I will never ask you to paste it into chat.

## 14. Gas and recommended balance
A trigger close is a normal close plus one storage read: roughly 200,000-300,000 gas, well under one US cent per close at typical Polygon gas prices. Recommended initial keeper balance **20 POL**, which covers tens of thousands of closes; the monitor will warn in its logs below 5 POL. The per-minute monitoring itself costs nothing on-chain when nothing triggers.

## 15. Emergency shutdown
Fastest, no-code: call `setKeeper(keeperAddress, false)` from the owner wallet — the keeper is powerless within one block. Second lever: delete the `KEEPER_PRIVATE_KEY` secret, which stops the monitor from signing at all. Third: unschedule the `monitor-positions` cron job. Any one of the three is sufficient, and none of them affects user positions, manual closing, or liquidation.

## 16. Test suite
`npx hardhat test` currently reports **46 passing** with the 8 keeper tests included. The additional security tests in section 9 will be added and must pass before deployment.

## 17. Change audit
Contract: `+60` insertions, `0` deletions, all inside the new keeper members — no oracle interface change, no Chainlink feed change, no fee/margin/leverage/liquidation change, no constructor change. Off-chain: the 1% risk engine, contract sizes, market config, the 7 live markets, USD/JPY staying signals-only, wallet architecture and Demo/Live separation are not touched by any item above. Demo mode is entirely unaffected — it never talks to this contract.

## Exact transaction sequence when you approve (all from your wallets, none from me)
```text
1. You generate the keeper wallet and send me only its public address.
2. TX 1  Deploy TradingPlatformV2 (owner wallet)        ~3-4M gas
3. TX 2  setKeeper(keeperAddress, true) (owner wallet)  ~50k gas
4. You fund the keeper wallet with 20 POL.
5. You save KEEPER_PRIVATE_KEY in the secure secret form.
6. I put the new address into config and switch the monitor's live branch.
7. Small live end-to-end test: one minimal position with a tight target,
   confirm the keeper closes it and the record matches the chain.
8. New live positions open on the new address; old positions remain
   closable on the legacy address.
```
No transaction is sent before your explicit go-ahead on this sequence.
