

## Audit: Trading and Funding Rules vs. Current Implementation

This plan identifies the gaps between your non-negotiable rules and the current codebase, then details exactly what needs to change.

---

### Rule-by-Rule Assessment

#### Rule 1: Network Enforcement (Polygon Amoy Only)
**Status: Mostly Implemented -- 2 gaps remain**

What works:
- Global `NetworkGuard` banner in `App.tsx` warns when on wrong chain
- `useNetworkEnforcement` hook provides `isCorrectNetwork` and `switchToAmoy()`
- `TradingForm.tsx` disables the submit button when `!isCorrectNetwork` (live mode)
- `TUSDFaucet.tsx` blocks claim when wrong network
- `V2PositionsPanel.tsx` disables Close button when wrong network
- `useOnChainTradingV2.ts` has `enforceNetwork()` check in `openPosition`, `closePosition`, and `liquidatePosition`

Gaps:
- **MobileTradingInterface.tsx** has NO network enforcement at all -- the submit button is never disabled for wrong network, no inline warning, and no `useNetworkEnforcement` import. It manages its own `currentChainId` state separately instead of using the shared hook.
- **WalletStatus.tsx** shows "ETH" as the native balance label instead of "MATIC" when on Amoy.

#### Rule 2: Token Roles (MATIC = gas, tUSD = money)
**Status: Correctly implemented in trading logic, minor labeling issue**

What works:
- All trading contracts use tUSD (TokenizedCurrency) as margin/collateral
- Approval flow is tUSD-only
- Balance checks reference tUSD for trade sizing

Gap:
- **WalletStatus.tsx** line 122 shows `{balance} ETH` -- should show `MATIC` when on Polygon Amoy to avoid user confusion about which token is gas.

#### Rule 3: Trading Preconditions
**Status: Partially implemented -- oracle freshness not checked before enabling the button**

What works:
- Wallet connection check exists in `TradingForm` and `MobileTradingInterface`
- Network check exists in `TradingForm` (missing in mobile)
- tUSD balance is checked before submission
- MATIC balance is not explicitly checked, but gas estimation will fail if zero

Gaps:
- **No MATIC balance pre-check**: Neither form checks if the user has MATIC > 0 for gas before attempting a trade. The trade will fail at MetaMask with a confusing "insufficient funds for gas" error. A clear pre-check with actionable guidance ("Get free MATIC from Polygon Faucet") would be better.
- **Oracle freshness is not gating the button**: The preflight check runs AFTER the user clicks "Place Trade." If the oracle is offline or stale, the user gets an error toast only after clicking. The oracle status should disable the button proactively.
- **MobileTradingInterface** is missing all of these checks entirely in its submit button `disabled` logic.

#### Rule 4: Oracle Requirement
**Status: Backend enforcement exists, UI enforcement is reactive only**

What works:
- `preflightCheck()` in `useOnChainTradingV2.ts` validates oracle feed presence and staleness before `openPosition`
- `OracleStatus.tsx` monitors feeds with green/yellow/red indicators
- The trading contract itself will revert on stale prices

Gaps:
- The **TradingForm submit button is not disabled** when oracle is offline/stale -- it only shows an error after the user clicks
- `MobileTradingInterface` has no oracle gating at all
- `useMarketData` exposes `oracleAvailable` but this is not used to gate trading actions

#### Rule 5: Cross-Chain Funding (Tron as Bridge Only)
**Status: Correctly architected -- Tron never touches trading contracts**

What works:
- `TronWalletConnect` only shows USDT/TRX balances (no trading actions)
- `DepositInterface` accepts USDT deposits from Tron, stores them in Supabase as pending
- `WithdrawalInterface` handles withdrawals to Tron or Polygon
- Trading contracts are only on Polygon Amoy
- Tron wallet has zero integration with `useOnChainTradingV2`

Gap:
- The deposit/withdrawal flow references "USDT" but doesn't explicitly mention the tUSD mint/burn concept to the user. This is a UX clarity issue, not a security issue. The actual bridge logic (USDT to tUSD conversion) would need a backend service that isn't built yet.

#### Rule 6: UI Enforcement
**Status: Partially implemented -- oracle status not gating buttons**

What works:
- Wrong network: buttons disabled + banner shown + switch button
- TradingForm shows inline "Switch to Polygon Amoy to trade" warning

Gaps:
- Oracle offline/stale does NOT disable buttons (only caught after click)
- MobileTradingInterface has no network or oracle warnings/guards
- No banner for "Oracle offline -- trading paused"

#### Rule 7: Last-Line Defense
**Status: Fully implemented**

- `enforceNetwork()` checks `eth_chainId === 0x13882` before `openPosition`, `closePosition`, and `liquidatePosition`
- Returns null and shows toast on wrong network
- This is the final safety net and it's solid

