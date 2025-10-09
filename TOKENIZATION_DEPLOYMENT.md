# Phase 1: Token Infrastructure Deployment Guide

## Overview
This guide walks you through deploying the tokenized currency infrastructure for the trading platform.

## Smart Contracts Created

1. **TokenizedCurrency.sol** - ERC-20 tokens for each currency
2. **PriceOracle.sol** - Chainlink oracle integration for real-time forex prices
3. **TradingPlatform.sol** - Main trading contract with on-chain position management

## Prerequisites

```bash
# Install required dependencies
npm install @openzeppelin/contracts @chainlink/contracts
```

## Deployment Steps

### Step 1: Deploy TokenizedCurrency Contracts

Deploy one contract for each currency (8 total):

```solidity
// Example for tUSD
TokenizedCurrency tUSD = new TokenizedCurrency(
    "Tokenized USD",
    "tUSD",
    6  // decimals
);

// Repeat for:
// - tEUR (Tokenized Euro)
// - tGBP (Tokenized Pound)
// - tJPY (Tokenized Yen)
// - tAUD (Tokenized Australian Dollar)
// - tCAD (Tokenized Canadian Dollar)
// - tCHF (Tokenized Swiss Franc)
// - tNZD (Tokenized New Zealand Dollar)
```

**Save all deployed token addresses!**

### Step 2: Deploy PriceOracle Contract

```solidity
PriceOracle oracle = new PriceOracle();
```

#### Configure Chainlink Price Feeds (Polygon Mainnet)

```solidity
// EUR/USD: 0x73366Fe0AA0Ded304479862808e02506FE556a98
oracle.setPriceFeed("EUR/USD", 0x73366Fe0AA0Ded304479862808e02506FE556a98);

// GBP/USD: 0x099a2540848573e94fb1Ca0Fa420b00acbBc845a
oracle.setPriceFeed("GBP/USD", 0x099a2540848573e94fb1Ca0Fa420b00acbBc845a);

// USD/JPY: 0xD647a6fC9BC6402301583C91decC5989d8Bc382D
oracle.setPriceFeed("USD/JPY", 0xD647a6fC9BC6402301583C91decC5989d8Bc382D);

// AUD/USD: 0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f
oracle.setPriceFeed("AUD/USD", 0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f);

// USD/CAD: 0xACA44ABb8B04D07D883202F99FA5E3c53ed57Fb5
oracle.setPriceFeed("USD/CAD", 0xACA44ABb8B04D07D883202F99FA5E3c53ed57Fb5);

// USD/CHF: 0xc76f762CedF0F78a439727861628E0fdfE1e70c2
oracle.setPriceFeed("USD/CHF", 0xc76f762CedF0F78a439727861628E0fdfE1e70c2);

// NZD/USD: 0xa302a0B8a499fD0f00449df0a490DedE21105955
oracle.setPriceFeed("NZD/USD", 0xa302a0B8a499fD0f00449df0a490DedE21105955);
```

**Note:** For Polygon Testnet (Mumbai), get addresses from:
https://docs.chain.link/data-feeds/price-feeds/addresses?network=polygon

### Step 3: Deploy TradingPlatform Contract

```solidity
TradingPlatform platform = new TradingPlatform(
    address(oracle),        // Oracle contract address
    address(tUSD)          // Collateral token (tUSD)
);
```

### Step 4: Grant MINTER_ROLE

Grant the TradingPlatform contract permission to mint/burn tokens:

```solidity
// For each token
tUSD.grantRole(tUSD.MINTER_ROLE(), address(platform));
tEUR.grantRole(tEUR.MINTER_ROLE(), address(platform));
tGBP.grantRole(tGBP.MINTER_ROLE(), address(platform));
// ... repeat for all tokens
```

### Step 5: Update Frontend Configuration

Edit `src/hooks/useTokenContracts.ts`:

```typescript
export const TOKEN_ADDRESSES = {
  tUSD: '0xYOUR_tUSD_ADDRESS',
  tEUR: '0xYOUR_tEUR_ADDRESS',
  tGBP: '0xYOUR_tGBP_ADDRESS',
  tJPY: '0xYOUR_tJPY_ADDRESS',
  tAUD: '0xYOUR_tAUD_ADDRESS',
  tCAD: '0xYOUR_tCAD_ADDRESS',
  tCHF: '0xYOUR_tCHF_ADDRESS',
  tNZD: '0xYOUR_tNZD_ADDRESS',
};

export const ORACLE_ADDRESS = '0xYOUR_ORACLE_ADDRESS';
export const TRADING_PLATFORM_ADDRESS = '0xYOUR_PLATFORM_ADDRESS';
```

## Testing Deployment

### 1. Check Oracle Prices

```solidity
// Get EUR/USD price
PriceOracle.PriceData memory data = oracle.getLatestPrice("EUR/USD");
console.log("EUR/USD:", data.price);
console.log("Is Valid:", data.isValid);
```

### 2. Mint Test Tokens

```solidity
// Mint 1000 tUSD to your address
tUSD.mint(yourAddress, 1000 * 10**6, "Testing");
```

### 3. Open Test Position

```solidity
// Approve collateral
tUSD.approve(address(platform), 100 * 10**6);

// Open position: Buy EUR/USD with 100 tUSD, 10x leverage
platform.openPosition(
    "EUR/USD",
    true,           // isLong = buy
    100 * 10**6,    // 100 tUSD collateral
    10,             // 10x leverage
    0,              // no stop loss
    0               // no take profit
);
```

## Network Configuration

### Polygon Mainnet
- Chain ID: 137
- RPC: https://polygon-rpc.com/
- Explorer: https://polygonscan.com/

### Polygon Testnet (Mumbai)
- Chain ID: 80001
- RPC: https://rpc-mumbai.maticvigil.com/
- Explorer: https://mumbai.polygonscan.com/
- Faucet: https://faucet.polygon.technology/

## Next Steps (Phase 2)

After successful deployment and testing:

1. **Deploy DEX Contracts** - Uniswap V2-style AMM for token swaps
2. **Create Liquidity Pools** - For each currency pair
3. **Implement LP Tokens** - For liquidity providers
4. **Add Cross-Chain Bridge** - Connect Polygon ↔ Hedera

## Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds)
- [Polygon Documentation](https://docs.polygon.technology/)
- [Hardhat Deployment Guide](https://hardhat.org/guides/deploying.html)

## Troubleshooting

**Issue:** "Price feed not set for this pair"
- Ensure `setPriceFeed()` was called for the currency pair
- Verify Chainlink feed address is correct for your network

**Issue:** "Price data is stale or invalid"
- Check if Chainlink oracle is still active on the network
- Adjust `maxStaleness` if needed: `oracle.setMaxStaleness(7200)` (2 hours)

**Issue:** "Insufficient balance"
- Ensure tokens are minted to user address
- Check token approval for TradingPlatform contract

## Security Checklist

- [ ] Verify all contract addresses before deployment
- [ ] Grant MINTER_ROLE only to authorized contracts
- [ ] Test on testnet before mainnet deployment
- [ ] Verify Chainlink price feed addresses
- [ ] Set appropriate platform fees and max leverage
- [ ] Implement circuit breakers for emergency pause
- [ ] Audit contracts before mainnet deployment
