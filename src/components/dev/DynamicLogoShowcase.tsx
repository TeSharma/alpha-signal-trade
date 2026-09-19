import { DynamicLogo } from '@/components/ui/DynamicLogo';
import { DYNAMIC_LOGO_ASSETS, type DynamicLogoState } from '@/lib/logos';

/**
 * DEV-ONLY showcase for the Dynamic Logo system.
 *
 * Not routed in production (the route in `App.tsx` sits behind
 * `import.meta.env.DEV`) and never added to the landing page. It exists purely so
 * all seven dynamic brand states can be inspected side by side on both light and
 * dark surfaces.
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

export function DynamicLogoShowcase() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dynamic Logo — Showcase</h1>
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
      </div>
    </div>
  );
}

export default DynamicLogoShowcase;