# Wire EUR, GBP, AUD and Gold to Chainlink (verification complete, nothing submitted)

## Answer to your question first

There is no Pyth wiring anywhere in the project, and no second price source. The on-chain price contract reads Chainlink aggregators only. On the live network only Bitcoin, Ethereum and POL were ever registered on it — Euro, Pound, Aussie and Gold were never added, which is why they show as signals-only.

## Read-only verification, taken live just now

Chain: Polygon mainnet. Price contract: `0xf61e4881f363b30384dfbcf1c72845cce94d4f9f`.
Nothing was signed, deployed or changed.

| Pair | Aggregator address | Description | Dec | Answer | Round ID | Updated (UTC) | Age | Fresh vs 120s | Registered now |
|---|---|---|---|---|---|---|---|---|---|
| EUR/USD | 0x73366Fe0AA0Ded304479862808e02506FE556a98 | "EUR / USD" | 8 | 1.156925 | 36893488147423531679 | 2026-09-14 03:48:07 | 17s | Yes | No |
| GBP/USD | 0x099a2540848573e94fb1Ca0Fa420b00acbBc845a | "GBP / USD" | 8 | 1.350395 | 36893488147422742904 | 2026-09-14 03:48:09 | 15s | Yes | No |
| AUD/USD | 0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f | "AUD / USD" | 8 | 0.71483 | 36893488147423483918 | 2026-09-14 03:48:25 | ~0s | Yes | No |
| XAU/USD | 0x0C466540B2ee1a31b441671eac0ca886e051E410 | "XAU / USD" | 8 | 4329.342 | 36893488147422953609 | 2026-09-14 03:48:06 | 18s | Yes | No |

Already live and untouched by this plan: BTC/USD (77,522.86, 8s), ETH/USD (2,509.79, 11s), POL/USD (0.0960703, 6s — note the aggregator still self-describes as "MATIC / USD", the standard post-rename behaviour).

Confirmations:
- Quote direction matches ShTrader naming exactly on all four (base/USD, no inversion needed). This is why Yen, Franc, Kiwi and Canadian dollar are excluded — their feeds are quoted the other way round.
- All four expose the same `AggregatorV3Interface` (`version` 6, 8 decimals), identical to the three already registered, so they are interface-compatible.
- Heartbeat is not readable on-chain; observed ages of 0–18s are far inside the 120s window, and all four are in the same Chainlink deviation-threshold family as the live crypto feeds.
- No price-contract redeployment needed — registration is a normal owner call on the existing contract.
- No trading-contract modification needed. It reads `oracle` = `0xf61E4881F363b30384DFbcf1C72845CcE94d4f9f`, `collateralToken` = USDC `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`, `priceTimeout` = 120 seconds.
- Owner/admin of both contracts: `0x09C2B58F6004176bD83cc000d804eD3c1041754E` (balance 73.66 POL).

## The exact transaction — one transaction, not four

Single call to `PriceOracleV2.setPriceFeeds(bytes32[] pairIds, address[] feedAddresses)` on `0xf61e4881f363b30384dfbcf1c72845cce94d4f9f`, from the owner above.

```text
pairIds[0] 0xa9226449042e36bf6865099eec57482aa55e3ad026c315a0e4a692b776c318ca  (keccak256 "EUR/USD")
pairIds[1] 0xfd121bde813a3463e16ad2a4ea4103a6a122fbe2cdb07a80d4d293be07bb29fa  (keccak256 "GBP/USD")
pairIds[2] 0xf4940d379cdb765b9e0430725c0c9efb14a767ce50a687ac4658cce705407380  (keccak256 "AUD/USD")
pairIds[3] 0x85de9facb9f703cb8b77bca3163eb0ad1780f77bf724319b6e5c67b12837e086  (keccak256 "XAU/USD")

feedAddresses[0] 0x73366Fe0AA0Ded304479862808e02506FE556a98
feedAddresses[1] 0x099a2540848573e94fb1Ca0Fa420b00acbBc845a
feedAddresses[2] 0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f
feedAddresses[3] 0x0C466540B2ee1a31b441671eac0ca886e051E410
```

The function only writes the four new slots; BTC, ETH and POL entries are not touched.

Estimated cost: roughly 190,000–210,000 gas. At the current Polygon fee (~274 gwei, max ~417 gwei) that is about 0.055–0.088 POL, under one US cent at today's POL price.

## Blocked on you

I cannot sign this — the project has no Polygon private key or RPC credential configured, and I will never ask for one. You execute it from the owner wallet (Polygonscan "Write Contract", or your own Hardhat setup running `scripts/register-mainnet-forex-feeds.js`, which this plan adds as a read-and-report + submit script you run locally).

## App-side work I do after you confirm the transaction landed

1. Re-run the read-only check and confirm all seven report registered with fresh prices.
2. `src/config/markets.ts` — repopulate `V1_MAINNET_FOREX_MARKETS` with the four pairs and flip their metadata back to on-chain, so Live mode lists them.
3. `src/components/trading/MarketOverview.tsx` — restore the Live-mode note that Euro, Pound, Aussie and Gold trade on-chain, Yen stays signals-only.
4. Confirm the price badge reads 7 of 7 in Live mode.

## Phase 2 (Pyth) — not started, separate approval

For Yen, Franc, Kiwi and Canadian dollar, Chainlink on Polygon quotes them inverted, so they need either an inversion path in the price contract or a Pyth adapter. Both mean new contract code and a deployment, so I will bring that as its own plan once phase 1 is live. Nothing about Pyth is being built now.
