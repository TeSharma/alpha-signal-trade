// Contract addresses and configuration for the trading platform

export const CONTRACT_ADDRESSES = {
  amoy: {
    TokenizedCurrency: "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164",
    PriceOracle: "0x8063A3901b9053f911fFE3da4bAF754B640A0744",
    TradingPlatform: "0xE13B97E70AF997dEaB3EAa28Ab88cCd362734729",
    TUSDFaucet: "0xE90D9CB8Da847aC2e37e0d54Eda2b2C57236159D",
    // V2 Contracts
    PriceOracleV2: "0x5e6038c073B8EB7d7b03Cc56503006183fe64eA1",
    TradingPlatformV2: "0x735C78c95da6284244771F66B5aA4c0BE38fb7c7",
  },
  polygon: {
    TokenizedCurrency: "",
    PriceOracle: "",
    TradingPlatform: "",
    TUSDFaucet: "",
    PriceOracleV2: "",
    TradingPlatformV2: "",
  },
};

// Chain IDs for supported networks
export const CHAIN_IDS = {
  amoy: 80002,
  polygon: 137,
};

// Trading minimums per network
export const TRADING_MINIMUMS = {
  testnet: {
    minDeposit: 1,
    minMargin: 1,
  },
  mainnet: {
    minDeposit: 10,
    minMargin: 5,
  },
};

// Helper function to get minimums based on chain ID
export function getMinimums(chainId: number) {
  if (chainId === CHAIN_IDS.polygon) {
    return TRADING_MINIMUMS.mainnet;
  }
  return TRADING_MINIMUMS.testnet;
}

// Check if network is mainnet
export function isMainnet(chainId: number): boolean {
  return chainId === CHAIN_IDS.polygon;
}

// Pair IDs for V2 contracts (keccak256 hashes)
export const PAIR_IDS: Record<string, string> = {
  'EUR/USD': '0x9b8c5b5e3a5c0d7f8f9e3b5b5e3a5c0d7f8f9e3b5b5e3a5c0d7f8f9e3b5b5e3a',
  'GBP/USD': '0x8a7b4a4d2a4b0c6e7e8d2a4a4d2a4b0c6e7e8d2a4a4d2a4b0c6e7e8d2a4a4d2a',
  'USD/JPY': '0x7a6b3a3c1a3a0b5d6d7c1a3a3c1a3a0b5d6d7c1a3a3c1a3a0b5d6d7c1a3a3c1a',
  'AUD/USD': '0x6a5b2a2b0a2a0a4c5c6b0a2a2b0a2a0a4c5c6b0a2a2b0a2a0a4c5c6b0a2a2b0a',
  'USD/CAD': '0x5a4b1a1a0a1a0a3b4b5a0a1a1a0a1a0a3b4b5a0a1a1a0a1a0a3b4b5a0a1a1a0a',
  'USD/CHF': '0x4a3b0a0a0a0a0a2a3a4a0a0a0a0a0a0a2a3a4a0a0a0a0a0a0a2a3a4a0a0a0a0a',
  'NZD/USD': '0x3a2b0a0a0a0a0a1a2a3a0a0a0a0a0a0a1a2a3a0a0a0a0a0a0a1a2a3a0a0a0a0a',
};

// Fee configuration (for UI display - actual values come from contract)
export const FEE_CONFIG = {
  openFeeBps: 8,      // 0.08%
  closeFeeBps: 8,     // 0.08%
  liquidatorRewardBps: 3000,  // 30%
};

// Calculate open fee for display
export function calculateOpenFee(margin: number): number {
  return (margin * FEE_CONFIG.openFeeBps) / 10000;
}

// Calculate close fee for display (only on profits)
export function calculateCloseFee(profit: number): number {
  if (profit <= 0) return 0;
  return (profit * FEE_CONFIG.closeFeeBps) / 10000;
}
