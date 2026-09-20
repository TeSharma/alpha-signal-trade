import type { DynamicLogoState } from '@/lib/logos';
import type { DynamicLogoInput } from './types';
import type { DynamicLogoSource } from './adapters';

/**
 * Canonical, deterministic adapter cases.
 *
 * These are pure data — the single source of truth shared by the dev showcase
 * matrix and by any future test runner. They assert both the built
 * `DynamicLogoInput` and the derived `DynamicLogoState`.
 *
 * Only `source` values that the application genuinely holds are used. `volatility`,
 * `aiAnalyzing` and `onChainActivity` appear only in the explicit opt-in cases,
 * which document how a later phase can escalate those states.
 */
export interface DynamicLogoAdapterCase {
  name: string;
  description: string;
  source: DynamicLogoSource;
  /** Only the keys under assertion; every listed key must match exactly. */
  expectedInput: Partial<DynamicLogoInput>;
  expectedState: DynamicLogoState;
}

export const DYNAMIC_LOGO_ADAPTER_CASES: readonly DynamicLogoAdapterCase[] = [
  {
    name: 'valid strong signal',
    description: 'Existing signal strength above the threshold derives strongSignal.',
    source: { signal: { signal_strength: 92, direction: 'LONG', status: 'active' } },
    expectedInput: {
      marketBias: 'bullish',
      signalStrength: 92,
      volatility: 0,
      aiAnalyzing: false,
      onChainActivity: false,
    },
    expectedState: 'strongSignal',
  },
  {
    name: 'bullish signal',
    description: 'LONG direction below the threshold derives bullish.',
    source: { signal: { signal_strength: 64, direction: 'LONG' } },
    expectedInput: { marketBias: 'bullish', signalStrength: 64 },
    expectedState: 'bullish',
  },
  {
    name: 'bearish signal',
    description: 'SHORT direction below the threshold derives bearish.',
    source: { signal: { signal_strength: 55, direction: 'SHORT' } },
    expectedInput: { marketBias: 'bearish', signalStrength: 55 },
    expectedState: 'bearish',
  },
  {
    name: 'no signal',
    description: 'Nothing loaded → neutral with all optional inputs off.',
    source: {},
    expectedInput: {
      marketBias: 'neutral',
      signalStrength: 0,
      volatility: 0,
      aiAnalyzing: false,
      onChainActivity: false,
    },
    expectedState: 'neutral',
  },
  {
    name: 'malformed signal strength',
    description: 'A non-numeric strength cannot throw and cannot satisfy a threshold.',
    // Simulates untrusted runtime data (e.g. a malformed DB/JSON row), which is
    // exactly what `normalizeSignalStrength` exists to absorb — hence the cast.
    source: { signal: { signal_strength: 'abc' as unknown as number, direction: 'LONG' } },
    expectedInput: { marketBias: 'bullish', signalStrength: 0 },
    expectedState: 'bullish',
  },
  {
    name: 'no AI state -> false',
    description: 'Absent AI state stays false, so aiAnalyzing never fires.',
    source: { signal: { signal_strength: 99, direction: 'LONG' } },
    expectedInput: { aiAnalyzing: false },
    expectedState: 'strongSignal',
  },
  {
    name: 'no on-chain state -> false',
    description: 'Absent on-chain state stays false, so onChain never fires.',
    source: { signal: { signal_strength: 99, direction: 'SHORT' } },
    expectedInput: { onChainActivity: false },
    expectedState: 'strongSignal',
  },
  {
    name: 'confidence fallback (0-1 fraction)',
    description: 'A 0-1 confidence is scaled, mirroring the existing SignalCard convention.',
    source: { signal: { confidence: 0.85, direction: 'LONG' } },
    expectedInput: { signalStrength: 85, marketBias: 'bullish' },
    expectedState: 'strongSignal',
  },
  {
    name: 'null strength falls back to confidence',
    description: 'signal_strength null uses the existing confidence value.',
    source: { signal: { signal_strength: null, confidence: 70, direction: 'SHORT' } },
    expectedInput: { signalStrength: 70, marketBias: 'bearish' },
    expectedState: 'bearish',
  },
  {
    name: 'terminal status ignored',
    description: 'A closed signal is not usable, so its strength is disregarded.',
    source: { signal: { signal_strength: 99, direction: 'LONG', status: 'closed' } },
    expectedInput: { signalStrength: 0, marketBias: 'neutral' },
    expectedState: 'neutral',
  },
  {
    name: 'unknown direction ignored',
    description: 'An unrecognised direction is neutral, never invented as bullish/bearish.',
    source: { signal: { signal_strength: 99, direction: 'sideways' } },
    expectedInput: { signalStrength: 0, marketBias: 'neutral' },
    expectedState: 'neutral',
  },
  {
    name: 'strength clamped to 100',
    description: 'An out-of-range strength is clamped, not enlarged.',
    source: { signal: { signal_strength: 250, direction: 'LONG' } },
    expectedInput: { signalStrength: 100 },
    expectedState: 'strongSignal',
  },
  {
    name: 'opt-in volatility escalates',
    description: 'Documents how a later phase can reach highVolatility once a source exists.',
    source: { signal: { signal_strength: 95, direction: 'LONG' }, volatility: 72 },
    expectedInput: { volatility: 72 },
    expectedState: 'highVolatility',
  },
  {
    name: 'opt-in AI state escalates',
    description: 'Documents how a later phase can reach aiAnalyzing once a source exists.',
    source: { signal: { signal_strength: 95, direction: 'LONG' }, aiAnalyzing: true },
    expectedInput: { aiAnalyzing: true },
    expectedState: 'aiAnalyzing',
  },
  {
    name: 'opt-in on-chain state escalates',
    description: 'Documents how a later phase can reach onChain once a source exists.',
    source: {
      signal: { signal_strength: 95, direction: 'LONG' },
      aiAnalyzing: true,
      onChainActivity: true,
    },
    expectedInput: { onChainActivity: true },
    expectedState: 'onChain',
  },
];
