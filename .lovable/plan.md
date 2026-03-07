

## Signal Intelligence & Performance Tracking Layer

### Overview

Add a performance tracking system that measures signal outcomes, computes strategy metrics, and displays analytics on the Signals page.

### Database Changes

**New table: `signal_performance`**

```sql
CREATE TABLE signal_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid REFERENCES trading_signals(id) ON DELETE CASCADE NOT NULL,
  pair text NOT NULL,
  direction text NOT NULL,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  result text DEFAULT 'open' CHECK (result IN ('open', 'win', 'loss', 'expired')),
  pnl_percent numeric DEFAULT 0,
  time_to_target interval,
  model_version text,
  strategy text,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  UNIQUE(signal_id)
);

ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;

-- Public read for analytics
CREATE POLICY "Anyone can view signal performance"
  ON signal_performance FOR SELECT USING (true);

-- Only service role inserts (via edge function)
CREATE POLICY "Service role can insert performance"
  ON signal_performance FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update performance"
  ON signal_performance FOR UPDATE USING (true);
```

**Update `trading_signals.status`**: Add `'executed'` and `'closed'` to the lifecycle. No schema change needed since `status` is `text`, but the edge function and hooks will use the new values.

### Edge Function: `evaluate-signals`

New edge function `supabase/functions/evaluate-signals/index.ts`:

- Fetches all signals with status `active` or `executed`
- For each signal, fetches current market price (Binance for crypto, FX API for forex)
- Checks if price hit TP1 (win) or SL (loss)
- If signal expired (beyond `expires_at`), marks as `expired`
- Upserts result into `signal_performance`
- Updates `trading_signals.status` to `closed` or `expired`
- Returns a summary of evaluated signals

This function can be called manually or on a schedule.

### Edge Function: Update `generate-signal`

After inserting the signal into `trading_signals`, also insert an initial `signal_performance` row with `result = 'open'` and the signal's entry/SL/TP data. This seeds the performance record at generation time.

### Frontend: Signal Analytics Dashboard

**New component: `src/components/signals/SignalAnalytics.tsx`**

A card-based dashboard showing:
- Total signals generated
- Win rate (wins / (wins + losses))
- Average RR achieved
- Best performing strategy
- Model version comparison (if multiple versions exist)

Data fetched via a simple Supabase query on `signal_performance`.

**Update `src/pages/Signals.tsx`**:
- Add a new tab "Performance" alongside the signal list
- Render `SignalAnalytics` in that tab

### Signal Status Lifecycle

```text
active → executed → closed (win/loss)
active → expired
```

The `SignalCard` already handles `expired` display. Add visual indicators for `executed` (in-progress) and `closed` (show result badge: win/loss with PnL%).

### Files to Create/Modify

| File | Change |
|---|---|
| DB migration | Create `signal_performance` table |
| `supabase/functions/evaluate-signals/index.ts` | New edge function to check signal outcomes |
| `supabase/functions/generate-signal/index.ts` | Seed `signal_performance` row on signal creation |
| `supabase/config.toml` | Register `evaluate-signals` function |
| `src/components/signals/SignalAnalytics.tsx` | New analytics dashboard component |
| `src/components/signals/SignalCard.tsx` | Add result badges for closed signals |
| `src/pages/Signals.tsx` | Add Performance tab |
| `src/hooks/useSignalPerformance.ts` | New hook to fetch performance data |

