// Auto-generated file. Safe to edit.
// Central on-chain config for frontend

/* =========================
   Chain IDs
========================= */

export const CHAIN_IDS = {
  amoy: 80002,
  polygon: 137,
} as const;

/* =========================
   Contract Addresses
========================= */

export const CONTRACT_ADDRESSES = {
  amoy: {
    TokenizedCurrency: "0xAF430b788e47d43bB21083b999151FFDEF528a80",
    PriceOracle: "0x129A60D49907934C64633Fa461708fa79b4232CD",
    TradingPlatform: "0x8328329b9172514924dFa966D6c06c48C3BF3C5C",
    TradingPlatformV2: "0x0c00a13CE1a1e48914Ec63C748d88A0aa8CfF8D8",
    TUSDFaucet: "0xE90D9CB8Da847aC2e37e0d54Eda2b2C57236159D",
  },
  polygon: {},
} as const;

/* =========================
   Network Helpers
========================= */

export const isMainnet = (chainId?: number) =>
  chainId === CHAIN_IDS.polygon;

/* =========================
   Fee Configuration
========================= */

export const FEE_CONFIG = {
  openFeeBps: 10,      // 0.10%
  closeFeeBps: 10,    // 0.10%
  liquidationFeeBps: 50, // 0.50%
  bpsDivisor: 10_000,
};

/* =========================
   Trading Minimums
========================= */

export const getMinimums = (chainId?: number) => {
  if (chainId === CHAIN_IDS.amoy) {
    return {
      minPositionSize: 1_000_000n, // 1 tUSD (6 decimals)
      minLeverage: 1,
      maxLeverage: 50,
    };
  }

  return {
    minPositionSize: 10_000_000n, // 10 tUSD
    minLeverage: 1,
    maxLeverage: 30,
  };
};

/* =========================
   Fee Calculations
========================= */

export const calculateOpenFee = (amount: bigint) => {
  return (amount * BigInt(FEE_CONFIG.openFeeBps)) /
    BigInt(FEE_CONFIG.bpsDivisor);
    TokenizedCurrency: "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164",
    TUSDFaucet: "0xE90D9CB8Da847aC2e37e0d54Eda2b2C57236159D",
    PriceOracleV2: "0x5D58135A49C5035C5836E682B7A68B0d3d8816fF",
    TradingPlatformV2: "0x133DC29e4D6f366E8Ad05454eba452c7BC56573D",
    Treasury: "0x09C2B58F6004176bD83cc000d804eD3c1041754E",
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
