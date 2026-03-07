

## Add Entry Zone Columns to `signal_performance`

### Database Migration

Add two new columns (`entry_zone_low`, `entry_zone_high`) to the `signal_performance` table. Keep `entry_price` as-is (it stores the midpoint and is used in PnL calculations).

```sql
ALTER TABLE signal_performance
  ADD COLUMN entry_zone_low numeric,
  ADD COLUMN entry_zone_high numeric;
```

### Edge Function Update: `generate-signal`

In `supabase/functions/generate-signal/index.ts`, update the `signal_performance` insert to include:
- `entry_zone_low: signalData.entry_zone[0]`
- `entry_zone_high: signalData.entry_zone[1]`

### Files to Modify

| File | Change |
|---|---|
| DB migration | Add `entry_zone_low` and `entry_zone_high` columns |
| `supabase/functions/generate-signal/index.ts` | Populate new columns on insert |
| `supabase/functions/evaluate-signals/index.ts` | Use entry zone columns if available for PnL calc |

