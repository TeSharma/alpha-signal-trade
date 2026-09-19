import type { DynamicLogoState } from '@/lib/logos';

/**
 * PHASE 2 — Dynamic Logo State Engine: types and configuration.
 *
 * Pure, read-only, deterministic. Nothing here reads live market data, AI APIs,
 * wallet state, Supabase state, oracle code or trading contracts — the engine
 * simply maps a caller-supplied snapshot onto one of the existing
 * `DynamicLogoState` brand states from `src/lib/logos.ts`.
 *
 * `DynamicLogoState` is imported rather than re-declared so the engine can never
 * drift from the asset registry.
 */

/** Directional bias of the market snapshot. */
export type MarketBias = 'bullish' | 'bearish' | 'neutral';

/**
 * A point-in-time snapshot fed to the state engine.
 *
 * These are plain values supplied by the caller. The engine never fetches them;
 * a later milestone owns deciding where they come from.
 */
export interface DynamicLogoInput {
  marketBias: MarketBias;
  /** Signal strength, expected 0–100. */
  signalStrength: number;
  /** Volatility, expected 0–100. */
  volatility: number;
  aiAnalyzing: boolean;
  onChainActivity: boolean;
}

/** Shape of the engine's configurable cut-offs. */
export interface DynamicLogoThresholds {
  strongSignal: number;
  highVolatility: number;
}

/** Configurable thresholds. At or above each value the corresponding state wins. */
export const DYNAMIC_LOGO_THRESHOLDS = {
  strongSignal: 80,
  highVolatility: 70,
} as const satisfies DynamicLogoThresholds;

/** One rung of the precedence ladder, used for documentation and display. */
export interface DynamicLogoPrecedenceRule {
  /** 1 is evaluated first; the first matching rule wins. */
  order: number;
  state: DynamicLogoState;
  label: string;
  /** Human-readable condition, mirroring `getDynamicLogoState`. */
  condition: string;
}

/**
 * The precedence ladder, highest priority first. Descriptive only — it exists so
 * the dev showcase and tests can display the rules without duplicating the
 * engine's branching logic.
 */
export const DYNAMIC_LOGO_PRECEDENCE: readonly DynamicLogoPrecedenceRule[] = [
  {
    order: 1,
    state: 'onChain',
    label: 'On-Chain',
    condition: 'onChainActivity === true',
  },
  {
    order: 2,
    state: 'aiAnalyzing',
    label: 'AI Analyzing',
    condition: 'aiAnalyzing === true',
  },
  {
    order: 3,
    state: 'highVolatility',
    label: 'High Volatility',
    condition: `volatility >= ${DYNAMIC_LOGO_THRESHOLDS.highVolatility}`,
  },
  {
    order: 4,
    state: 'strongSignal',
    label: 'Strong Signal',
    condition: `signalStrength >= ${DYNAMIC_LOGO_THRESHOLDS.strongSignal}`,
  },
  {
    order: 5,
    state: 'bullish',
    label: 'Bullish',
    condition: "marketBias === 'bullish'",
  },
  {
    order: 6,
    state: 'bearish',
    label: 'Bearish',
    condition: "marketBias === 'bearish'",
  },
  {
    order: 7,
    state: 'neutral',
    label: 'Neutral',
    condition: 'otherwise (fallback)',
  },
] as const;

