// Auto-generated file. Do not edit manually.

export const CONTRACT_ADDRESSES = {
  amoy: {
    TokenizedCurrency: "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164",
    TUSDFaucet: "0x985D7002E449588b3e55340fa84f03CD08495550",
    PriceOracleV2: "0x5D58135A49C5035C5836E682B7A68B0d3d8816fF",
    TradingPlatformV2: "0x133DC29e4D6f366E8Ad05454eba452c7BC56573D",
    Treasury: "0x09C2B58F6004176bD83cc000d804eD3c1041754E",
  },
  polygon: {},
} as const;

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
export const isMainnet = (chainId?: number): boolean => {
  return chainId === CHAIN_IDS.polygon || chainId === CHAIN_IDS.mainnet;
};

export const getMinimums = (chainId?: number) => {
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
