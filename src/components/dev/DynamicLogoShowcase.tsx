import { DynamicLogo } from '@/components/ui/DynamicLogo';
import { DYNAMIC_LOGO_ASSETS, type DynamicLogoState } from '@/lib/logos';
import { getDynamicLogoState } from '@/lib/dynamicLogo/stateEngine';
import {
  DYNAMIC_LOGO_PRECEDENCE,
  DYNAMIC_LOGO_THRESHOLDS,
  type DynamicLogoInput,
} from '@/lib/dynamicLogo/types';

/**
 * DEV-ONLY showcase for the Dynamic Logo system.
 *
 * Not routed in production (the route in `App.tsx` sits behind
 * `import.meta.env.DEV`) and never added to the landing page. It exists purely so
 * all seven dynamic brand states can be inspected side by side on both light and
 * dark surfaces, and so the Phase 2 state engine can be exercised against
 * hand-written deterministic inputs.
 *
 * It renders assets only: no market data, AI state, chain state or animation.
 */

/** Human-readable labels. `satisfies` fails the build if a state is ever missed. */
const LABELS = {
  neutral: 'Neutral',
  bullish: 'Bullish',
  bearish: 'Bearish',
  strongSignal: 'Strong Signal',
  highVolatility: 'High Volatility',
  aiAnalyzing: 'AI Analyzing',
  onChain: 'On-Chain',
} satisfies Record<DynamicLogoState, string>;

/** Derived from the registry so a newly registered asset appears automatically. */
const STATES = Object.keys(DYNAMIC_LOGO_ASSETS) as DynamicLogoState[];

/** A hand-written snapshot plus why it is interesting. */
interface ShowcaseCase {
  label: string;
  note: string;
  input: DynamicLogoInput;
}
/** Baseline input - every field "off", so each case below isolates one condition. */
const BASELINE: DynamicLogoInput = {
  marketBias: 'neutral',
  signalStrength: 0,
  volatility: 0,
  aiAnalyzing: false,
  onChainActivity: false,
};

/**
 * Deterministic fixtures. These are literal values - no market feed, AI call,
 * wallet or chain lookup is involved anywhere in this file.
 */
const CASES: ShowcaseCase[] = [
  {
    label: 'Neutral',
    note: 'Nothing active, no directional bias.',
    input: { ...BASELINE },
  },
  {
    label: 'Bullish',
    note: 'Upward bias, below both thresholds.',
    input: { ...BASELINE, marketBias: 'bullish', signalStrength: 62, volatility: 30 },
  },
  {
    label: 'Bearish',
    note: 'Downward bias, below both thresholds.',
    input: { ...BASELINE, marketBias: 'bearish', signalStrength: 55, volatility: 25 },
  },
  {
    label: 'Strong Signal',
    note: `signalStrength >= ${DYNAMIC_LOGO_THRESHOLDS.strongSignal} (rule 4) beats bias.`,
    input: { ...BASELINE, marketBias: 'bearish', signalStrength: 88, volatility: 20 },
  },
  {
    label: 'High Volatility',
    note: `volatility >= ${DYNAMIC_LOGO_THRESHOLDS.highVolatility} (rule 3) beats strong signal.`,
    input: { ...BASELINE, marketBias: 'bullish', signalStrength: 95, volatility: 74 },
  },
  {
    label: 'AI Analyzing',
    note: 'aiAnalyzing (rule 2) beats volatility and signal.',
    input: {
      ...BASELINE,
      marketBias: 'bullish',
      signalStrength: 99,
      volatility: 88,
      aiAnalyzing: true,
    },
  },
  {
    label: 'On-Chain',
    note: 'onChainActivity (rule 1) beats everything.',
    input: {
      ...BASELINE,
      marketBias: 'bearish',
      signalStrength: 100,
      volatility: 100,
      aiAnalyzing: true,
      onChainActivity: true,
    },
  },
  {
    label: 'Precedence 4 > 5',
    note: 'Strong signal outranks bullish bias.',
    input: { ...BASELINE, marketBias: 'bullish', signalStrength: 80, volatility: 10 },
  },
  {
    label: 'Precedence 3 > 4',
    note: 'Boundary volatility outranks boundary signal.',
    input: { ...BASELINE, marketBias: 'bullish', signalStrength: 80, volatility: 70 },
  },
  {
    label: 'Precedence 2 > 3',
    note: 'AI analyzing outranks volatility and signal.',
    input: { ...BASELINE, signalStrength: 90, volatility: 90, aiAnalyzing: true },
  },
  {
    label: 'Precedence 1 > 2',
    note: 'On-chain outranks AI analyzing.',
    input: { ...BASELINE, aiAnalyzing: true, onChainActivity: true },
  },
  {
    label: 'Below threshold',
    note: 'Just under both cut-offs, so bias decides.',
    input: { ...BASELINE, marketBias: 'bearish', signalStrength: 79, volatility: 69 },
  },
];

