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
};
