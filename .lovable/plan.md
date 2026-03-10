

# Centralized Signal Generation

## Problem
Currently every user can trigger `generate-signal` edge function directly, burning AI credits per user. Signals should be generated centrally and shared.

## Changes

### 1. Create a new edge function: `generate-signals-batch`
A server-only function that loops through all supported pairs and timeframes, calls the AI, and stores signals. This will be invoked by the existing cron job instead of `evaluate-signals`.

Actually, simpler approach: **reuse the existing `generate-signal` function** but add a second cron job that calls it for each pair. The function already stores signals with `user_id = null` (public signals).

### 2. Update cron job (SQL insert)
Schedule `generate-signal` to run every 15 minutes for each supported pair (BTC/USD, ETH/USD, POL/USD, EUR/USD, GBP/USD, USD/JPY). This means 6 sequential HTTP calls from a single cron job, or 6 separate cron entries.

### 3. Update `useSignals` hook
- Remove `generateSignal` function entirely (no client-side AI invocation)
- Replace with just `refreshSignals` (re-fetch from DB)
- Keep real-time subscription as-is

### 4. Update `Signals.tsx` page
- Remove pair/timeframe selectors (signals are pre-generated for all pairs)
- Rename "Generate Signal" button to "Refresh Signals"
- Button calls `refreshSignals()` instead of `generateSignal()`
- Add client-side pair filter dropdown to filter displayed signals by pair
- Remove `isGenerating` state references

### 5. Update `generate-signal/index.ts`
- Ensure signals are always stored with `user_id = null` so they're visible to all users via the existing RLS policy ("Anyone can view public signals" where `user_id IS NULL`)

## Files to modify

| File | Change |
|------|--------|
| `src/hooks/useSignals.ts` | Remove `generateSignal`, keep `refreshSignals` only |
| `src/pages/Signals.tsx` | Rename button to "Refresh Signals", remove AI generation, add pair filter for display |
| `supabase/functions/generate-signal/index.ts` | Ensure `user_id` is always null for centralized signals |
| Cron SQL (via insert tool) | Add scheduled calls for all 6 pairs every 15 min |

## Cron Strategy
Single cron job that calls a new batch wrapper, OR modify `generate-signal` to accept a `batch: true` param that iterates all pairs. The batch approach is cleaner -- one cron entry, one function call that generates for all pairs.

