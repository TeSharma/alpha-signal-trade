import type { DynamicLogoState } from '@/lib/logos';
import { getDynamicLogoState } from './stateEngine';
import type { DynamicLogoInput, MarketBias } from './types';

/**
 * PHASE 3 — Adapter: existing application state → DynamicLogoInput.
 *
 * Every helper here is pure and synchronous. This module performs NO I/O: no
 * fetch, no Supabase client, no Web3 provider, no wallet call, no transaction,
 * no timer. It only maps values that React components have already loaded.
 */

/**
 * Minimal structural view of an existing ShTrader signal.
 *
 * Deliberately narrower than `SignalObject` so the adapter stays decoupled and
 * trivially testable. `signal_strength` is the `signal_overview` view's alias of
 * `confidence`; `confidence` is accepted as a fallback for sources that expose
 * only the raw column. The passed object is only ever read, never mutated.
 */
export interface DynamicLogoSignalSource {
  signal_strength?: number | null;
  confidence?: number | null;
  direction?: string | null;
  status?: string | null;
}

/**
 * Anything the engine can be built from.
 *
 * `volatility`, `aiAnalyzing` and `onChainActivity` are explicit opt-ins: the
 * application does not currently expose trustworthy values for them, so they
 * stay `0`/`false` unless a caller that genuinely has them passes them in.
 */
export interface DynamicLogoSource {
  signal?: DynamicLogoSignalSource | null;
  volatility?: number | null;
  aiAnalyzing?: boolean | null;
  onChainActivity?: boolean | null;
}

const BULLISH_DIRECTIONS = new Set(['long', 'buy']);
const BEARISH_DIRECTIONS = new Set(['short', 'sell']);
const UNUSABLE_STATUSES = new Set(['closed', 'expired', 'cancelled', 'canceled']);

/**
 * Normalizes an existing signal-strength reading to 0–100.
 *
 * The value is the application's own confidence metric (`signal_strength` in the
 * `signal_overview` view is `s.confidence`); no new metric is calculated here.
 * Mirrors the existing `SignalCard` convention, which treats a value of `1` or
 * less as a 0–1 fraction and anything larger as a percentage.
 */
export function normalizeSignalStrength(raw: unknown): number {
  const value = toFiniteNumber(raw);
  if (value === null || value <= 0) return 0;
  const percent = value <= 1 ? value * 100 : value;
  return clamp(percent, 0, 100);
}

/** Signal strength from an existing signal, or `0` when there is none to use. */
export function resolveSignalStrength(signal?: DynamicLogoSignalSource | null): number {
  if (!isUsableSignal(signal)) return 0;
  return normalizeSignalStrength(signal?.signal_strength ?? signal?.confidence);
}

/**
 * Volatility indicator.
 *
 * LIMITATION: the application exposes no volatility value to components. The only
 * one in the codebase lives inside the `confirm-trade` edge function as an ATR
 * classification for a single trade confirmation, which is not application state.
 * Rather than invent a model or add a data provider, this returns `0` unless a
 * caller supplies an explicit value.
 */
export function resolveVolatility(source?: DynamicLogoSource | null): number {
  const value = toFiniteNumber(source?.volatility);
  if (value === null) return 0;
  return clamp(value, 0, 100);
}

/**
 * AI-analysis indicator.
 *
 * LIMITATION: there is no genuine AI/signal-generation loading state in the
 * application. `isLoading`/`isRefreshing` on the signal hooks are data-fetch
 * states, not AI analysis, so they are deliberately NOT mapped here. Defaults to
 * `false`.
 */
export function resolveAiAnalyzing(source?: DynamicLogoSource | null): boolean {
  return source?.aiAnalyzing === true;
}

/**
 * On-chain activity indicator.
 *
 * LIMITATION: no trustworthy read-only on-chain activity state is available
 * without mounting a blockchain subscription, which Phase 3 must not do. The
 * existing `oracleAvailable`/`isOraclePrice` flags describe Chainlink price
 * *availability*, not on-chain activity, and reading them would require mounting
 * a market-data poller. Defaults to `false`.
 */
export function resolveOnChainActivity(source?: DynamicLogoSource | null): boolean {
  return source?.onChainActivity === true;
}

/** Maps an existing-state snapshot onto the engine's input shape. */
export function buildDynamicLogoInput(source?: DynamicLogoSource | null): DynamicLogoInput {
  return {
    marketBias: resolveMarketBias(source?.signal),
    signalStrength: resolveSignalStrength(source?.signal),
    volatility: resolveVolatility(source),
    aiAnalyzing: resolveAiAnalyzing(source),
    onChainActivity: resolveOnChainActivity(source),
  };
}

/** Convenience: existing state → input → derived brand state. */
export function deriveDynamicLogoState(
  source?: DynamicLogoSource | null,
): DynamicLogoState {
  return getDynamicLogoState(buildDynamicLogoInput(source));
}

/** Where each input value came from, for the dev showcase and debugging. */
export interface DynamicLogoSourceProvenance {
  signalPresent: boolean;
  signalUsable: boolean;
  signalStrength: 'signal' | 'fallback';
  marketBias: 'signal' | 'fallback';
  volatility: 'explicit' | 'unavailable';
  aiAnalyzing: 'explicit' | 'unavailable';
  onChainActivity: 'explicit' | 'unavailable';
}

/**
 * Describes whether each input is backed by real application state or by the
 * documented fallback. Pure and side-effect free.
 */
export function describeDynamicLogoSource(
  source?: DynamicLogoSource | null,
): DynamicLogoSourceProvenance {
  const usable = isUsableSignal(source?.signal);
  return {
    signalPresent: Boolean(source?.signal),
    signalUsable: usable,
    signalStrength: usable ? 'signal' : 'fallback',
    marketBias: usable ? 'signal' : 'fallback',
    volatility: toFiniteNumber(source?.volatility) === null ? 'unavailable' : 'explicit',
    aiAnalyzing: source?.aiAnalyzing === true ? 'explicit' : 'unavailable',
    onChainActivity:
      source?.onChainActivity === true ? 'explicit' : 'unavailable',
  };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeDirection(raw: unknown): 'bullish' | 'bearish' | null {
  if (typeof raw !== 'string') return null;
  const direction = raw.trim().toLowerCase();
  if (BULLISH_DIRECTIONS.has(direction)) return 'bullish';
  if (BEARISH_DIRECTIONS.has(direction)) return 'bearish';
  return null;
}

/**
 * Direction as a market bias.
 *
 * Only a *usable* signal contributes a bias: no signal, a terminal status
 * (closed/expired/cancelled) or an unrecognised direction all resolve to
 * `neutral`, so a finished signal cannot keep colouring the logo.
 */
export function resolveMarketBias(signal?: DynamicLogoSignalSource | null): MarketBias {
  if (!isUsableSignal(signal)) return 'neutral';
  return normalizeDirection(signal?.direction) ?? 'neutral';
}

/**
 * A signal counts as usable only when it exists, has a recognised direction, and
 * is not in a terminal status. `useSignalList()` already filters to active,
 * unexpired signals — this is a defensive guard for other callers.
 */
export function isUsableSignal(signal?: DynamicLogoSignalSource | null): boolean {
  if (!signal || typeof signal !== 'object') return false;
  const status = typeof signal.status === 'string' ? signal.status.trim().toLowerCase() : '';
  if (UNUSABLE_STATUSES.has(status)) return false;
  return normalizeDirection(signal.direction) !== null;
}
