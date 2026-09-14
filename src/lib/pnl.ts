/**
 * PnL math — must mirror public.calculate_trade_pnl in the database.
 * Crypto pairs use 1× (lot_size = units of base asset).
 * Metals use 100× (gold/silver standard lot = 100 troy ounces).
 * JPY forex pairs use 1 000× (standard JPY lot).
 * Other forex pairs use 100 000× (standard forex lot).
 */

const CRYPTO_PAIRS = new Set([
  'BTC/USD', 'ETH/USD', 'POL/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD',
  'ADA/USD', 'DOGE/USD', 'AVAX/USD', 'MATIC/USD', 'LINK/USD', 'DOT/USD',
]);

/** Metals quoted per troy ounce — one lot is 100 ounces. */
const METAL_PAIRS = new Set(['XAU/USD', 'XAG/USD']);

export function getAssetMultiplier(pair: string): number {
  if (!pair) return 1;
  if (CRYPTO_PAIRS.has(pair)) return 1;
  if (METAL_PAIRS.has(pair)) return 100;
  if (pair.includes('JPY')) return 1000;
  return 100000;
}

export function computePnL(
  pair: string,
  direction: 'buy' | 'sell' | 'LONG' | 'SHORT' | string,
  entryPrice: number,
  currentPrice: number,
  lotSize: number,
): number {
  if (!entryPrice || !currentPrice || !lotSize) return 0;
  const m = getAssetMultiplier(pair);
  const isLong = direction === 'buy' || direction === 'LONG';
  const diff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
  return diff * lotSize * m;
}
