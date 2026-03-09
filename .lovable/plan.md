
# AI Trading System - Phase 2 Architecture Implementation

## Overview
Evolve the platform into a complete semi-automated AI trading system with human-in-the-loop execution. The architecture follows a layered pipeline from signal generation → human review → 1-click execution → risk validation → portfolio tracking.

## Current State Analysis

**✅ Already Working:**
- Signal Engine (generate-signal + trading_signals table)
- Signal Intelligence Layer (signal_performance table + evaluate-signals)
- Signal expiration handling in evaluate-signals
- Signal prefill flow to TradingForm (via location.state)
- Frontend displays signals with Execute button

**⚠️ Missing Components:**
- Trade execution doesn't link to signals (no signal_id in trades)
- No execute-trade edge function (currently navigates to /trade page)
- No Risk Engine validation before trade creation
- No portfolio_history for equity curve tracking
- Missing execution metadata (slippage, execution_latency)
- Missing signal metadata (signal_source field)

## Implementation Plan

### 1. Database Schema Enhancements

**Add to `trades` table:**
```sql
ALTER TABLE trades
  ADD COLUMN signal_id uuid REFERENCES trading_signals(id),
  ADD COLUMN execution_price numeric,
  ADD COLUMN slippage numeric,
  ADD COLUMN execution_latency integer; -- milliseconds
```

**Add to `signal_performance` table:**
```sql
ALTER TABLE signal_performance
  ADD COLUMN entry_zone_low numeric,
  ADD COLUMN entry_zone_high numeric,
  ADD COLUMN max_drawdown numeric,
  ADD COLUMN time_to_tp interval,
  ADD COLUMN time_to_sl interval,
  ADD COLUMN slippage numeric;
```

**Create `portfolio_history` table:**
```sql
CREATE TABLE portfolio_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_mode text NOT NULL DEFAULT 'demo',
  equity numeric NOT NULL,
  balance numeric NOT NULL,
  open_positions integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
-- RLS: Users can view/insert their own history
```

**Add to `trading_signals.signal_data` JSON:**
- `signal_source: string` (e.g., "AI", "indicator", "hybrid")

### 2. Execute-Trade Edge Function

**New file:** `supabase/functions/execute-trade/index.ts`

**Responsibilities:**
1. Validate signal exists and is active (not expired/executed/closed)
2. Check signal confidence >= 60%
3. **Risk Engine Validation:**
   - Max risk per trade: 1% of account balance
   - Max open positions: 5
   - Max daily loss: 3% of starting balance
   - Max exposure per asset: 20% of portfolio
4. Calculate position size based on risk and stop-loss distance
5. Create trade record with signal linkage
6. Update signal status to 'executed'
7. Seed performance metrics with execution data
8. Return trade confirmation

**Risk Engine Logic:**
```typescript
// Position sizing: Risk 1% of balance
const accountBalance = await getBalance(userId, accountMode);
const riskAmount = accountBalance * 0.01;
const stopDistance = Math.abs(entryPrice - stopLoss);
const positionSize = riskAmount / stopDistance;

// Check max open positions
const openPositions = await countOpenTrades(userId);
if (openPositions >= 5) throw new Error('Max 5 open positions');

// Check daily loss limit
const todayPnl = await getTodayPnL(userId);
if (todayPnl <= accountBalance * -0.03) throw new Error('Daily loss limit reached');

// Check asset exposure
const assetExposure = await getAssetExposure(userId, pair);
if (assetExposure >= accountBalance * 0.20) throw new Error('Max 20% exposure per asset');
```

**Input Schema:**
```typescript
{
  signal_id: string,
  account_mode: 'demo' | 'live',
  position_size_override?: number // Optional manual override
}
```

**Output:**
```typescript
{
  trade_id: string,
  signal_id: string,
  pair: string,
  direction: string,
  position_size: number,
  entry_price: number,
  stop_loss: number,
  take_profit: number,
  execution_latency: number,
  status: 'open'
}
```

### 3. Frontend Integration

