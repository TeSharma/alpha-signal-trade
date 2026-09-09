# Enable Forex On-Chain Trading & Close Mainnet Oracle Gaps

## Goal
Give you a pitch-ready, fact-based answer about how forex on-chain execution will work after deployment, and close the small gaps so the claim is defensible in a live demo.

## Verified current state
- `TradingPlatformV2` is a single-collateral CFD engine. It takes USDC/tUSD margin, opens a leveraged position against a `bytes32 pairId`, and settles PnL in the same collateral token. It does **not** mint or trade tokenized currency pairs.
- `PriceOracleV2` maps `keccak256(pair)` → Chainlink aggregator address and calls `latestRoundData()`.
- Amoy v2 deployment already has Chainlink feeds registered for EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD and the test fetch in `deploy-v2.js` returns prices.
- `src/config/markets.ts` still labels forex pairs as `layer: 'signal'` and describes them as "AI Signals Only"; `V2_FOREX_PAIRS` is commented as "v2 roadmap pairs (not yet available)".
- Mainnet deploy script `scripts/deploy-mainnet.js` only registers BTC/USD, ETH/USD, POL/USD. It does **not** register forex feeds, and it does not register XAU/USD.
- `TokenizedCurrency.sol` exists, but the current V2 trading engine only uses it as the collateral token (tUSD on Amoy, USDC on mainnet). Currency-pair tokenization is **not** part of the V2 execution path.

## Proposed on-chain forex execution method
Use the same architecture as crypto on-chain trading:
1. Trader deposits/approves USDC (mainnet) or tUSD (Amoy).
2. Frontend calls `TradingPlatformV2.openPosition(keccak256("EUR/USD"), isLong, margin, leverage, stopLoss, takeProfit)`.
3. Contract calls `PriceOracleV2.getPrice(pairId)`, which reads the Chainlink forex aggregator.
4. PnL is calculated and settled in the single collateral token.

No tokenized EUR, GBP, or JPY is needed. The pair is just a price feed reference, and the position is a synthetic/CFD contract.

## Confidence level per pair source
- **Amoy testnet**: High. Seven forex feeds are already registered and the deployment script verifies prices.
- **Polygon mainnet forex**: Medium-High. Chainlink publishes Polygon mainnet feeds for the same G10 pairs (addresses were in the older `scripts/deploy.js`), but `deploy-mainnet.js` currently omits them. They must be added before mainnet deployment.
- **XAU/USD on mainnet**: Medium. Chainlink has a gold feed on Polygon mainnet, but it is not currently in any deploy script and must be sourced and tested.
- **Exotic/non-G10 pairs**: Low without explicit feed sourcing. The current scope is G10 forex + gold.

## Work to close the gaps
1. **Update `scripts/deploy-mainnet.js`** to register Polygon mainnet Chainlink feeds for EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD (and XAU/USD once the address is confirmed).
2. **Update `src/config/markets.ts`** to move the V2 forex pairs from `layer: 'signal'` to `layer: 'on-chain'` for demo/live mode, and remove the "AI Signals Only" description.
3. **Update `getMarketsForMode('live')`** to include the forex pairs once mainnet feeds are registered.
4. **Verify feed availability** on Polygon mainnet by running `deploy-mainnet.js` (or a dry-run price check) before the pitch.
5. **Add XAU/USD** either as a Chainlink feed on mainnet or, as a fallback, keep it signal-only until a verifiable on-chain feed is confirmed.
6. **Run a demo trade** on Amoy for at least one forex pair (e.g. EUR/USD) to prove the end-to-end flow works.

## What to tell investors tomorrow
- "Forex execution uses the same smart-contract engine as crypto: Chainlink oracles, single USDC collateral, synthetic positions. No separate tokenized currencies."
- "It is already deployed and working on Amoy testnet for seven G10 pairs. Mainnet activation is a matter of registering the existing Chainlink Polygon feeds — the contracts are ready."
- "Gold (XAU/USD) is currently signals-only until we confirm the mainnet Chainlink gold feed in the deployment script."

## Risks
- Chainlink feed addresses must be double-checked on Polygon mainnet; testnet addresses cannot be reused.
- If a feed is stale or missing at trade time, the contract reverts (`block.timestamp - updatedAt <= priceTimeout`).
- Frontend currently blocks forex from live mode; enabling it requires config changes, not contract changes.
