
Two issues to fix:

**Issue 1: SL/TP direction inversion + SL too far from entry**
The AI returns `direction: "LONG"|"SHORT"` and we map `LONG→buy`, `SHORT→sell`. But the AI sometimes outputs SL/TP on the wrong side relative to entry. Example: SELL @ 0.09025 with SL 0.08700 (below) and TP 0.09550 (above) — that's a BUY layout, not a SELL. The signal is silently inverted/garbage.

Currently there is no server-side validation that:
- For LONG (buy): `SL < entry_low` AND `TP > entry_high`
- For SHORT (sell): `SL > entry_high` AND `TP < entry_low`

Plus the SL distance is unconstrained (AI freely chose 325 pips on POL/USD), violating your "few pips above/below entry" rule.

**Issue 2: Trade executes immediately with auto-calculated lot size**
The Execute button in `SignalCard.tsx` and `EnhancedSignalCard.tsx` calls the edge function directly with no UI prompt. The edge function already supports `position_size_override` — we just never expose it to the user.

---

### Plan

**1. Fix `supabase/functions/generate-signal/index.ts`** — add a normalization + validation step right after parsing AI args (before the confidence/RR filters):

```text
- Compute entry mid = (entry_low + entry_high) / 2
- Define SL_PIPS_BUFFER per market:
    CRYPTO BTC/USD/ETH: 0.15% of entry
    CRYPTO POL/USD:     0.25% of entry  
    FOREX (non-JPY):    15 pips = 0.0015
    FOREX USD/JPY:      15 pips = 0.15
- Force-rewrite SL relative to entry mid:
    LONG:  SL = entry_low  - buffer
    SHORT: SL = entry_high + buffer
- Validate/rewrite TPs to correct side using rr_ratio:
    LONG:  TP = entry + (entry - SL) * [1, 1.5, 2.2]
    SHORT: TP = entry - (SL - entry) * [1, 1.5, 2.2]
- Round to pair precision (BTC: 2dp, ETH: 2dp, POL: 4dp, FX: 5dp, JPY: 3dp)
```

This guarantees correct geometry and a tight SL regardless of what the AI outputs.

**2. Add a Lot Size confirmation dialog** — new shared component `src/components/signals/ExecuteTradeDialog.tsx`:
- Opens when user clicks "Execute Trade" on a signal card
- Pre-fills with the suggested 1%-risk position size (computed client-side from balance + stop distance)
- Shows: pair, direction badge, entry, SL, TP, account balance, risk amount
- User can edit the lot size (numeric input with min/max validation)
- Shows live "Risk if SL hit: $X" preview
- "Confirm & Execute" calls `execute-trade` with `position_size_override`
- "Cancel" closes

**3. Wire the dialog into both cards**:
- `src/components/signals/SignalCard.tsx`: replace direct `handleExecute` with dialog open
- `src/components/signals/EnhancedSignalCard.tsx`: same

**4. Edge function `execute-trade`**: already supports `position_size_override`, but currently the override is then capped by `accountBalance / entryPrice` (1x notional cap). That cap is fine — keep it. No backend changes needed beyond what already exists.

### Files to change
- `supabase/functions/generate-signal/index.ts` — add `normalizeSignalGeometry()` helper
- `src/components/signals/ExecuteTradeDialog.tsx` — NEW
- `src/components/signals/SignalCard.tsx` — open dialog instead of direct execute
- `src/components/signals/EnhancedSignalCard.tsx` — same

### Note on existing bad signals
The signal you executed is already in the DB with broken geometry. New signals generated after this fix will be correct. Existing active signals would need to be regenerated (or I can add a one-time SQL cleanup to expire the malformed ones — happy to include if you want).
