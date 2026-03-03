

## Deploy to Polygon Mainnet with USDC Collateral

### Overview

Deploy PriceOracleV2 and TradingPlatformV2 on Polygon Mainnet using native USDC as collateral and Chainlink mainnet feeds for BTC/USD, ETH/USD, and POL/USD. Update frontend config with mainnet addresses. Oracle goes green immediately after deployment.

### Architecture

```text
Polygon Mainnet (137)
├── PriceOracleV2 (new deploy)
│   ├── BTC/USD → Chainlink 0xc907E116054Ad103354f2D350FD2514433D57F6f
│   ├── ETH/USD → Chainlink 0xF9680D99D6C9589e2a93a78A04A279e509205945
│   └── POL/USD → Chainlink 0xAB594600376Ec9fD91F8e8dC3ef219F1735Db534
├── TradingPlatformV2 (new deploy, USDC collateral)
└── Collateral: USDC (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
```

### Changes

#### 1. New file: `scripts/deploy-mainnet.js`

Mainnet deployment script that:
- Deploys PriceOracleV2
- Registers BTC/USD, ETH/USD, POL/USD Chainlink feeds (all 8 decimals)
- Deploys TradingPlatformV2 with USDC (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) as collateral
- Verifies all feeds return valid prices
- Saves deployment to `deployments/polygon-deployment.json`
- Auto-updates `src/config/contracts.ts` polygon addresses

**Important**: USDC on Polygon has 6 decimals (same as tUSD's `mwei`), so the existing `toWei(amount, 'mwei')` logic in the hooks works without changes.

**Chainlink feed addresses (Polygon Mainnet, all verified):**
| Pair | Address | Decimals |
|------|---------|----------|
| BTC/USD | `0xc907E116054Ad103354f2D350FD2514433D57F6f` | 8 |
| ETH/USD | `0xF9680D99D6C9589e2a93a78A04A279e509205945` | 8 |
| POL/USD | `0xAB594600376Ec9fD91F8e8dC3ef219F1735Db534` | 8 |

#### 2. Update: `src/config/contracts.ts`

- Add USDC address constant: `POLYGON_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'`
- Pre-fill `CONTRACT_ADDRESSES.polygon.TokenizedCurrency` with the USDC address (it's the collateral token in live mode)
- Leave `PriceOracleV2` and `TradingPlatformV2` empty until you run the deploy script, then you paste the addresses back

#### 3. Update: `src/hooks/useOnChainTradingV2.ts`

- Add `MAINNET_PAIR_IDS` with keccak256 hashes for BTC/USD, ETH/USD, POL/USD
- The existing mode-aware logic already selects the right addresses; no structural changes needed

### Deployment Steps (you run locally)

1. Ensure `.env` has `POLYGON_RPC_URL` and `PRIVATE_KEY` set
2. Fund deployer wallet with ~0.5 POL on mainnet for gas
3. Run: `npx hardhat run scripts/deploy-mainnet.js --network polygon`
4. Copy the output addresses into `src/config/contracts.ts` under `polygon` (the script auto-updates if run from the repo root)
5. Oracle goes green, BTC/ETH/POL feeds show as active

### What This Fixes

- Oracle shows **green** in Live mode (real Chainlink feeds, updating every heartbeat)
- Demo mode continues on Amoy with POL/USD (best-effort, may stay offline -- that's expected)
- Live mode becomes the production-ready path with USDC collateral

