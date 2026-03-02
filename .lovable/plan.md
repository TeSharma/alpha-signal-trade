

## Fix Oracle Crash: Empty Address Guards

### Problem
Components crash with "Contract address not specified" because `CONTRACT_ADDRESSES.polygon` has empty strings. When any code path evaluates live-mode addresses (or components don't pass `accountMode`), Web3 throws on contract instantiation.

### Changes

#### 1. `src/hooks/useOnChainTradingV2.ts`
- Add early guards in `getTradingContract`, `getOracleContract`, `getCollateralContract` -- return `null` if the address is empty
- Add guard in `preflightCheck` to return failure if oracle address is empty
- Add guard in `ensureApproval` to check collateral address

#### 2. `src/hooks/useMarketData.ts`
- The oracle address guard at line 78 already exists but only checks for zero address. Also check for empty string `''` explicitly (polygon addresses are `""` not `"0x0..."`).

#### 3. `src/components/trading/V2PositionsPanel.tsx`
- Currently calls `useOnChainTradingV2()` with no `accountMode` argument (defaults to `'demo'`). This is fine for now since demo is the default, but add a guard in `fetchPositions` to skip if contract addresses are empty.
- Pass `accountMode` prop down (or accept it defaults to demo).

#### 4. `src/components/trading/TokenBalances.tsx`
- Currently hardcoded to `CONTRACT_ADDRESSES.amoy` via `useTokenContracts`. This is fine -- amoy addresses exist. No change needed here.

#### 5. `src/components/trading/AccountBalance.tsx`
- No direct contract calls -- delegates to `useTrades` and `useApp`. No change needed.

### Technical Details

The guard pattern for contract factories:

```typescript
const getTradingContract = useCallback((web3: Web3) => {
  if (!TRADING_PLATFORM_V2_ADDRESS) return null;
  return new web3.eth.Contract(TRADING_PLATFORM_V2_ABI as any, TRADING_PLATFORM_V2_ADDRESS);
}, [TRADING_PLATFORM_V2_ADDRESS]);
```

Then every caller of these functions checks for `null` before proceeding:

```typescript
const contract = getTradingContract(web3);
if (!contract) {
  return { success: false, error: 'Contracts not deployed on this network' };
}
```

### Files to Modify

| File | Change |
|---|---|
| `src/hooks/useOnChainTradingV2.ts` | Null-guard all 3 contract factory functions + callers |
| `src/hooks/useMarketData.ts` | Add empty string check to oracle address validation |
| `src/components/trading/V2PositionsPanel.tsx` | Guard `fetchPositions` against null contracts |

### What This Fixes
- No more "Contract address not specified" console errors
- Oracle status correctly shows "unavailable" for live mode (no contracts deployed) without crashing
- Demo mode continues working with real Amoy addresses via the Alchemy RPC secrets you just added

