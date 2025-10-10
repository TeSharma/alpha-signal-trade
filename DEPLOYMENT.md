# Smart Contract Deployment Guide

This guide explains how to deploy the tokenized currency smart contracts to Polygon network.

## Prerequisites

1. **Node.js & npm** installed
2. **Wallet with MATIC tokens** for gas fees
   - Polygon Mainnet: Buy MATIC on exchanges
   - Mumbai Testnet: Get free MATIC from [faucet](https://faucet.polygon.technology/)
3. **PolygonScan API Key** (optional, for contract verification)
   - Get one at [polygonscan.com](https://polygonscan.com/apis)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add:

```env
# Your wallet private key (NEVER share this!)
PRIVATE_KEY=your_private_key_here

# RPC URLs (use Alchemy/Infura for better performance)
POLYGON_RPC_URL=https://polygon-rpc.com/
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com/

# PolygonScan API key for verification (optional)
POLYGONSCAN_API_KEY=your_api_key_here
```

⚠️ **Security Warning**: Never commit `.env` to git! It contains your private key.

### 3. Get Test MATIC (Mumbai Testnet Only)

If deploying to Mumbai testnet first (recommended):

1. Visit [Polygon Faucet](https://faucet.polygon.technology/)
2. Select "Mumbai" network
3. Paste your wallet address
4. Get free test MATIC

## Deployment

### Deploy to Mumbai Testnet (Recommended First)

```bash
npx hardhat run scripts/deploy.ts --network mumbai
```

### Deploy to Polygon Mainnet

```bash
npx hardhat run scripts/deploy.ts --network polygon
```

## What Gets Deployed

The deployment script will:

1. ✅ Deploy 8 tokenized currency contracts (tUSD, tEUR, tGBP, tJPY, tAUD, tCAD, tCHF, tNZD)
2. ✅ Deploy PriceOracle contract
3. ✅ Configure Chainlink price feeds for 7 currency pairs
4. ✅ Deploy TradingPlatform contract
5. ✅ Grant MINTER_ROLE to TradingPlatform for each token
6. ✅ Save addresses to `deployed-addresses.json`
7. ✅ Generate `src/config/contracts.ts` for frontend

## Post-Deployment

### 1. Verify Contracts on PolygonScan

```bash
npx hardhat run scripts/verify.ts --network mumbai
# or
npx hardhat run scripts/verify.ts --network polygon
```

This makes your contract code publicly viewable on PolygonScan.

### 2. Update Frontend Configuration

The deployment script auto-generates `src/config/contracts.ts`. 

**Manual update:** Edit `src/hooks/useTokenContracts.ts` and replace the placeholder addresses with deployed ones from `deployed-addresses.json`:

```typescript
export const TOKEN_ADDRESSES = {
  tUSD: '0xYOUR_DEPLOYED_ADDRESS',
  tEUR: '0xYOUR_DEPLOYED_ADDRESS',
  // ... etc
};

export const ORACLE_ADDRESS = '0xYOUR_ORACLE_ADDRESS';
export const TRADING_PLATFORM_ADDRESS = '0xYOUR_PLATFORM_ADDRESS';
```

### 3. Test the Integration

1. Go to the **Wallet** page → **Tokens** tab
2. Connect your MetaMask wallet
3. Switch to the network you deployed to (Mumbai/Polygon)
4. You should see all 8 tokenized currencies with 0 balance

### 4. Mint Test Tokens (Testnet Only)

To test trading, you'll need to mint some tokens:

```bash
npx hardhat console --network mumbai
```

Then in the console:

```javascript
const token = await ethers.getContractAt("TokenizedCurrency", "YOUR_tUSD_ADDRESS");
await token.mint("YOUR_WALLET_ADDRESS", ethers.utils.parseUnits("1000", 6), "Testing");
```

This mints 1000 tUSD to your wallet.

## Deployment Costs

Estimated gas costs (approximate):

**Mumbai Testnet:** FREE (using test MATIC)

**Polygon Mainnet:**
- TokenizedCurrency (x8): ~0.05 MATIC each = 0.4 MATIC
- PriceOracle: ~0.15 MATIC
- TradingPlatform: ~0.2 MATIC
- Role Grants (x8): ~0.02 MATIC each = 0.16 MATIC
- **Total: ~1 MATIC** (~$0.50 at current prices)

## Network Information

### Polygon Mumbai Testnet
- Chain ID: 80001
- RPC: https://rpc-mumbai.maticvigil.com/
- Explorer: https://mumbai.polygonscan.com/
- Faucet: https://faucet.polygon.technology/

### Polygon Mainnet
- Chain ID: 137
- RPC: https://polygon-rpc.com/
- Explorer: https://polygonscan.com/

## Troubleshooting

### Error: "insufficient funds for gas"
- Your wallet needs MATIC for gas fees
- Get test MATIC from faucet (testnet) or buy MATIC (mainnet)

### Error: "nonce too high"
- Reset your account in MetaMask: Settings → Advanced → Reset Account

### Error: "network does not support ENS"
- This is a known Hardhat warning, can be safely ignored

### Contracts won't verify on PolygonScan
- Wait a few minutes after deployment
- Make sure your POLYGONSCAN_API_KEY is correct
- Try running verify script again

## Security Checklist

Before mainnet deployment:

- [ ] Private key stored securely (never in code/git)
- [ ] Test all functions on Mumbai testnet first
- [ ] Verify Chainlink price feeds are correct for your network
- [ ] Double-check platform fee and max leverage settings
- [ ] Consider getting contracts audited
- [ ] Test emergency pause functionality
- [ ] Ensure proper access control (only TradingPlatform can mint)

## Next Steps

After successful deployment:

1. **Test Trading**: Try opening positions via the Trade page
2. **Add Liquidity**: Prepare for Phase 2 (DEX deployment)
3. **Monitor**: Track contract interactions on PolygonScan
4. **Iterate**: Gather feedback and improve

## Support

- Hardhat Docs: https://hardhat.org/getting-started/
- Polygon Docs: https://docs.polygon.technology/
- Chainlink Docs: https://docs.chain.link/
- OpenZeppelin Docs: https://docs.openzeppelin.com/

---

**Questions?** Check the inline comments in `scripts/deploy.ts` or reach out to the development team.
