
## Fix Preflight Check "Failed to Fetch" Error

### Problem Identified
The preflight check in `useOnChainTradingV2.ts` is failing with a generic "failed to fetch" error. This is caused by:

1. **RPC Connectivity Issues**: The public Amoy RPC (`https://rpc-amoy.polygon.technology/`) may be rate-limited or experiencing intermittent failures
2. **Error Message Extraction**: The current error handling shows the raw error message which is often just "failed to fetch" from network failures
3. **OracleStatus Still Using MetaMask**: The `OracleStatus.tsx` component is still making calls through MetaMask's provider, which contributes to RPC overload

### Solution

**Step 1: Add RPC Fallback and Retry Logic**
Update `useOnChainTradingV2.ts` to:
- Add an alternate public RPC endpoint as fallback
- Implement a simple retry mechanism (1-2 retries) for preflight checks
- Improve error messages to distinguish network errors from oracle errors

```typescript
// Add alternate RPC endpoints
const RPC_ENDPOINTS = [
  'https://rpc-amoy.polygon.technology/',
  'https://polygon-amoy.drpc.org/',
  'https://polygon-amoy-bor-rpc.publicnode.com'
];

// Create web3 instance with fallback
const getReadOnlyWeb3 = async (retryCount = 0): Promise<Web3> => {
  const endpoint = RPC_ENDPOINTS[retryCount % RPC_ENDPOINTS.length];
  return new Web3(endpoint);
};
```

**Step 2: Make Preflight Check More Resilient**
Wrap the preflight check with better error handling:
- Catch network errors separately from contract reverts
- If `hasFeed` call fails, try a simple RPC health check first
- Show user-friendly messages like "Network temporarily unavailable, retrying..."

**Step 3: Update OracleStatus to Use Public RPC**
The `OracleStatus.tsx` component currently uses `window.ethereum` for all oracle reads. Update it to:
- Use the public RPC for read operations
- Reduce the frequency of oracle checks to minimize load

**Step 4: Add Preflight Bypass Option (Optional)**
For cases where preflight keeps failing but the user wants to try anyway:
- Add a "Skip Preflight" option after 2-3 failed attempts
- Show a warning that the trade may fail on-chain

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useOnChainTradingV2.ts` | Add RPC fallback array, retry logic, improved error messages |
| `src/components/trading/OracleStatus.tsx` | Switch to public RPC for reads |

### Expected Result
- Preflight checks will be more reliable with RPC fallbacks
- Error messages will be clearer (e.g., "Unable to reach blockchain - check network connection")
- OracleStatus won't contribute to MetaMask provider overload
- Trades can proceed when the oracle is reachable
