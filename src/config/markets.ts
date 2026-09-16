// Centralized market configuration for v1 mainnet strategy
// Layer 1: AI Signal markets (Forex) - no on-chain execution
// Layer 2: On-Chain Trading markets (Crypto) - Chainlink-backed

export interface MarketMeta {
  symbol: string;
  icon: string;
  decimals: number; // Display precision
  layer: 'on-chain' | 'signal';
  network: 'all' | 'mainnet-only' | 'amoy-only';
  description?: string;
  binanceSymbol?: string; // Binance WebSocket symbol (crypto only)
}

// ─── ON-CHAIN TRADING MARKETS (Crypto – Chainlink required) ──────────────
export const V1_TRADING_MARKETS = ['BTC/USD', 'ETH/USD', 'POL/USD'] as const;
export type V1TradingPair = typeof V1_TRADING_MARKETS[number];

// Network-specific subsets
export const V1_AMOY_MARKETS = ['POL/USD'] as const;
export const V1_MAINNET_MARKETS = ['BTC/USD', 'ETH/USD', 'POL/USD'] as const;

// ─── AI SIGNAL MARKETS (Forex + Metals) ──────────────────────────────────
export const V1_SIGNAL_MARKETS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'AUD/USD'] as const;
export type V1SignalPair = typeof V1_SIGNAL_MARKETS[number];

// ─── LIVE ON-CHAIN FOREX/METAL MARKETS ───────────────────────────────────
// Registered on PriceOracleV2 (0xf61E4881F363b30384DFbcf1C72845CcE94d4f9f) on
// Polygon mainnet in tx 0xd7258e6ff9aa244abe82257f9120dc02e7f2454b743e3830fe9d0d62fa2e730f
// and verified on-chain 2026-09-14: all seven pairs return hasFeed=true with
// positive, fresh prices. USD/JPY, USD/CHF, NZD/USD and USD/CAD remain
// signal-only — their Chainlink feeds are quoted inverted vs. our naming.
export const V1_MAINNET_FOREX_MARKETS = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'XAU/USD'] as const;

// Combined metadata for all v1 markets
export const MARKET_METADATA: Record<string, MarketMeta> = {
  // Crypto (on-chain)
  'BTC/USD':   { symbol: 'BTC',   icon: '₿', decimals: 2, layer: 'on-chain', network: 'mainnet-only', binanceSymbol: 'btcusdt' },
  'ETH/USD':   { symbol: 'ETH',   icon: 'Ξ', decimals: 2, layer: 'on-chain', network: 'mainnet-only', binanceSymbol: 'ethusdt' },
  'POL/USD':   { symbol: 'POL',   icon: '⬡', decimals: 4, layer: 'on-chain', network: 'all', binanceSymbol: 'polusdt' },
  // Forex / metals — Chainlink feeds registered on mainnet (on-chain in live mode)
  'EUR/USD':   { symbol: 'EUR',   icon: '€', decimals: 5, layer: 'on-chain', network: 'mainnet-only' },
  'GBP/USD':   { symbol: 'GBP',   icon: '£', decimals: 5, layer: 'on-chain', network: 'mainnet-only' },
  'AUD/USD':   { symbol: 'AUD',   icon: 'A$', decimals: 5, layer: 'on-chain', network: 'mainnet-only' },
  'XAU/USD':   { symbol: 'XAU',   icon: '🥇', decimals: 2, layer: 'on-chain', network: 'mainnet-only', description: 'Gold' },
  // No registered Chainlink feed in our quote direction — AI signals only
  'USD/JPY':   { symbol: 'JPY',   icon: '¥', decimals: 3, layer: 'signal', network: 'all', description: 'AI Signals Only' },
};


// ─── Helpers ──────────────────────────────────────────────────────────────

// Mode-aware: in live mode the four registered forex/metal feeds are on-chain
// tradable markets; in demo mode they settle off-chain as before.
export const isTradingMarket = (pair: string, mode: 'demo' | 'live' = 'live'): boolean =>
  (V1_TRADING_MARKETS as readonly string[]).includes(pair) ||
  (mode === 'live' && (V1_MAINNET_FOREX_MARKETS as readonly string[]).includes(pair));

export const isSignalMarket = (pair: string, mode: 'demo' | 'live' = 'demo'): boolean =>
  (V1_SIGNAL_MARKETS as readonly string[]).includes(pair) &&
  !(mode === 'live' && (V1_MAINNET_FOREX_MARKETS as readonly string[]).includes(pair));

export const getMarketMeta = (pair: string): MarketMeta | undefined =>
  MARKET_METADATA[pair];


export const getAmoyTradingMarkets = (): string[] => [...V1_AMOY_MARKETS];
export const getMainnetTradingMarkets = (): string[] => [...V1_MAINNET_MARKETS];

export const getMarketsForMode = (mode: 'demo' | 'live'): string[] =>
  mode === 'demo'
    // Demo: all pairs available (off-chain settlement, prices from Binance + Twelve Data)
    ? [...V1_TRADING_MARKETS, ...V1_SIGNAL_MARKETS]
    // Live: Chainlink-backed crypto + verified forex/metal feeds on mainnet
    : [...getMainnetTradingMarkets(), ...V1_MAINNET_FOREX_MARKETS];

export const isMainnetOnly = (pair: string): boolean =>
  MARKET_METADATA[pair]?.network === 'mainnet-only';

export const formatPrice = (pair: string, price: number): string => {
  const meta = MARKET_METADATA[pair];
  const decimals = meta?.decimals ?? 2;
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// v2 roadmap pairs (not yet available)
export const V2_FOREX_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY'] as const;
