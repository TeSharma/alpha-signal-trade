// Auto-generated file. Do not edit manually.

export const CONTRACT_ADDRESSES = {
  amoy: {
    TokenizedCurrency: "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164",
    TUSDFaucet: "0xE90D9CB8Da847aC2e37e0d54Eda2b2C57236159D",
    PriceOracleV2: "0x061127643995ecc686aFc3F2Cf411E0b5B30426f",
    TradingPlatformV2: "0x0c00a13CE1a1e48914Ec63C748d88A0aa8CfF8D8",
  },
};

// ============================================
// CHAIN IDS
// ============================================
export const CHAIN_IDS = {
  amoy: 80002,        // Polygon Amoy Testnet
  polygon: 137,       // Polygon Mainnet
  mainnet: 1,         // Ethereum Mainnet
} as const;

// ============================================
// TRADING MINIMUMS (per network)
// ============================================
export const TRADING_MINIMUMS = {
  testnet: {
    minMargin: 1,        // 1 tUSD minimum margin
    minDeposit: 1,       // 1 tUSD minimum deposit
  },
  mainnet: {
    minMargin: 10,       // 10 tUSD minimum margin
    minDeposit: 50,      // 50 tUSD minimum deposit
  },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================
export const isMainnet = (chainId: number): boolean => {
  return chainId === CHAIN_IDS.polygon || chainId === CHAIN_IDS.mainnet;
};

export const getMinimums = (chainId: number) => {
  return isMainnet(chainId) 
    ? TRADING_MINIMUMS.mainnet 
    : TRADING_MINIMUMS.testnet;
};

// ============================================
// FEE CONFIGURATION (matches smart contract)
// ============================================
export const FEE_CONFIG = {
  openFeeBps: 8,           // 0.08% open fee
  closeFeeBps: 8,          // 0.08% close fee on profits
  liquidatorRewardBps: 3000, // 30% to liquidator
  treasuryShareBps: 7000,    // 70% to treasury
  BPS_DENOMINATOR: 10000,
} as const;

// ============================================
// FEE CALCULATION HELPERS
// ============================================
export const calculateOpenFee = (margin: number): number => {
  return (margin * FEE_CONFIG.openFeeBps) / FEE_CONFIG.BPS_DENOMINATOR;
};

export const calculateCloseFee = (profit: number): number => {
  if (profit <= 0) return 0;
  return (profit * FEE_CONFIG.closeFeeBps) / FEE_CONFIG.BPS_DENOMINATOR;
};

export const calculateNetMargin = (margin: number): number => {
  return margin - calculateOpenFee(margin);
};
