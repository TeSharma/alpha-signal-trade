import type { DynamicLogoState } from '@/lib/logos';
import {
  DYNAMIC_LOGO_THRESHOLDS,
  type DynamicLogoInput,
  type MarketBias,
} from './types';

/**
 * PHASE 2 - Dynamic Logo State Engine.
 *
 * getDynamicLogoState is a pure function: same input always produces the same
 * output. It performs no network requests, touches no browser API, no wallet
 * state, no Supabase state, no market API and no trading contract. It is
 * deliberately decoupled from every live system.
 */

const FALLBACK_STATE: DynamicLogoState = 'neutral';

/**
 * Coerces an unknown value to a finite number.
 *
 * Only genuine numbers and numeric strings are accepted. Everything else -
 * NaN, Infinity, booleans, arrays, objects, null, undefined, non-numeric or
 * empty strings - becomes 0, so malformed input degrades to "no reading"
 * rather than throwing or accidentally satisfying a threshold. This is
 * deliberately stricter than Number(), which would coerce [999] to 999
 * and true to 1.
 */
function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Accepts any unexpected bias value as the neutral fallback. */
function normalizeMarketBias(value: unknown): MarketBias {
  return value === 'bullish' || value === 'bearish' ? value : 'neutral';
}

/**
 * Derives the dynamic logo brand state from a supplied snapshot.
 *
 * Precedence (first match wins):
 *   1. onChainActivity -> 'onChain'
 *   2. aiAnalyzing -> 'aiAnalyzing'
 *   3. volatility >= highVolatility threshold -> 'highVolatility'
 *   4. signalStrength >= strongSignal threshold -> 'strongSignal'
 *   5. marketBias 'bullish' -> 'bullish'
 *   6. marketBias 'bearish' -> 'bearish'
 *   7. otherwise -> 'neutral'
 */
export function getDynamicLogoState(input: DynamicLogoInput): DynamicLogoState {
  const source = (input ?? {}) as Partial<DynamicLogoInput>;

  const marketBias = normalizeMarketBias(source.marketBias);
  const signalStrength = toFiniteNumber(source.signalStrength);
  const volatility = toFiniteNumber(source.volatility);

  if (source.onChainActivity === true) return 'onChain';
  if (source.aiAnalyzing === true) return 'aiAnalyzing';
  if (volatility >= DYNAMIC_LOGO_THRESHOLDS.highVolatility) return 'highVolatility';
  if (signalStrength >= DYNAMIC_LOGO_THRESHOLDS.strongSignal) return 'strongSignal';
  if (marketBias === 'bullish') return 'bullish';
  if (marketBias === 'bearish') return 'bearish';

  return FALLBACK_STATE;
}
