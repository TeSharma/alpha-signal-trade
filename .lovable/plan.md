

## Integrate Dedicated Alchemy RPC Across the Codebase

### What This Does

Replaces all hardcoded public Polygon Amoy RPC URLs with your dedicated Alchemy endpoints. This fixes the `ConnectTimeoutError` (UND_ERR_CONNECT_TIMEOUT) that causes oracle offline, faucet failures, and trade reverts.

### Your Alchemy URLs

- **Amoy (testnet):** `https://polygon-amoy.g.alchemy.com/v2/Jpq0TNEHUNI4RVlVQyH6P`
- **Mainnet:** `https://polygon-mainnet.g.alchemy.com/v2/Jpq0TNEHUNI4RVlVQyH6P` (saved for future use)

---

### Changes

#### 1. Environment Variable (`.env`)

Add `VITE_ALCHEMY_AMOY_RPC` so the Alchemy URL is available in the browser bundle.

#### 2. Centralized RPC Export (`src/config/contracts.ts`)

Add a single `AMOY_RPC_URL` export that reads from the env var, with the public RPC as fallback:

```text
AMOY_RPC_URL = env var || public fallback
```

Also update `AMOY_NETWORK_PARAMS.rpcUrls` to use this value (what MetaMask gets when adding the network).

#### 3. Update 5 Files to Import `AMOY_RPC_URL`

| File | Current RPC Source | Change |
|---|---|---|
| `src/hooks/useMarketData.ts` | Hardcoded `PUBLIC_RPC` string (line 6) | Import `AMOY_RPC_URL` from contracts config |
| `src/hooks/useOraclePrice.ts` | Hardcoded `PUBLIC_RPC` string (line 6) | Import `AMOY_RPC_URL` from contracts config |
| `src/hooks/useOnChainTradingV2.ts` | 3-endpoint `RPC_ENDPOINTS` array (lines 7-11) | Alchemy as primary, keep 2 public fallbacks |
| `src/components/trading/OracleStatus.tsx` | 3-endpoint `RPC_ENDPOINTS` array (lines 16-20) | Alchemy as primary, keep 2 public fallbacks |
| `src/utils/web3.ts` | Hardcoded `JsonRpcProvider("https://rpc-amoy...")` (line 10) | Import `AMOY_RPC_URL` from contracts config |

#### 4. Fallback Strategy (for files with multi-endpoint arrays)

`useOnChainTradingV2.ts` and `OracleStatus.tsx` keep their retry logic but now use:

```text
Position 1: Alchemy (primary - fast, reliable)
Position 2: dRPC (fallback)
Position 3: PublicNode (last resort)
```

### Files Modified

| File | Lines Changed |
|---|---|
| `.env` | Add 1 line |
| `src/config/contracts.ts` | Add 2 lines (export + update rpcUrls) |
| `src/hooks/useMarketData.ts` | 2 lines (import + replace PUBLIC_RPC) |
| `src/hooks/useOraclePrice.ts` | 2 lines (import + replace PUBLIC_RPC) |
| `src/hooks/useOnChainTradingV2.ts` | 2 lines (import + update RPC_ENDPOINTS[0]) |
| `src/components/trading/OracleStatus.tsx` | 2 lines (import + update RPC_ENDPOINTS[0]) |
| `src/utils/web3.ts` | 2 lines (import + replace hardcoded URL) |

### What Does NOT Change

- Trading logic, PnL, margin, fees -- untouched
- Network enforcement -- untouched
- Oracle gating -- untouched
- Hardhat config (`hardhat.config.cjs`) -- already reads `AMOY_RPC_URL` from process.env; set it in your local `.env` for scripts

