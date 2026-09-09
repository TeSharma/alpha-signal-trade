# Fix "Execution failed" when executing a signal

## What's happening

When you press Confirm & Execute, the app only shows a generic "Execution Failed" message — the real reason never reaches the screen and nothing is written to the server log either. The server log for the trade function currently shows only start-ups, no messages at all, which means it stops at one of its early checks (signal expired, signal no longer active, confidence too low, balance missing, or the sign-in token being rejected) before it ever logs anything.

So step one is to make the real reason visible, then fix the defects already confirmed in the data.

## Confirmed defects (found while checking the database)

1. **Buy signals are saved as sell.** Signals are stored with direction `buy`/`sell` (verified in the signals table), but the trade function compares against `LONG`. Anything that isn't the literal text `LONG` is written as a sell, so every executed buy becomes a sell.
2. **The signal is never marked as executed.** AI signals have no owner, but the update rule on the signals table only allows a user to update signals they own. The update silently changes nothing, so an executed signal stays "active" and can be executed again.
3. **The performance record is never created.** The performance table has no insert rule at all, so that insert is always rejected. It is only logged as a warning, so tracking of win/loss per signal quietly stops.

## Plan

1. **Surface the real error**
   - In the trade function: log the incoming request (user, signal, mode) and log every rejection reason with a clear prefix before returning.
   - In the confirm dialog: read the error body returned by the function and show that message, instead of the generic "Execution failed".

2. **Fix the direction mapping**
   - Accept both storage formats (`buy`/`LONG` and `sell`/`SHORT`) and normalise once, using the same rule the UI already uses.

3. **Let the server complete the two blocked writes**
   - Give the trade function the elevated server key for the two writes it must make on the user's behalf: marking the signal executed, and inserting the performance row. The user's own token stays in use for everything else, so all per-user access rules still apply.
   - Alternative if elevated access is not wanted: add a database rule allowing an owner-less active signal to be marked executed, and an insert rule on the performance table. Default is the elevated-key approach because it is narrower.

4. **Guard against duplicate execution**
   - Once the signal status flips correctly, the existing "signal is not active" check will block re-execution of the same signal.

5. **Re-test**
   - Generate a fresh signal, execute it in demo mode, and confirm: trade row created with the correct direction, signal status becomes `executed`, performance row exists, and any rejection now shows a specific message.

## Technical notes

- Files: `supabase/functions/execute-trade/index.ts`, `src/components/signals/ExecuteTradeDialog.tsx`.
- Direction normalisation mirrors `normalizeDirection` in `src/types/signal.ts`.
- Elevated writes use a second Supabase client built from `SUPABASE_SERVICE_ROLE_KEY`, restricted to the signal-status update and the `signal_performance` insert.
- Signals expire 40 minutes after creation; if the diagnostics show expiry is the actual cause, the fix is UI-side (hide/disable execute on expired cards) and will be reported before changing the expiry policy.
- No schema migration is required for the default approach.
