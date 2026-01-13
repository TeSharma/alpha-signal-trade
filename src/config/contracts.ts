// Auto-generated file. Do not edit manually.

export const CONTRACT_ADDRESSES = {
  amoy: {
    // V1 Contracts (legacy)
    TokenizedCurrency: "0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164",
    PriceOracle: "0x8063A3901b9053f911fFE3da4bAF754B640A0744",
    TradingPlatform: "0xE13B97E70AF997dEaB3EAa28Ab88cCd362734729",
    
    // V2 Contracts (current)
    PriceOracleV2: "0x5e6038c073B8EB7d7b03Cc56503006183fe64eA1",
    TradingPlatformV2: "0x735C78c95da6284244771F66B5aA4c0BE38fb7c7",
    
    // Testnet Faucet (REMOVE FOR MAINNET)
    TUSDFaucet: "", // Deploy with: npx hardhat run scripts/deploy-faucet.js --network amoy
  },
  mainnet: {
    // Polygon mainnet addresses (to be added)
    TokenizedCurrency: "",
    PriceOracleV2: "",
    TradingPlatformV2: "",
    // NO FAUCET ON MAINNET - minting via bridge/treasury only
  },
};

// Network chain IDs
export const CHAIN_IDS = {
  amoy: 80002,      // 0x13882
  mainnet: 137,     // 0x89
};

// Trading minimums (in tUSD)
export const TRADING_MINIMUMS = {
  testnet: {
    minMargin: 0.01,
    minDeposit: 0,
  },
  mainnet: {
    minMargin: 5,     // 5 tUSD minimum margin
    minDeposit: 10,   // 10 tUSD minimum deposit
  },
};

// Helper to check if on mainnet
export const isMainnet = (chainId: number): boolean => chainId === CHAIN_IDS.mainnet;

// Helper to get minimums based on network
export const getMinimums = (chainId: number) => {
  return isMainnet(chainId) ? TRADING_MINIMUMS.mainnet : TRADING_MINIMUMS.testnet;
};
