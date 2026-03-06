

## Fix: Signal Generation "Failed" Error

### Root Cause Analysis

The `generate-signal` edge function works perfectly (confirmed via direct test -- returned valid BTC/USD signal at 72% confidence). Two issues cause the "failed" experience:

**Issue 1: Signals vanish after generation**
- The edge function only stores signals in the DB when the user is authenticated (`if (userId) { insert... }`)
- The `useSignals` hook calls `fetchSignals()` after generating, which queries the DB
- If the user wasn't authenticated when generating, nothing was stored, so the list is empty
- Even when authenticated, the generated signal is returned to the client but the hook ignores the return value and re-fetches from DB

**Issue 2: Possible fetch failure from browser**
- The `generateSignal` function in `useSignals.ts` catches all errors with a generic "Failed to generate signal" toast
- No detailed error is shown -- could be CORS, network, or JSON parse error
- The error is silently swallowed

### Fix Plan

#### 1. Display generated signal immediately (don't rely solely on DB)

In `src/hooks/useSignals.ts`:
- When `generateSignal` returns a valid signal from the edge function, **add it to the local `signals` state immediately** instead of only relying on `fetchSignals()` from DB
- This ensures the signal appears even if DB storage failed or was skipped

#### 2. Store signals for unauthenticated users

In `supabase/functions/generate-signal/index.ts`:
- Remove the `if (userId)` guard -- always attempt to store the signal
- For unauthenticated users, use a system/anonymous UUID as fallback user_id

**OR** (simpler): Make `user_id` nullable in the DB so signals can be stored without auth.

DB migration:
```sql
ALTER TABLE trading_signals ALTER COLUMN user_id DROP NOT NULL;
```

Update RLS: Add a policy allowing anyone to view signals with null user_id.

#### 3. Better error surfacing

In `src/hooks/useSignals.ts`:
- Log the actual error response body/status in `generateSignal`
- Show the specific error message from the edge function instead of generic "Failed to generate signal"

#### 4. Edge function: add insert error handling

In `supabase/functions/generate-signal/index.ts`:
- Check the Supabase insert result for errors and log them
- Don't fail the response if DB insert fails -- still return the signal

### Files to Modify

| File | Change |
|---|---|
| `src/hooks/useSignals.ts` | Add signal to local state on success; better error logging |
| `supabase/functions/generate-signal/index.ts` | Always store signals; handle insert errors; make user_id optional |
| DB migration | Make `user_id` nullable on `trading_signals` |

