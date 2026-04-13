

# Fix: Centralized Signal Generation

## Root Cause

The `generate-signal/index.ts` file is a **stub** with no AI logic — it just returns `{"success": true, "message": "Signal generation function initialized"}`. That's exactly what you're seeing. The function was never actually implemented.

## Plan

### Step 1: Rewrite `generate-signal/index.ts` with actual AI logic

Replace the stub with a working function that:
- Accepts `{ pair, timeframe }` OR `{ batch: true }` (for cron)
- Calls the Lovable AI Gateway (same pattern as `check-signal/index.ts`) with structured tool calling
- Inserts results into `trading_signals` table with `user_id = null` (public/shared signals)
- Returns the generated signal data

The AI prompt will request structured output via tool calling with fields: `market`, `pair`, `direction`, `entry_zone`, `stop_loss`, `take_profit`, `confidence`, `strategy`, `risk_level`, `rr_ratio`, `explanation`.

Signals with confidence < 0.6 will be filtered (not inserted).

Expiry set to `now() + interval based on timeframe` (e.g., 15m timeframe → 30min expiry).

### Step 2: Update `useSignals.ts` — remove client-side generation

- Remove `generateSignal` function and `isGenerating` state
- Keep only `fetchSignals` (renamed as `refreshSignals`) and real-time subscription
- The hook returns `{ signals, isLoading, refreshSignals }`

### Step 3: Update `Signals.tsx` — remove Generate button, simplify UI

- Remove the "Generate Signal" dialog, pair/timeframe selectors, and `isGenerating` state
- Keep only "Refresh Signals" button that re-fetches from DB
- Add a simple pair filter dropdown to filter displayed signals client-side
- Remove unused imports (Dialog, Select, Sparkles, etc.)

### Step 4: Schedule cron job for batch generation

Execute SQL (via insert tool) to schedule `generate-signal` with `{ "batch": true }` every 15 minutes. The batch mode will iterate through all 6 pairs (BTC/USD, ETH/USD, POL/USD, EUR/USD, GBP/USD, USD/JPY) and generate signals for each.

### Step 5: Deploy and verify

- Deploy the updated edge function
- Test with curl to confirm AI logic executes and DB insert works
- Verify frontend fetches shared signals correctly

---

## Files

| File | Action |
|------|--------|
| `supabase/functions/generate-signal/index.ts` | **Rewrite** — full AI signal generation with batch support |
| `src/hooks/useSignals.ts` | **Modify** — remove `generateSignal`, keep `refreshSignals` only |
| `src/pages/Signals.tsx` | **Modify** — remove Generate dialog, add pair filter |
| Cron SQL | **Insert** — schedule batch generation every 15 min |