/** Renders a fixture, showing INPUT &gt; DERIVED STATE &gt; LOGO. */
function StateEngineCase({ testCase }: { testCase: ShowcaseCase }) {
  const state = getDynamicLogoState(testCase.input);
  const inputEntries = Object.entries(testCase.input) as [keyof DynamicLogoInput, unknown][];

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{testCase.label}</h3>
        <p className="mt-1 text-xs text-gray-600">{testCase.note}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-4">
        <dl className="space-y-1 text-[11px]">
          {inputEntries.map(([key, value]) => (
            <div key={String(key)} className="flex justify-between gap-2">
              <dt className="text-gray-500">{key}</dt>
              <dd className="font-mono text-gray-900">{String(value)}</dd>
            </div>
          ))}
        </dl>
        <DynamicLogo state={state} className="h-16 w-16" />
      </div>

      <div className="mt-auto border-t border-gray-200 bg-gray-50 px-4 py-2">
        <code className="text-[11px] text-gray-500">&gt; derived state: </code>
        <code className="text-[11px] font-semibold text-gray-900">{state}</code>
      </div>
    </section>
  );
}

export function DynamicLogoShowcase() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dynamic Logo â€” Showcase</h1>
          <p className="mt-2 text-sm text-gray-600">
            Development-only preview of the {STATES.length} dynamic brand states. Each state is
            rendered on both background colourways so ink contrast can be verified.
          </p>
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Not part of production. These assets are not connected to live market data, AI, signal
            or trading state.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STATES.map((state) => (
            <section
              key={state}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">{LABELS[state]}</h2>
                <code className="text-xs text-gray-500">{state}</code>
              </div>

              {/* Light surface */}
              <div className="flex items-center justify-center bg-white px-4 py-6">
                <DynamicLogo state={state} className="h-20 w-20" />
              </div>

              {/* Dark surface */}
              <div
                className="flex items-center justify-center px-4 py-6"
                style={{ backgroundColor: '#0B1220' }}
              >
                <DynamicLogo state={state} className="h-20 w-20" />
              </div>

              <div className="border-t border-gray-200 px-4 py-2">
                <code className="break-all text-[11px] text-gray-400">
                  {DYNAMIC_LOGO_ASSETS[state]}
                </code>
              </div>
            </section>
          ))}
        </div>

        {/* ---- Phase 2: deterministic state engine ---- */}
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900">State Engine</h2>
          <p className="mt-2 text-sm text-gray-600">
            INPUT &gt; DERIVED STATE &gt; LOGO. Every fixture below is a hard-coded object passed to the
            pure <code className="rounded bg-gray-200 px-1">getDynamicLogoState()</code> function.
            No live data is read and nothing is fetched.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Thresholds - strongSignal: <strong>{DYNAMIC_LOGO_THRESHOLDS.strongSignal}</strong>,
            highVolatility: <strong>{DYNAMIC_LOGO_THRESHOLDS.highVolatility}</strong>
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CASES.map((testCase) => (
              <StateEngineCase key={testCase.label} testCase={testCase} />
            ))}
          </div>
        </section>

        {/* ---- Precedence ladder ---- */}
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-gray-900">Precedence</h2>
          <p className="mt-2 text-sm text-gray-600">First match wins, top to bottom.</p>

          <ol className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {DYNAMIC_LOGO_PRECEDENCE.map((rule) => (
              <li
                key={rule.order}
                className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">
                  {rule.order}
                </span>
                <code className="text-xs text-gray-700">{rule.condition}</code>
                <span className="text-xs text-gray-400">&gt;</span>
                <code className="text-xs font-semibold text-gray-900">{rule.state}</code>
                <span className="text-xs text-gray-500">({rule.label})</span>
                <DynamicLogo state={rule.state} className="ml-auto h-8 w-8" />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

export default DynamicLogoShowcase;
