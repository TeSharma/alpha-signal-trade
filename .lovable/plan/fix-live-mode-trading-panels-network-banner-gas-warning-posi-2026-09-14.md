# Fix Live-mode trading panels: network banner, gas warning, positions and history

No contracts, oracle registrations, Chainlink feeds, risk engine or execution logic are touched. All seven live markets and the USD/JPY signals-only rule stay exactly as they are. Demo mode behaviour is unchanged.

## Diagnosis (from reading the code)

**1. Open Positions (V2) — confirmed root cause.** `src/pages/Trade.tsx:87` renders `<V2PositionsPanel />` with no mode, and the component itself has no mode prop. Inside it calls `useOnChainTradingV2()` and `useNetworkEnforcement()` with **no argument**, and both hooks default to `'demo'` (`useOnChainTradingV2.ts:280`, `useNetworkEnforcement.ts:14`). So while you are in Live mode, this panel reads the **Amoy testnet** TradingPlatformV2 address and treats Amoy as the required chain.

On top of that, its read path (`getUserOpenPositions` → `getWeb3AndAccount`, `useOnChainTradingV2.ts:325`) calls `requestAccounts()` on the wallet before every read. If that promise never settles (wallet prompt not appearing — exactly what you saw), `isRefreshing` stays `true` and the component renders skeletons forever (`V2PositionsPanel.tsx:113`). Every failure is swallowed with `console.error` and returns `[]`, so a real error is indistinguishable from "no positions". There is no error state and no retry.

**2. "Low gas token balance" — confirmed mechanism.** `TradingForm.tsx:102` shows the warning when `maticBalance < 0.001`. `maticBalance` comes from `getMaticBalance()` (`useOnChainTradingV2.ts:539`), which also goes through `getWeb3AndAccount` → `requestAccounts`; on any throw it returns `'0'`, which trips the warning. It is fetched once in an effect keyed on `accountMode` (`TradingForm.tsx:81`) and never re-fetched when the wallet connects or the chain changes — so if the wallet was not ready at that moment the value stays `'0'` regardless of your real 14.0125 POL. Meanwhile the wallet provider already polls a correct native balance over our own RPC for the connected chain (`WalletProvider.tsx:239-257`).

**3. "Switch to Polygon Mainnet to trade" — cause not yet confirmed.** `TradingForm` does pass the mode correctly (`TradingForm.tsx:67`), so the banner means `useNetworkEnforcement` saw a chain ID other than 137 from the wallet context. Two candidates, and I will not guess: either the wallet genuinely is on another chain, or the chain ID never got set (the rehydrate path at `WalletProvider.tsx:270-276` tolerates a failed `eth_chainId` read and leaves it `null`, and `null` fails the `=== 137` comparison). Step 1 of the work is to read the live value and settle this before changing the comparison.

Why oracle prices still show 7/7 while the banner appears: every oracle read uses a read-only connection to our own Polygon RPC, independent of the wallet's chain. So prices are correct even when the wallet's chain is wrong or unknown.

**4. Trade History.** It is not on-chain at all — it reads your trades from the database (`useTrades.ts`) and filters by `account_mode`. Two real defects: `useTrades` exposes a `loading` flag that `TradeHistory` ignores, so a still-loading list renders as "no trades"; and `TradeHistory.tsx:21` calls `useMarketData()` with no mode, so in Live mode it prices open trades with demo feeds instead of oracle prices.

**5. Testnet leak check.** `src/hooks/useTokenContracts.ts:41-54` hardcodes Amoy addresses (`TRADING_PLATFORM_ADDRESS`, `ORACLE_ADDRESS`, tUSD). Those are used by the faucet and legacy token panels, which are testnet-only by design — they stay. `contracts.ts` is already mode-aware and correct. The only accidental Live-mode leak is the missing mode on the components/hooks named above.

## Changes

1. **`src/wallet/WalletProvider.tsx`** — log the detected chain ID once on rehydrate/connect and re-read it if the first `eth_chainId` read fails, so a `null` chain ID can't masquerade as "wrong network". Then confirm the actual value in the preview before touching any comparison.
2. **`src/pages/Trade.tsx` and `src/components/trading/MobileTradingInterface.tsx`** — pass `accountMode` into `V2PositionsPanel`.
3. **`src/components/trading/V2PositionsPanel.tsx`** — accept `accountMode`, forward it to `useOnChainTradingV2(accountMode)` and `useNetworkEnforcement(accountMode)`; replace the ad-hoc flags with four explicit states: loading indicator, data, "No open positions" empty state, and an error card showing the real message plus a Retry button.
4. **`src/hooks/useOnChainTradingV2.ts`** — for **read-only** calls (`getUserOpenPositions`, `getAllUserPositions`, `getPosition`, `getMaticBalance`, `getCollateralBalance`) use the mode's read-only RPC with the already-known connected address instead of `requestAccounts`, and let read failures reject with the extracted message instead of returning `[]`/`'0'`. Write paths (`openPosition`, `closePosition`, approvals, network enforcement) are untouched.
5. **`src/components/trading/TradingForm.tsx` + `MobileTradingInterface.tsx`** — take the gas balance from the wallet context's polled native balance for the connected chain, and only show "Low gas" once a balance has actually been read (never on an unknown/failed read). Threshold stays 0.001.
6. **`src/components/trading/TradeHistory.tsx`** — pass `accountMode` to `useMarketData`, and use the existing `loading` flag so the panel shows a loading state, then either trades or the existing empty state.

## Verification

Typecheck, production build, and the existing test suite. Then in the preview, Live mode: Oracle Active 7/7 with all seven markets, USD/JPY still signals-only, no false network banner, gas warning matching the real POL balance, Open Positions resolving to a proper empty state, Trade History resolving to trades or its empty state, and Demo mode behaving as before. No transactions, no deployments.

## Remaining unknown

The exact reason for the network banner is confirmed only after reading the live chain ID (step 1). If the wallet turns out to genuinely be on Amoy, the banner is correct behaviour and the fix is limited to the other items — I will report that rather than suppress the warning.
