# Fix "Oracle Offline" in Live mode and the flickering page

## What I found (verified now, not guessed)

1. **The Polygon connection the app uses by default is dead.** The app falls back to
   `https://polygon-rpc.com/` because no dedicated Polygon connection is configured
   (only Supabase settings exist). That endpoint now answers
   `401 API key disabled, tenant disabled`, so every live-mode read fails and the
   badge shows "Oracle Offline".

2. **With a working connection, the price service is alive but incomplete.**
   Reading the live price contract through `polygon-bor-rpc.publicnode.com` succeeded:
   BTC/USD, ETH/USD and POL/USD all return fresh prices (under 35 seconds old).
   EUR/USD, GBP/USD, AUD/USD and XAU/USD have **no feed registered** on the live
   contract, yet the app lists them as live markets — so even after the connection
   is fixed the badge would read 3/7 and forex/gold live trades would be blocked.

3. **The flickering/glitching comes from the wallet balance loop.** The wallet reads
   your balance through the MetaMask extension's own connection, which is currently
   rate-limited ("RPC endpoint returned too many errors"). Each failure logs an
   error and re-renders, and a wallet-service warning fires repeatedly on every
   render as well.

## Plan

### 1. Reliable Polygon connection
- Add a multi-endpoint fallback list for live mode (publicnode, drpc, 1rpc) and
  drop the dead `polygon-rpc.com` from the default position, keeping any
  configured dedicated endpoint first.
- Use this shared list in the live price status badge, the price reader, and
  contract reads so one dead endpoint no longer takes live mode offline.

### 2. Honest live market list
- Keep EUR/USD, GBP/USD, AUD/USD and XAU/USD as signals-only in live mode until
  their feeds are actually registered on the live price contract, so the status
  badge reads 3/3 instead of 3/7 and no one can open a live trade with no price.
- Update the wording on the trade page accordingly (live: BTC, ETH, POL).
- Registering the four missing feeds is a separate on-chain step, done with your
  authorisation once you want forex live.

### 3. Stop the flicker
- Read the wallet balance through the app's own Polygon/Amoy connection instead of
  the browser extension, with a single retry and quiet failure (no error spam).
- Poll balance on a timer rather than on every render, and only log the
  wallet-service warning once.

## Technical notes
- `src/config/contracts.ts`: export `getRpcUrls(mode)` with ordered fallbacks; keep
  `getRpcUrl` as the first entry for compatibility.
- `src/components/trading/OracleStatus.tsx`, `src/hooks/useOraclePrice.ts`,
  `src/hooks/useMarketData.ts`: consume the fallback list; advance on failure.
- `src/config/markets.ts`: `V1_MAINNET_FOREX_MARKETS` → empty (documented) so
  `getMarketsForMode('live')` = BTC/ETH/POL; revert those metadata entries to
  `layer: 'signal'`.
- `src/wallet/WalletProvider.tsx`: `readBalance` uses `new Web3(getRpcUrl(mode))`,
  swallows transient RPC errors, guarded by a ref to avoid duplicate polls.
- `src/wallet/safePrivy.ts`: warn once via a module-level flag.
- Verify with `bunx tsgo --noEmit` and a scripted read of the live contract.
