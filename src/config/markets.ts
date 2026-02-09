// Centralized market configuration for v1 mainnet strategy
// Layer 1: AI Signal markets (Forex) - no on-chain execution
// Layer 2: On-Chain Trading markets (Crypto) - Chainlink-backed

export interface MarketMeta {
  symbol: string;
  icon: string;
  decimals: number; // Display precision
  layer: 'on-chain' | 'signal';
  description?: string;
}

// ─── ON-CHAIN TRADING MARKETS (Crypto – Chainlink required) ──────────────
export const V1_TRADING_MARKETS = ['BTC/USD', 'ETH/USD', 'MATIC/USD'] as const;
export type V1TradingPair = typeof V1_TRADING_MARKETS[number];

// ─── AI SIGNAL MARKETS (Forex – no oracle needed) ────────────────────────
export const V1_SIGNAL_MARKETS = ['EUR/USD', 'GBP/USD', 'USD/JPY'] as const;
export type V1SignalPair = typeof V1_SIGNAL_MARKETS[number];

// Combined metadata for all v1 markets
export const MARKET_METADATA: Record<string, MarketMeta> = {
  // Crypto (on-chain)
  'BTC/USD':   { symbol: 'BTC',   icon: '₿', decimals: 2, layer: 'on-chain' },
  'ETH/USD':   { symbol: 'ETH',   icon: 'Ξ', decimals: 2, layer: 'on-chain' },
  'MATIC/USD': { symbol: 'MATIC', icon: '⬡', decimals: 4, layer: 'on-chain' },
  // Forex (signals only)
  'EUR/USD':   { symbol: 'EUR',   icon: '€', decimals: 5, layer: 'signal', description: 'AI Signals Only' },
  'GBP/USD':   { symbol: 'GBP',   icon: '£', decimals: 5, layer: 'signal', description: 'AI Signals Only' },
  'USD/JPY':   { symbol: 'JPY',   icon: '¥', decimals: 3, layer: 'signal', description: 'AI Signals Only' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

export const isTradingMarket = (pair: string): boolean =>
  (V1_TRADING_MARKETS as readonly string[]).includes(pair);

export const isSignalMarket = (pair: string): boolean =>
  (V1_SIGNAL_MARKETS as readonly string[]).includes(pair);

export const getMarketMeta = (pair: string): MarketMeta | undefined =>
  MARKET_METADATA[pair];

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
