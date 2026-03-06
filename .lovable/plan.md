

## Fix: Deploy Edge Functions

### Root Cause
The `generate-signal` edge function has never been deployed to Supabase. The fetch request hits the Supabase URL at `/functions/v1/generate-signal` but since no function exists there, it returns an HTML error page. The client then tries to parse this HTML as JSON, causing: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

### Fix
1. **Deploy both edge functions** (`generate-signal` and `check-signal`) to Supabase
2. **Add a non-JSON response guard** in `useSignals.ts` -- check `content-type` header before calling `res.json()` to provide a clear error message if the function returns HTML

### Files to modify
| File | Change |
|---|---|
| Edge functions deploy | Deploy `generate-signal` and `check-signal` |
| `src/hooks/useSignals.ts` | Add content-type check before JSON parse to surface clearer errors |

