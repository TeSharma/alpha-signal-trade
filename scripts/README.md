# Deployment Scripts

This directory contains Hardhat deployment scripts for the tokenized currency smart contracts.

## Scripts Overview

### `deploy.ts` - Main Deployment Script

Deploys all smart contracts in the correct order:

1. 8 Tokenized Currency contracts (tUSD, tEUR, tGBP, tJPY, tAUD, tCAD, tCHF, tNZD)
2. PriceOracle contract with Chainlink price feeds
3. TradingPlatform contract
4. Grants MINTER_ROLE to TradingPlatform for each token

**Usage:**
```bash
# Mumbai Testnet
npx hardhat run scripts/deploy.ts --network mumbai

# Polygon Mainnet
npx hardhat run scripts/deploy.ts --network polygon
```

**Output:**
- `deployed-addresses.json` - All contract addresses
- `src/config/contracts.ts` - Auto-generated frontend config

### `verify.ts` - Contract Verification Script

Verifies all deployed contracts on PolygonScan to make source code public.

**Usage:**
```bash
# Verify on Mumbai
npx hardhat run scripts/verify.ts --network mumbai

# Verify on Polygon
npx hardhat run scripts/verify.ts --network polygon
```

**Requirements:**
- Run after `deploy.ts`
- Needs `POLYGONSCAN_API_KEY` in `.env`
- `deployed-addresses.json` must exist

## Prerequisites

1. Configure `.env` file:
```env
PRIVATE_KEY=your_private_key
POLYGON_RPC_URL=https://polygon-rpc.com/
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com/
POLYGONSCAN_API_KEY=your_api_key
```

2. Fund your wallet with MATIC:
   - **Mumbai:** Use [Polygon Faucet](https://faucet.polygon.technology/)
   - **Mainnet:** Buy MATIC on exchanges

## Deployment Flow

```
1. Configure .env
   ↓
2. npx hardhat run scripts/deploy.ts --network mumbai
   ↓
3. npx hardhat run scripts/verify.ts --network mumbai
   ↓
4. Test on frontend
   ↓
5. Deploy to mainnet when ready
```

## Chainlink Price Feeds

The deployment script automatically configures these pairs:

- EUR/USD
- GBP/USD
- USD/JPY
- AUD/USD
- USD/CAD
- USD/CHF
- NZD/USD

Price feed addresses differ between Mumbai (testnet) and Polygon (mainnet). The script selects the correct ones based on network.

## Gas Estimates

**Mumbai Testnet:** FREE (test MATIC)

**Polygon Mainnet:** ~1 MATIC total
- Each token: ~0.05 MATIC
- Oracle: ~0.15 MATIC
- Trading Platform: ~0.2 MATIC
- Role grants: ~0.16 MATIC

## Troubleshooting

**"insufficient funds"**
- Get MATIC from faucet (testnet) or exchange (mainnet)

**"nonce too high"**
- Reset MetaMask: Settings → Advanced → Reset Account

**Verification fails**
- Wait 5 minutes after deployment
- Check POLYGONSCAN_API_KEY is correct
- Retry with verify script

## Security Notes

⚠️ **NEVER commit `.env` file to git**
⚠️ **Test on Mumbai before mainnet**
⚠️ **Keep private keys secure**

## Next Steps

After deployment:

1. Check contracts on PolygonScan
2. Update frontend with addresses from `deployed-addresses.json`
3. Test token minting and trading
4. Monitor transactions

See `DEPLOYMENT.md` in project root for detailed guide.
