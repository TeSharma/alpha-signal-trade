

## AI Trading OS: Signal Intelligence Layer

### Current State

- **Signals page** (`src/pages/Signals.tsx`): Hardcoded mock signals, no AI backend
- **TradingForm**: Uses a mock `checkAISignal()` that returns `Math.random()` confidence
- **Server** (`src/server.js`): Express server that cannot run in Lovable (no Node backend)
- **Database**: `trading_signals` table exists in Supabase with `confidence`, `direction`, `pair`, `recommendation`, `signal_data` columns
- **No edge functions** exist yet
- **No LOVABLE_API_KEY** configured (only `HEDERA_OPERATOR_KEY` in secrets)

### Architecture

```text
Frontend (React)
  ├── Signals Page → calls Edge Function → renders signal cards
  ├── TradingForm → calls Edge Function → pre-trade AI check
  └── Execution Adapter
        ├── Crypto → useOnChainTradingV2 (existing)
        └── Forex → manual display (existing)

Supabase Edge Functions
  ├── generate-signal (POST)
  │     ├── Fetches OHLCV from public APIs (Binance for crypto)
  │     ├── Calls Lovable AI (Gemini) with structured tool calling
  │     ├── Returns Signal Object (spec format)
  │     └── Stores in trading_signals table
  └── check-signal (POST)
        ├── Lightweight pre-trade check
        └── Returns confidence + recommendation
```

### Implementation Plan

This is a multi-phase build. Phase 1 gets real AI signals flowing end-to-end.

#### Phase 1: Backend (Edge Functions)

**1a. Enable Lovable AI Gateway**
- Add `LOVABLE_API_KEY` secret (auto-provisioned)

**1b. Create `generate-signal` edge function**
- Accepts `{ pair, timeframe }` 
- Fetches current price from public API (Binance ticker for crypto, a forex API for FX)
- Computes context data internally: session (ASIA/LONDON/NEW_YORK based on UTC hour), day of week, basic volatility estimate from price range
- Calls Lovable AI with structured tool calling to extract the Signal Object:
  - Uses `google/gemini-3-flash-preview` as the model
  - System prompt encodes the 5-engine logic (Trend, Structure, Momentum, Risk, Confidence)
  - Tool schema matches the spec's Signal Object exactly
- Applies confidence threshold (< 0.60 = do not publish)
- Stores valid signals in `trading_signals` table with full `signal_data` JSON
- Returns the signal to the client

**1c. Create `check-signal` edge function**
- Lighter version for pre-trade validation in TradingForm
- Returns `{ confidence, direction, recommendation, explanation[] }`

**1d. Update `supabase/config.toml`** to register both functions

#### Phase 2: Database Migration

**2a. Extend `trading_signals` table**
- Add columns: `market` (FOREX/CRYPTO), `entry_zone` (jsonb), `stop_loss` (numeric), `take_profit` (jsonb), `timeframe`, `strategy`, `risk_data` (jsonb), `explanation` (text[]), `execution_type` (ON_CHAIN/MANUAL), `expires_at` (timestamptz), `status` (active/expired/executed)
- Add index on `(pair, status, created_at)`

#### Phase 3: Frontend - Signals Page

**3a. Replace mock signals with real data**
- Create `useSignals` hook that:
  - Fetches active signals from `trading_signals` table
  - Calls `generate-signal` edge function on demand (manual refresh)
  - Subscribes to realtime updates
- Signal cards render the full Signal Object (entry zone, SL, TP[], confidence, explanation, execution type)
- "Approve" button for crypto signals pre-fills TradingForm parameters
- "Approve" for forex signals shows copy-to-broker instructions

**3b. Replace mock `checkAISignal` in TradingForm**
- Call `check-signal` edge function instead of `Math.random()`

#### Phase 4: Execution Adapter (1-Click Bridge)

**4a. Crypto execution adapter**
- When user approves a crypto signal, pre-fill `useOnChainTradingV2.openPosition` with signal parameters
- Map signal's `entry_zone`, `stop_loss`, `take_profit[0]` to contract params
- Existing on-chain flow handles the rest (approval, execution, confirmation)

**4b. Forex manual execution**
- Display formatted trade parameters for manual broker entry
- Future: broker API integration placeholder

### Delete

- `src/server.js` -- Express server that can't run in Lovable; replaced by edge functions

### Files to Create/Modify

| File | Action |
|---|---|
| `supabase/functions/generate-signal/index.ts` | Create -- AI signal generation |
| `supabase/functions/check-signal/index.ts` | Create -- pre-trade AI check |
| `supabase/config.toml` | Update -- register functions |
| `src/hooks/useSignals.ts` | Create -- signal fetching + realtime |
| `src/pages/Signals.tsx` | Rewrite -- real signals, execution adapter |
| `src/components/trading/TradingForm.tsx` | Update -- replace mock checkAISignal |
| `src/types/signal.ts` | Create -- Signal Object TypeScript type |
| DB migration | Extend `trading_signals` table |

### Technical Notes

- The AI system prompt will encode the 5-engine analysis framework. The LLM acts as the "intelligence layer" -- it receives market context and produces structured signal output via tool calling. This is deterministic in structure but ML-assisted in analysis.
- Confidence thresholds enforced server-side: signals below 0.60 are never stored or returned.
- AI logic is identical in demo and live modes (per spec: "AI logic does not change between modes").
- The Signal Object format from the spec is used as-is for the tool calling schema.
- OHLCV data will initially come from Binance public API (no key needed for ticker data). For forex, we'll use a free endpoint or compute from spread estimates until a proper data source is configured.

