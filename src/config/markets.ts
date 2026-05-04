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

// ─── AI SIGNAL MARKETS (Forex + Metals – no oracle needed) ───────────────
export const V1_SIGNAL_MARKETS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD'] as const;
export type V1SignalPair = typeof V1_SIGNAL_MARKETS[number];

// Combined metadata for all v1 markets
export const MARKET_METADATA: Record<string, MarketMeta> = {
  // Crypto (on-chain)
  'BTC/USD':   { symbol: 'BTC',   icon: '₿', decimals: 2, layer: 'on-chain', network: 'mainnet-only', binanceSymbol: 'btcusdt' },
  'ETH/USD':   { symbol: 'ETH',   icon: 'Ξ', decimals: 2, layer: 'on-chain', network: 'mainnet-only', binanceSymbol: 'ethusdt' },
  'POL/USD':   { symbol: 'POL',   icon: '⬡', decimals: 4, layer: 'on-chain', network: 'all', binanceSymbol: 'polusdt' },
  // Forex (signals only)
  'EUR/USD':   { symbol: 'EUR',   icon: '€', decimals: 5, layer: 'signal', network: 'all', description: 'AI Signals Only' },
  'GBP/USD':   { symbol: 'GBP',   icon: '£', decimals: 5, layer: 'signal', network: 'all', description: 'AI Signals Only' },
  'USD/JPY':   { symbol: 'JPY',   icon: '¥', decimals: 3, layer: 'signal', network: 'all', description: 'AI Signals Only' },
  'XAU/USD':   { symbol: 'XAU',   icon: '🥇', decimals: 2, layer: 'signal', network: 'all', description: 'Gold (AI Signals Only)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

export const isTradingMarket = (pair: string): boolean =>
  (V1_TRADING_MARKETS as readonly string[]).includes(pair);

export const isSignalMarket = (pair: string): boolean =>
  (V1_SIGNAL_MARKETS as readonly string[]).includes(pair);

export const getMarketMeta = (pair: string): MarketMeta | undefined =>
  MARKET_METADATA[pair];

export const getAmoyTradingMarkets = (): string[] => [...V1_AMOY_MARKETS];
export const getMainnetTradingMarkets = (): string[] => [...V1_MAINNET_MARKETS];

export const getMarketsForMode = (mode: 'demo' | 'live'): string[] =>
  mode === 'demo'
    // Demo: all pairs available (off-chain settlement, prices from Binance + Twelve Data)
    ? [...V1_TRADING_MARKETS, ...V1_SIGNAL_MARKETS]
    // Live: only Chainlink-backed crypto on mainnet
    : getMainnetTradingMarkets();

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