---

### Implementation Plan

#### 1. Add Network + Oracle Enforcement to MobileTradingInterface

This is the biggest gap. `MobileTradingInterface.tsx` currently has:
- No `useNetworkEnforcement` import
- Its own manual `currentChainId` state management
- No disabled state on the submit button for wrong network
- No oracle status gating

Changes:
- Import and use `useNetworkEnforcement` hook (replace the manual `currentChainId` state)
- Import `useMarketData`'s `oracleAvailable` status
- Disable the sticky submit button when `!isCorrectNetwork` (live mode)
- Disable the sticky submit button when oracle is offline (live mode)
- Show inline warning when on wrong network: "Switch to Polygon Amoy to trade"
- Show inline warning when oracle offline: "Oracle offline -- trading paused"
- Add a "Switch Network" button in the warning area

#### 2. Add Oracle-Gated Trading to TradingForm

The desktop `TradingForm` already gates on network but not oracle status.

Changes:
- Use the `oracleAvailable` flag from `useMarketData` (already imported)
- Add an `oracleHealthy` check that considers if the selected pair has a fresh oracle price
- Disable the submit button in live mode when oracle is unavailable for the selected pair
- Show inline warning: "Oracle price unavailable for [PAIR] -- trading paused"
- Keep the existing preflight check as a second layer of defense

#### 3. Add MATIC Gas Balance Check

Neither trading form checks if the user has MATIC for gas fees.

Changes in `useOnChainTradingV2.ts`:
- Add a `getMaticBalance` function that reads the native balance via `web3.eth.getBalance(account)`
- Export it alongside `getCollateralBalance`

Changes in `TradingForm.tsx` and `MobileTradingInterface.tsx`:
- Fetch MATIC balance alongside tUSD balance in the `useEffect`
- Before submission: if MATIC balance is 0 or very low (< 0.001), show a specific error: "You need MATIC for gas fees. Get free MATIC from the Polygon Faucet" with a link
- Show a warning badge in the trade summary when MATIC is low

#### 4. Fix WalletStatus Native Token Label

Change `{balance} ETH` to show the correct native token based on network:
- On Polygon Amoy (80002): show `MATIC`
- On Ethereum (1): show `ETH`
- Default: show the native token name for the connected chain

#### 5. Add Oracle Health Banner (Optional Enhancement)

Add oracle health awareness to the `NetworkGuard` component or create a sibling `OracleGuard` component:
- When oracle status is "unavailable" and user is on a trading page, show an amber banner: "Price oracle is offline. Live trading is temporarily paused."
- This complements the per-component button disabling

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/trading/MobileTradingInterface.tsx` | Add `useNetworkEnforcement`, oracle gating, MATIC check, disable submit button, inline warnings |
| `src/components/trading/TradingForm.tsx` | Add oracle-gated button disable, MATIC balance check and warning |
| `src/hooks/useOnChainTradingV2.ts` | Add `getMaticBalance()` function |
| `src/components/wallet/WalletStatus.tsx` | Change "ETH" label to "MATIC" on Polygon networks |

### Files Already Correct (No Changes Needed)

| File | Status |
|------|--------|
| `src/config/contracts.ts` | REQUIRED_CHAIN_ID, AMOY_NETWORK_PARAMS correct |
| `src/hooks/useNetworkEnforcement.ts` | Hook fully functional |
| `src/components/layout/NetworkGuard.tsx` | Global banner working |
| `src/App.tsx` | NetworkGuard wired in |
| `src/components/wallet/TUSDFaucet.tsx` | Network gated correctly |
| `src/components/trading/V2PositionsPanel.tsx` | Close button gated correctly |
| `src/components/trading/OracleStatus.tsx` | Uses provider-less Web3, public RPC |
| `src/components/wallet/TronWalletConnect.tsx` | Bridge-only, no trading contact |
| `src/components/wallet/DepositInterface.tsx` | Tron deposit flow correct |
| `src/components/wallet/WithdrawalInterface.tsx` | Withdrawal flow correct |
| `src/hooks/useMarketData.ts` | Public RPC reads, oracle fallback correct |

---

### Summary of Gaps Being Fixed

1. **MobileTradingInterface** -- the biggest hole: no network guard, no oracle guard, no MATIC check
2. **Oracle not gating buttons** -- users can click "Place Trade" when oracle is offline (desktop and mobile)
3. **No MATIC gas pre-check** -- users get confusing MetaMask errors instead of a clear "get MATIC" message
4. **WalletStatus shows "ETH"** instead of "MATIC" on Polygon networks

After these changes, every rule in your specification will be enforced at the UI layer, with the existing `enforceNetwork()` in `useOnChainTradingV2.ts` serving as the last-line defense.

