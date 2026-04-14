

# Signal System Upgrade

## Overview
Seven upgrades to the signal generation, filtering, execution, and feedback loop.

## Changes

### 1. Edge Function: `generate-signal/index.ts` — Tighten thresholds & M30 timeframe

- Change default timeframe from `"15m"` to `"30m"`
- Change expiry for `"30m"` from 60 to 40 minutes (30-45 range)
- Raise confidence filter from `0.60` to `0.75`
- Add RR filter: reject signals with `rr_ratio < 2.2`
- Add duplicate check: before inserting, query `trading_signals` for existing active signal with same `pair` — skip if found
- Add performance feedback: query `signal_performance` for recent results by pair/strategy and inject win rate stats into the AI system prompt so the model self-corrects

### 2. Edge Function: `evaluate-signals/index.ts` — Add expired signal cleanup

- After evaluating signals, delete (or mark) signals that expired more than 24 hours ago to keep the table clean

### 3. Update cron jobs (via SQL insert tool)

- Update `generate-signals-batch` schedule from `*/15` to `*/30`
- Add new cron job `cleanup-expired-signals` that runs every 6 hours, setting old expired signals' status and cleaning up

### 4. Frontend: `useSignals.ts` — Limit to top 5

- Change `.limit(50)` to `.limit(5)` and ensure `order('confidence', { ascending: false })`

### 5. Frontend: `useSignalList.ts` — Limit to top 5

- Change `pageSize` default from `20` to `5`

### 6. Frontend: `EnhancedSignalCard.tsx` — Wire Execute Trade to real flow

- Replace the simulated `setTimeout` in `handleExecuteTrade` with actual call to `execute-trade` edge function via `supabase.functions.invoke('execute-trade', { body: { signal_id, account_mode } })`
- On success, show trade details; on failure, show error

### 7. Signals page header text

- Update description from "every 15 minutes" to "every 30 minutes"

## Files to modify

| File | Change |
|------|--------|
| `supabase/functions/generate-signal/index.ts` | Confidence ≥ 0.75, RR ≥ 2.2, duplicate check, M30 default, 40min expiry, performance feedback in prompt |
| `supabase/functions/evaluate-signals/index.ts` | Add cleanup of signals expired > 24h |
| `src/hooks/useSignals.ts` | Limit to 5, order by confidence desc |
| `src/hooks/useSignalList.ts` | Change pageSize to 5 |
| `src/components/signals/EnhancedSignalCard.tsx` | Wire Execute Trade to `execute-trade` edge function |
| `src/pages/Signals.tsx` | Update "every 15 minutes" text to "every 30 minutes" |
| Cron SQL (insert tool) | Update batch schedule to `*/30`, add cleanup cron |

## Technical Details

**Performance feedback loop**: Before generating a signal for a pair, the edge function will query `signal_performance` for the last 20 results for that pair. It calculates win rate and avg PnL, then includes this in the AI system prompt: "Historical performance for BTC/USD: 65% win rate, avg PnL +1.2%. Adjust your analysis accordingly."

**Duplicate prevention**: `SELECT id FROM trading_signals WHERE pair = $pair AND status = 'active' LIMIT 1` — if a row exists, skip generation for that pair.

**Cleanup cron**: Runs every 6 hours. Updates signals with `status = 'active'` and `expires_at < now()` to `status = 'expired'`, then deletes signals with `status = 'expired'` and `expires_at < now() - interval '24 hours'`.

