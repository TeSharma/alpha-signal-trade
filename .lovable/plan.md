Fix: Show Only Active Signals on the Signals Page

## Problem

The `useSignalList` hook queries the `signal_overview` view without filtering by `signal_status`. The DB has 6 active signals and many expired/closed ones (sl_hit, tp_hit). All are returned and displayed, with expired ones appearing because they have the same confidence and the query doesn't prioritize active status.

## Changes

### 1. `src/hooks/useSignalList.ts` — Add default status filter

In the `fetchSignals` function, add `.eq('signal_status', 'active')` to the query by default, so only active signals are fetched. Also order by `created_at desc` as secondary sort to show newest first when confidence is equal.

Additionally, update `buildQuery` to only apply the manual status filter if explicitly set, otherwise default to `active`.

### 2. `src/hooks/useSignals.ts` — Already correct

This hook already filters by `status = 'active'` and uses `isExpired()` client-side. No changes needed.

### 3. `src/hooks/useSignalList.ts` — Add expiry-based client filter

As a safety net, filter out signals where `expires_at` is in the past on the client side (similar to how `useSignals` uses `isExpired()`), in case the DB status hasn't been updated yet.

### 4. Real-time auto-replacement

The existing real-time subscription on `trading_signals` already triggers `refreshSignals()` on any change. When new signals are inserted and old ones are marked expired, the list will auto-update. No additional changes needed for real-time replacement.

5. Track TP/SL outcomes and update signal_performance table

## Files to modify


| File                         | Change                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `src/hooks/useSignalList.ts` | Add `signal_status = 'active'` filter to query, add client-side expiry filter |


## Summary

One file change. The query will default to showing only active signals, and a client-side filter will catch any signals whose status hasn't been updated yet but are past their expiry time.