# Phase 2 — Keeper-enabled Live SL/TP: deployment sequence and app changes

## Checks done now (read-only, nothing sent)

| Item | Value | Result |
|---|---|---|
| Keeper address you gave | 0xBA46bc1a54638E673b1C94A521fbe7B2CF3cFB66 | Separate from the owner wallet — confirmed |
| Owner / deployer wallet | 0x09C2B58F6004176bD83cc000d804eD3c1041754E | Unchanged, stays the only owner |
| Target network | Polygon Mainnet, chain 137 | The deploy script hard-fails on any other chain |
| Oracle to reuse | 0xf61E4881F363b30384DFbcf1C72845CcE94d4f9f | Not redeployed, not modified |
| Collateral to reuse | USDC 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 | Unchanged |
| Legacy platform | 0x0465161D9aeD6e1C2F9E986Be97F5628E46421D3 | Kept, still readable and closable |

## One thing blocks me from running the deployment myself

This project holds no Polygon signing credential and no paid Polygon RPC credential, and I will never ask you for a private key. So the deployment transaction and the keeper authorisation must be sent by you from the owner wallet, using the script already prepared in the project. I run every verification before and after, and I make all the app changes.

## Transaction sequence — exactly two transactions, both from the owner wallet

Transaction 1 — deploy the keeper-enabled platform
- Contract: the prepared TradingPlatformV2 in this project (keeper additions only: `keepers` mapping, `setKeeper`, `closeWithTrigger`, two events)
- Constructor arguments: oracle `0xf61E4881F363b30384DFbcf1C72845CcE94d4f9f`, collateral `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`
- Estimated gas: ~3.4M, roughly 0.9–1.4 POL at current Polygon fees

Transaction 2 — authorise the keeper (only after I verify the deployed contract)
- To: the new platform address
- Function: `setKeeper(0xBA46bc1a54638E673b1C94A521fbe7B2CF3cFB66, true)`
- Estimated gas: ~50k, a fraction of a cent
- No other address is authorised; the deployer is never set as keeper

Nothing else is sent. No funds move out of the deployer wallet beyond gas. No existing position is touched or migrated.

## Order of work

1. Run the full contract test suite and require all 52 to pass (14 of them cover the keeper path).
2. Run the deploy script in dry mode: it prints network, owner, oracle, collateral and keeper, and refuses to continue without an explicit submit flag.
3. You send transaction 1 from the owner wallet.
4. I read the new contract live and confirm: owner, oracle, collateral, price timeout 120s, fee and leverage settings identical to the legacy contract, `keepers` empty.
5. I show you transaction 2 in full for approval; you send it.
6. I re-read and confirm the keeper address is authorised and no other address is.
7. You fund the keeper wallet with a small amount of POL for gas (2–5 POL covers thousands of closes) and store the keeper private key through the secure secret interface as `KEEPER_PRIVATE_KEY`. It never appears in code, logs or chat.
8. I switch new Live positions to the new platform and enable automatic closing (details below), then run typecheck, build and tests.
9. Minimal end-to-end Live test with a tiny position and a near stop, verifying: trigger detected, on-chain close succeeds, exit price equals the stored trigger, trader settlement matches the contract, keeper receives nothing, database updated only after the confirmed receipt.

## App changes (after transaction 2, not before)

- `src/config/contracts.ts` — new platform address for new Live positions; the legacy address kept as a named legacy entry so existing positions stay readable and manually closable.
- `src/hooks/useOnChainTradingV2.ts` — opens on the new platform; reads and manual closes route to whichever platform a position belongs to.
- Position records already store the platform they were opened on, so nothing is migrated.
- `supabase/functions/monitor-positions/index.ts` — a triggered Live position on the new platform is closed by the keeper via `closeWithTrigger`, and the trade is marked closed only after the transaction receipt confirms, with the on-chain exit price and settled P&L; the same position is never submitted twice; a revert leaves the trade open for the next run. Positions on the legacy platform keep the current pending-exit alert plus wallet close.
- Demo behaviour, the 1% risk rule, contract sizes, leverage, margin, fees, liquidation, oracle feeds, the seven live markets and USD/JPY staying signals-only are all unchanged.

## Safeguards

- Keeper can only call `closeWithTrigger`, only when the stored stop or target has genuinely been breached at a Chainlink price no older than 120 seconds, and settlement pays the trader exactly as a manual close would. It has no admin rights and cannot touch user funds.
- Owner-only `setKeeper` can revoke the keeper instantly in one transaction if the wallet is ever compromised.
- Keeper wallet holds only gas POL, no collateral.
- Until step 7 completes, Live trades behave exactly as they do today.

## What I need from you to continue

Your approval of this sequence, then send transaction 1 from the owner wallet and tell me the resulting contract address.
