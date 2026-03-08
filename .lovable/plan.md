

## Fix: Use Supabase Client for Edge Function Calls

### Root Cause
The `generateSignal` function in `src/hooks/useSignals.ts` constructs the edge function URL manually using:
```typescript
fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signal`)
```

In the preview environment, `VITE_SUPABASE_URL` resolves to the Lovable preview server (e.g., `https://id-preview--...lovable.app`) instead of the Supabase function endpoint (`https://trbgjsurjfubezcdzpao.supabase.co`). This causes the request to hit the frontend server, which returns the HTML application instead of invoking the edge function.

### Solution
Replace the manual `fetch()` call with the Supabase client's `supabase.functions.invoke()` method. This method:
- Automatically routes to the correct Supabase edge function endpoint
- Handles authentication automatically using the current session
- Returns a typed response with `{ data, error }` structure

### Implementation

**Update `src/hooks/useSignals.ts`:**

Replace lines 65-94 with:
```typescript
const { data, error } = await supabase.functions.invoke('generate-signal', {
  body: { pair, timeframe }
});

if (error) {
  // Handle specific error cases
  if (error.message?.includes('429')) {
    toast({ title: 'Rate Limited', description: 'Too many requests. Try again shortly.', variant: 'destructive' });
    return null;
  }
  if (error.message?.includes('402')) {
    toast({ title: 'Credits Exhausted', description: 'AI credits used up. Add more in workspace settings.', variant: 'destructive' });
    return null;
  }
  
  console.error('Edge function error:', error);
  toast({ title: 'Error', description: error.message || 'Signal generation failed', variant: 'destructive' });
  return null;
}

if (!data) {
  toast({ title: 'Error', description: 'No data returned from signal service', variant: 'destructive' });
  return null;
}

if (data.error) {
  toast({ title: 'Signal Error', description: data.error, variant: 'destructive' });
  return null;
}

if (data.filtered) {
  toast({ title: 'Low Confidence', description: `Signal for ${pair} below threshold (${(data.confidence * 100).toFixed(0)}%). Not published.` });
  return null;
}

const signal = data as SignalObject;
```

### Benefits
1. **Correct routing**: Requests go directly to Supabase edge function endpoint
2. **Automatic auth**: No manual session fetching or authorization headers
3. **Type safety**: Better error handling with structured response
4. **Simpler code**: Less boilerplate for API calls

### Files Modified
- `src/hooks/useSignals.ts` — Replace manual fetch with `supabase.functions.invoke()`

