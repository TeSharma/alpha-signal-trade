

## Network Enforcement for Polygon Amoy (chainId: 80002)

### Overview

All smart contracts are deployed on Polygon Amoy (80002), but the UI currently allows interactions on any chain. This causes JSON-RPC errors, failed approvals, and inconsistent wallet behavior. The fix introduces a centralized network enforcement layer with three levels of protection: a global banner, a shared hook, and per-component button guards.

---

### What Already Works (No Changes Needed)

- `TradingForm.tsx` and `TUSDFaucet.tsx` already check `chainId` at submission time (inline checks)
- `useWallet.ts` uses `eth_chainId` instead of the broken `net_version`
- `contracts.ts` already defines `CHAIN_IDS.amoy = 80002`

### What's Missing (Root Cause of Current Issues)

- No shared hook for network state -- each component re-implements detection
- No global warning banner when on the wrong network
- Transaction buttons remain **clickable** on wrong networks (check only runs on submit)
- `V2PositionsPanel` has zero network validation before closing positions
- `useOnChainTradingV2` has no chainId guard before any write call
- `OracleStatus` still touches MetaMask provider for `keccak256` hashing unnecessarily
- `WalletStatus` doesn't recognize Amoy or offer a "Switch Network" button
- `MobileHeader` has no wrong-network visual indicator

---

### Implementation Plan

#### Step 1: Add Amoy Network Config to `src/config/contracts.ts`

Add two new exports:
- `REQUIRED_CHAIN_ID = 80002`
- `AMOY_NETWORK_PARAMS` object with RPC URL, chain name, block explorer, and native currency for MetaMask's `wallet_addEthereumChain`

This centralizes the network definition so no component has to hardcode `0x13882`.

#### Step 2: Create `src/hooks/useNetworkEnforcement.ts`

A shared React hook that:
- Reads `eth_chainId` from `window.ethereum` on mount
- Listens to the `chainChanged` event for real-time updates
- Exports:
  - `isCorrectNetwork: boolean` (true only when chainId is 80002)
  - `currentChainId: number | null`
  - `networkName: string` (human-readable name for the connected chain)
  - `switchToAmoy()` function that calls `wallet_switchEthereumChain`, with a fallback to `wallet_addEthereumChain` if Amoy isn't in the wallet yet
  - `isWalletConnected: boolean` (whether any account is connected)

This eliminates all the duplicated `window.ethereum.request({ method: 'eth_chainId' })` calls scattered across components.

#### Step 3: Create `src/components/layout/NetworkGuard.tsx`

A global component that renders a warning banner **only** when:
- A wallet is installed AND connected
- The connected chain is NOT Amoy (80002)

The banner will:
- Display: "You are connected to [Network Name]. Please switch to Polygon Amoy to use this dApp."
- Show a "Switch to Polygon Amoy" button that triggers `switchToAmoy()`
- Use amber/yellow styling to be visible but not block the entire page
- Automatically hide once the user switches to the correct network

#### Step 4: Wire NetworkGuard into `src/App.tsx`

Add `<NetworkGuard />` inside the `BrowserRouter`, above `<Routes>`, so it appears on every page when triggered.

#### Step 5: Guard Transaction Buttons (Per-Component)

Each component that triggers a blockchain write will import `useNetworkEnforcement` and:

**`TradingForm.tsx`**
- Disable the "Place Trade" button when `!isCorrectNetwork`
- Show inline text: "Switch to Polygon Amoy to trade"
- Remove the existing inline `chainId` check (lines 132-145) since the hook handles it

**`TUSDFaucet.tsx`**
- Disable the "Claim" button when `!isCorrectNetwork`
- Show inline text: "Switch to Polygon Amoy to claim"
- Remove the inline `chainId` check (lines 138-146)

**`V2PositionsPanel.tsx`**
- Disable the "Close Position" button when `!isCorrectNetwork`
- This component currently has NO network check at all

**`WalletStatus.tsx`**
- Add Amoy (80002) to the `getNetworkName` mapping
- Show a "Wrong Network" warning badge when connected but not on Amoy
- Add a "Switch to Amoy" button using `switchToAmoy()`

**`MobileHeader.tsx`**
- Show a small red dot and "Wrong Network" label next to the wallet icon when not on Amoy

#### Step 6: Last Line of Defense in `useOnChainTradingV2.ts`

Add a `chainId` check at the top of both `openPosition` and `closePosition`:
- Read `eth_chainId` from `window.ethereum`
- If it's not `0x13882`, show a toast ("Please switch to Polygon Amoy") and return `null`
- This catches any edge case where the UI guard was bypassed

#### Step 7: Fix `OracleStatus.tsx` `computePairId` Issue

The `computePairId` function in `useOnChainTradingV2.ts` and `OracleStatus.tsx` creates `new Web3(window.ethereum)` just to call `keccak256`. This unnecessarily touches the MetaMask provider. Change it to use `new Web3()` (no provider needed for utility functions) or the public RPC instance.

---

### Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/config/contracts.ts` | Edit | Add `REQUIRED_CHAIN_ID` and `AMOY_NETWORK_PARAMS` |
| `src/hooks/useNetworkEnforcement.ts` | Create | Shared hook for chainId detection, switch function |
| `src/components/layout/NetworkGuard.tsx` | Create | Global wrong-network warning banner |
| `src/App.tsx` | Edit | Add `<NetworkGuard />` inside router |
| `src/components/trading/TradingForm.tsx` | Edit | Disable button + remove inline check |
| `src/components/wallet/TUSDFaucet.tsx` | Edit | Disable button + remove inline check |
| `src/components/trading/V2PositionsPanel.tsx` | Edit | Disable "Close Position" button |
| `src/components/wallet/WalletStatus.tsx` | Edit | Add Amoy name, wrong-network badge, switch button |
| `src/components/layout/MobileHeader.tsx` | Edit | Add wrong-network indicator |
| `src/hooks/useOnChainTradingV2.ts` | Edit | Add chainId guard in write functions, fix computePairId |
| `src/components/trading/OracleStatus.tsx` | Edit | Fix computePairId to not use MetaMask provider |

---

### Expected Results After Implementation

- No more JSON-RPC / net_version errors from wrong-chain interactions
- All transaction buttons (trade, approve, faucet, close position) are disabled when on wrong network
- A persistent banner tells users exactly what to do and offers one-click switching
- MetaMask will prompt to add Polygon Amoy if it's not configured
- UI re-enables automatically once the user switches to the correct chain
- No accidental Ethereum Mainnet contract interactions