**Update `SignalCard.tsx`:**
- Replace `onApprove(signal)` navigation with direct edge function call
- Show loading state during execution
- Display confirmation toast with trade details
- Handle risk validation errors gracefully

**Update `src/hooks/useSignals.ts`:**
- Add `executeSignal(signalId)` function that invokes execute-trade
- Handle execution errors and display appropriate messages

### 4. Portfolio Engine Enhancements

**Create `usePortfolioHistory` hook:**
- Fetch equity curve data from portfolio_history
- Track hourly/daily snapshots of account equity
- Calculate max drawdown and equity peaks

**Update Portfolio Stats View:**
Add these aggregations:
- `max_drawdown` (max decline from equity peak)
- `equity_curve` (array of {timestamp, equity} points)
- `sharpe_ratio` (if sufficient data exists)

**Auto-snapshot Logic:**
When a trade closes, insert a portfolio_history record with current equity.

### 5. Signal Intelligence Improvements

**Update `evaluate-signals` function:**

After detecting win/loss, calculate additional metrics:
```typescript
// Track time to TP/SL
const time_to_target = closedAt - createdAt;

// Calculate max drawdown during signal lifecycle
const max_drawdown = calculateMaxDrawdown(priceHistory);

// Measure execution slippage
const slippage = Math.abs(executionPrice - entryZoneMid);
```

**Update `generate-signal` function:**
Add `signal_source: "AI"` to signal metadata.

### 6. Automated Signal Evaluation

**Cron Job Setup (via Supabase SQL):**
```sql
SELECT cron.schedule(
  'evaluate-signals-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://trbgjsurjfubezcdzpao.supabase.co/functions/v1/evaluate-signals',
    headers:='{"Authorization": "Bearer ANON_KEY"}'::jsonb
  );
  $$
);
```

## Implementation Priority

**Phase 1 (Critical - This Implementation):**
1. ✅ Database migrations (trades, signal_performance, portfolio_history)
2. ✅ Build execute-trade edge function with Risk Engine
3. ✅ Update SignalCard to call execute-trade
4. ✅ Add signal_source to generate-signal

**Phase 2 (Enhancement):**
5. Portfolio history tracking hook
6. Equity curve visualization
7. Max drawdown calculation in evaluate-signals
8. Schedule evaluate-signals cron job

**Phase 3 (Polish):**
9. Risk settings UI for users
10. Execution analytics dashboard
11. Signal learning loop (AI feedback based on performance)

## Key Architecture Principles

1. **Human-in-the-Loop:** User must click Execute — no auto-trading
2. **Risk-First:** Validate all risk rules before allowing execution
3. **Signal Linkage:** Every trade must reference its originating signal
4. **Performance Tracking:** Track every signal outcome for AI improvement
5. **Transparency:** Show all execution details (slippage, latency, PnL)

## Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add signal_id to trades, enhance signal_performance, create portfolio_history |
| `supabase/functions/execute-trade/index.ts` | New edge function with Risk Engine |
| `supabase/config.toml` | Register execute-trade function |
| `src/hooks/useTradeExecution.ts` | New hook for signal execution |
| `src/components/signals/SignalCard.tsx` | Call execute-trade instead of navigate |
| `supabase/functions/generate-signal/index.ts` | Add signal_source metadata |
| `supabase/functions/evaluate-signals/index.ts` | Track max_drawdown, time_to_target |
| Database (via insert tool) | Create cron job for evaluate-signals |

## Technical Notes

**Risk Engine:**
- All validation server-side (never trust client)
- Returns detailed rejection reasons
- Calculates position size automatically based on 1% risk rule

**Execution Flow:**
```
Signal (active) → User clicks Execute → execute-trade validates 
→ Risk Engine checks limits → Trade created with signal_id 
→ Signal status = 'executed' → evaluate-signals monitors outcome 
→ Signal status = 'closed' (win/loss)
```

**Portfolio Tracking:**
- Snapshot equity after every trade close
- Calculate running max drawdown
- Enable equity curve charting for performance visualization
