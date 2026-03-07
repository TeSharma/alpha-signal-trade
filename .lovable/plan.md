

## AI Agent Hardening: 5-Priority Implementation

### Priority 1: End-to-End Signal Flow Validation

The edge functions (`generate-signal`, `check-signal`) are registered in `config.toml` and the code exists. The Signals page and `useSignals` hook are wired up. The `LOVABLE_API_KEY` secret is present.

**Action**: Test `generate-signal` via the Supabase test tool, inspect logs, and fix any issues found. The console logs show ref warnings for `MobileSignalTabs` and `SignalList` (function components given refs) -- these need `React.forwardRef` or the ref needs removing.

**Fixes needed**:
- Fix `MobileSignalTabs` / `SignalList` ref warnings in `Signals.tsx` (Radix Tabs passes refs to children)

### Priority 2: Signal Expiry + Validity Guardrails

**Changes to `src/hooks/useSignals.ts`**:
- After mapping signals, filter out expired ones: `expires_at > 0 && expires_at < Date.now()/1000`
- Add `isExpired(signal)` and `isPriceInZone(signal, currentPrice)` helper exports

**Changes to `src/pages/Signals.tsx`**:
- Show expired badge on expired signals, disable Execute button
- Add warning if current price is outside entry zone (requires price data)

### Priority 3: Improve Forex Data Source

**Changes to `supabase/functions/generate-signal/index.ts`**:
- Replace hardcoded `fetchForexPrice` with a call to a free FX API (e.g., `open.er-api.com` or `api.exchangerate.host`)
- Fallback to current estimates if API fails

### Priority 4: Signal-to-Trade Execution Bridge

**Changes to `src/components/trading/TradingForm.tsx`**:
- Import `useLocation` from react-router-dom
- Read `location.state?.prefill` (a `SignalObject`)
- On mount, if prefill exists: set `selectedPair`, `tradeDirection`, `stopLoss`, `takeProfit`
- Show a banner: "Pre-filled from AI Signal — {pair} {direction}"

**Changes to `src/pages/Trade.tsx`**:
- Pass prefill state down to `TradingForm` if needed (or TradingForm reads it directly)

### Priority 5: Signal Metadata & Logging

**Changes to `src/types/signal.ts`**:
- Add optional fields: `model_version?: string`, `signal_strength?: number`

**Changes to `supabase/functions/generate-signal/index.ts`**:
- Add `model_version: "gemini-3-flash-preview"` to the stored signal

**Client-side logging**:
- Log signal generation, view, and execution events via `console.info` (lightweight, no new infra)

### Files to modify

| File | Changes |
|---|---|
| `src/pages/Signals.tsx` | Fix ref warnings, add expiry UI |
| `src/hooks/useSignals.ts` | Filter expired signals, add helpers |
| `supabase/functions/generate-signal/index.ts` | Real forex API, model_version field |
| `src/components/trading/TradingForm.tsx` | Read prefill from location state |
| `src/types/signal.ts` | Add optional metadata fields |

