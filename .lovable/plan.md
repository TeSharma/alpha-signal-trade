
## Demo = Amoy, Live = Mainnet: Full Mode-Aware Implementation

### Overview

This makes the Demo/Live toggle a **network switch**: Demo uses Polygon Amoy (testnet), Live uses Polygon Mainnet (production). Each mode gets its own chain ID, RPC, contracts, markets, and feature gates. AI Forex signals remain always-on and completely independent of mode or network state.

### Architecture

```text
+------------------+----------------------------+-----------------------------+
|                  | DEMO MODE                  | LIVE MODE                   |
+------------------+----------------------------+-----------------------------+
| Network          | Polygon Amoy (80002)       | Polygon Mainnet (137)       |
| RPC              | Alchemy Amoy               | Alchemy Polygon Mainnet     |
| Gas Token        | MATIC (testnet)            | POL (mainnet)               |
| Collateral       | tUSD (test token)          | USDC / prod tUSD (future)   |
| Markets          | POL/USD only               | BTC/USD, ETH/USD, POL/USD   |
| Faucet           | ENABLED                    | HIDDEN                      |
| Oracle           | Best-effort                | Chainlink mandatory         |
| AI Signals       | ALWAYS ON                  | ALWAYS ON                   |
+------------------+----------------------------+-----------------------------+
```

---

### Changes (16 files)

#### 1. Fix Build Error: `src/components/trading/TradePanel.tsx`

Close the unclosed JSX tags (missing `</div>` and component closing). This is a legacy/unused component causing TS17008/TS1005 build errors.

#### 2. Environment: `.env`

Add `VITE_ALCHEMY_POLYGON_RPC` with the provided mainnet Alchemy URL.

#### 3. Centralized Config: `src/config/contracts.ts`

- Add `POLYGON_RPC_URL` export (reads from `VITE_ALCHEMY_POLYGON_RPC`)
- Add `POLYGON_NETWORK_PARAMS` (chainId `0x89`, name "Polygon Mainnet", POL native currency)
- Add placeholder `CONTRACT_ADDRESSES.polygon` entries (empty strings until mainnet deployment)
- Add mode-aware helper functions:
  - `getRequiredChainId(mode)` -- returns 80002 for demo, 137 for live
  - `getRequiredChainHex(mode)` -- returns hex version
  - `getRpcUrl(mode)` -- returns Alchemy Amoy or Mainnet URL
  - `getNetworkParams(mode)` -- returns appropriate network params for MetaMask
  - `getContractAddresses(mode)` -- returns amoy or polygon addresses

#### 4. Market Config: `src/config/markets.ts`

- Add `getMarketsForMode(mode)` helper:
  - demo: returns `['POL/USD']`
  - live: returns `['BTC/USD', 'ETH/USD', 'POL/USD']`
- Existing `V1_AMOY_MARKETS` and `V1_MAINNET_MARKETS` already support this

#### 5. Network Enforcement: `src/hooks/useNetworkEnforcement.ts`

- Accept optional `accountMode` parameter
- `isCorrectNetwork` checks against mode-appropriate chain ID (80002 for demo, 137 for live)
- Rename `switchToAmoy` to `switchToRequiredNetwork` -- switches to Amoy in demo, Polygon Mainnet in live
- Keep backward-compatible `switchToAmoy` export
- `requiredNetworkName` returns "Polygon Amoy" or "Polygon Mainnet" based on mode

#### 6. NetworkGuard Banner: `src/components/layout/NetworkGuard.tsx`

- Import `useApp` to read current `accountMode`
- Pass mode to `useNetworkEnforcement`
- Update banner text dynamically: "Switch to Polygon Amoy" (demo) or "Switch to Polygon Mainnet" (live)
- Button calls mode-aware `switchToRequiredNetwork`

#### 7. MobileHeader: `src/components/layout/MobileHeader.tsx`

- Pass `accountMode` prop to `useNetworkEnforcement`
- Network status badge shows mode-appropriate message

#### 8. Trading Hook: `src/hooks/useOnChainTradingV2.ts`

- Currently hardcoded to Amoy addresses and RPC
- Make it mode-aware: accept mode context or parameter
- Use `getRpcUrl(mode)` for read-only Web3
- Use `getContractAddresses(mode)` for contract instances
- `PAIR_IDS` populated based on mode (POL/USD for demo, all three for live)
- `enforceNetwork` checks mode-appropriate chain ID
- Update toast messages: "Switch to Polygon Amoy" (demo) vs "Switch to Polygon Mainnet" (live)

#### 9. Market Data Hook: `src/hooks/useMarketData.ts`

- Accept mode parameter or read from context
- Use mode-aware RPC endpoint
- Use mode-aware market list: demo queries POL/USD only, live queries all three

#### 10. Oracle Status: `src/components/trading/OracleStatus.tsx`

- Use mode-aware RPC endpoints
- Use mode-aware contract addresses
- Show appropriate feeds for current mode

#### 11. TradingForm: `src/components/trading/TradingForm.tsx`

- Use `getMarketsForMode(accountMode)` instead of `V1_TRADING_MARKETS` for pair selector
- In demo: only POL/USD shown (no disabled/grayed items -- just don't render unavailable ones)
- In live: BTC/USD, ETH/USD, POL/USD all shown and active
- Update network-related toast messages to reference mode-appropriate network name
- Remove "Mainnet only" badge logic (replaced by mode-based filtering)

#### 12. MobileTradingInterface: `src/components/trading/MobileTradingInterface.tsx`

- Same mode-aware market filtering as TradingForm
- Update network warning text based on mode
- Pass mode to `useNetworkEnforcement`

#### 13. MarketOverview: `src/components/trading/MarketOverview.tsx`

- Accept `accountMode` prop
- Show only markets valid for current mode
- Remove "Mainnet only" badges (mode-based filtering replaces them)
- Keep "Forex coming in v2" notice

#### 14. AccountBalance: `src/components/trading/AccountBalance.tsx`

- Demo: show virtual balance (tUSD on Amoy)
- Live: show real wallet balance on Polygon Mainnet
- Already has mode-based display logic -- minimal changes needed

#### 15. Wallet Page: `src/pages/Wallet.tsx`

- Import `useApp` to read `accountMode`
- Conditionally hide `TUSDFaucet` component when in live mode

#### 16. Trade Page: `src/pages/Trade.tsx`

- Pass `accountMode` to `MarketOverview`
- Update subtitle text to be mode-aware

### What Does NOT Change

- **AI Signals page** (`src/pages/Signals.tsx`) -- completely untouched, always live, never gated by oracle or network
- Smart contract ABIs, fee calculations, liquidation logic
- Authentication, Supabase integration
- Hardhat config, deployment scripts
- The signal layer operates independently of on-chain state (this is the core rule)

### Key Rule Enforced

AI forex signals (EUR/USD, GBP/USD, USD/JPY) are the **product**. They are always visible, always functional, never disabled by oracle status, network state, or mode selection. Crypto trading is the execution rail -- it adapts to the selected mode. These two layers never interfere with each other.

### Technical Notes

- Mainnet contract addresses are placeholder empty strings until you deploy contracts to Polygon Mainnet. Live mode will show appropriate "contracts not deployed" messaging until then.
- The `useNetworkEnforcement` hook gains a `mode` parameter but defaults to `'demo'` for backward compatibility.
- RPC fallback arrays will be mode-specific: Alchemy Amoy + public Amoy fallbacks for demo, Alchemy Polygon + public Polygon fallbacks for live.
