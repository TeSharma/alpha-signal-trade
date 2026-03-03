// Auto-generated file. Do not edit manually.

// Dedicated RPC — env var with public fallback
export const AMOY_RPC_URL = import.meta.env.VITE_ALCHEMY_AMOY_RPC
  || 'https://rpc-amoy.polygon.technology/';

export const POLYGON_RPC_URL = import.meta.env.VITE_ALCHEMY_POLYGON_RPC
  || 'https://polygon-rpc.com/';

// Native USDC on Polygon Mainnet (6 decimals — same unit as tUSD mwei)
export const POLYGON_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

export const CONTRACT_ADDRESSES = {
  amoy: {
    TokenizedCurrency: "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164",
    TUSDFaucet: "0x985D7002E449588b3e55340fa84f03CD08495550",
    PriceOracleV2: "0x5D58135A49C5035C5836E682B7A68B0d3d8816fF",
    TradingPlatformV2: "0x133DC29e4D6f366E8Ad05454eba452c7BC56573D",
    Treasury: "0x09C2B58F6004176bD83cc000d804eD3c1041754E",
  },
  polygon: {
    TokenizedCurrency: POLYGON_USDC,  // USDC is the collateral token in live mode
    TUSDFaucet: "",                   // No faucet on mainnet
    PriceOracleV2: "",                // Set after running deploy-mainnet.js
    TradingPlatformV2: "",            // Set after running deploy-mainnet.js
    Treasury: "",
  },
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
// MODE-AWARE HELPERS
// ============================================
export type AccountMode = 'demo' | 'live';

export const getRequiredChainId = (mode: AccountMode): number =>
  mode === 'demo' ? CHAIN_IDS.amoy : CHAIN_IDS.polygon;

export const getRequiredChainHex = (mode: AccountMode): string =>
  mode === 'demo' ? '0x13882' : '0x89';

export const getRpcUrl = (mode: AccountMode): string =>
  mode === 'demo' ? AMOY_RPC_URL : POLYGON_RPC_URL;

export const getNetworkParams = (mode: AccountMode) =>
  mode === 'demo' ? AMOY_NETWORK_PARAMS : POLYGON_NETWORK_PARAMS;

export const getContractAddresses = (mode: AccountMode) =>
  mode === 'demo' ? CONTRACT_ADDRESSES.amoy : CONTRACT_ADDRESSES.polygon;

export const getNetworkName = (mode: AccountMode): string =>
  mode === 'demo' ? 'Polygon Amoy' : 'Polygon Mainnet';

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
// ============================================
// REQUIRED NETWORK — legacy exports (prefer mode-aware helpers above)
// ============================================
export const REQUIRED_CHAIN_ID = CHAIN_IDS.amoy; // 80002
export const REQUIRED_CHAIN_ID_HEX = '0x13882';

export const AMOY_NETWORK_PARAMS = {
  chainId: '0x13882',
  chainName: 'Polygon Amoy Testnet',
  rpcUrls: [AMOY_RPC_URL],
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  blockExplorerUrls: ['https://amoy.polygonscan.com/'],
} as const;

export const POLYGON_NETWORK_PARAMS = {
  chainId: '0x89',
  chainName: 'Polygon Mainnet',
  rpcUrls: [POLYGON_RPC_URL],
  nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
  blockExplorerUrls: ['https://polygonscan.com/'],
} as const;

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
