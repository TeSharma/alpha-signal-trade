

# Phase 2: Portfolio Tracking & Automation - Refined Implementation

## Current State Analysis

**✅ Already Working:**
- `execute-trade` edge function creates trades with Risk Engine validation
- `evaluate-signals` monitors signal outcomes (TP/SL hit detection)
- `portfolio_history` table exists with proper RLS policies
- Dashboard displays balance, equity, and floating PnL
- Real-time subscriptions for trades and balances in `useTrades` hook

**⚠️ Gaps to Address:**
- No portfolio snapshots on trade open/close
- Equity calculation doesn't include unrealized PnL properly
- No comprehensive trading KPIs (profit factor, avg win/loss)
- Max drawdown calculation missing
- No cron job scheduled for automated signal evaluation
- Dashboard lacks equity curve visualization

---

## Implementation Steps

### 1. Portfolio Snapshot Logic

**Add snapshot function to `execute-trade/index.ts`** (after trade creation, before return):
```typescript
// Calculate current equity including unrealized PnL
const { data: openTrades } = await supabase
  .from('trades')
  .select('*')
  .eq('user_id', userId)
  .eq('account_mode', account_mode)
  .eq('status', 'open');

const unrealizedPnL = (openTrades || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
const currentEquity = accountBalance + unrealizedPnL;
const openPositionsCount = (openTrades || []).length;

await supabase.from('portfolio_history').insert({
  user_id: userId,
  account_mode: account_mode,
  balance: accountBalance,
  equity: currentEquity,
  open_positions: openPositionsCount,
});
```

**Update `close_trade` database function** (add snapshot after balance update):
- Fetch current balance after PnL update
- Calculate unrealized PnL from remaining open trades
- Insert portfolio_history snapshot with equity = balance + unrealized PnL

### 2. Portfolio History Hook

**Create `src/hooks/usePortfolioHistory.ts`:**
```typescript
interface PortfolioSnapshot {
  timestamp: string;
  equity: number;
  balance: number;
  openPositions: number;
}

interface PortfolioMetrics {
  history: PortfolioSnapshot[];
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakEquity: number;
  currentEquity: number;
  totalReturn: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  loading: boolean;
}
```

**Functions:**
- `fetchPortfolioHistory(timeRange: '1d' | '7d' | '30d' | 'all')` - Get snapshots
- `calculateMaxDrawdown(history)` - Rolling peak tracking: `drawdown = max(0, (equity - peakEquity) / peakEquity)`
- `calculateTradingMetrics(trades)` - Compute KPIs from closed trades
- Real-time subscription to `portfolio_history` and `trades` tables

### 3. Equity Curve Component

**Create `src/components/portfolio/EquityCurveChart.tsx`:**
- Recharts Line chart with equity over time
- Time range selector buttons (1D, 1W, 1M, All)
- Green line above starting balance, red below
- Peak equity marker with annotation
- Max drawdown shaded region
- Responsive (mobile: single column, desktop: full width)

### 4. Portfolio Stats Component

**Create `src/components/portfolio/PortfolioStats.tsx`:**
- 3-column grid (mobile: stacked)
- Display metrics:
  - Total Return % (vs starting balance)
  - Profit Factor (sum wins / sum losses)
  - Max Drawdown % (with peak equity reference)
  - Avg Win / Avg Loss (from closed trades)
  - Largest Win / Largest Loss
  - Win Rate (already on Dashboard)

### 5. Dashboard Integration

**Update `src/pages/Dashboard.tsx`:**
- Import `usePortfolioHistory`, `EquityCurveChart`, `PortfolioStats`
- Add new section between existing cards and Recent Trades:
```
Portfolio Performance (Card)
  ├─ EquityCurveChart
  └─ PortfolioStats
```
- Wire up account_mode prop to portfolio components

### 6. Enhanced Signal Lifecycle

**Update `supabase/functions/evaluate-signals/index.ts`:**
- Change status transitions: `'active' | 'executed' → 'tp_hit' | 'sl_hit' | 'expired'`
- Update both `trading_signals.status` and `signal_performance.result` accordingly
- Keep existing max_drawdown tracking logic (if market data available in future)

### 7. Cron Job Setup

**Execute via insert tool (NOT migration):**
```sql
-- Enable extensions first
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule evaluate-signals every 15 minutes
SELECT cron.schedule(
  'evaluate-signals-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://trbgjsurjfubezcdzpao.supabase.co/functions/v1/evaluate-signals',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyYmdqc3VyamZ1YmV6Y2R6cGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMjc4ODksImV4cCI6MjA2NDgwMzg4OX0._3CDlFbsFa-K805nSh5n6OGJfs-o0eHlceaMm-ykroo"}'::jsonb
  ) as request_id;
  $$
);
```

### 8. Database Function Enhancement

**Update `close_trade` function** (use migration tool):
```sql
CREATE OR REPLACE FUNCTION public.close_trade(p_trade_id uuid, p_exit_price numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  final_pnl DECIMAL(15, 2);
  trade_mode TEXT;
  trade_user_id UUID;
  current_balance NUMERIC;
  current_equity NUMERIC;
  open_count INTEGER;
BEGIN
  -- Existing validation and close logic...
  
  -- Get updated balance
  SELECT demo_balance, live_balance, user_id INTO current_balance
  FROM account_balances WHERE user_id = auth.uid();
  
  IF trade_mode = 'demo' THEN
    current_balance := current_balance;
  ELSE
    current_balance := live_balance;
  END IF;
  
  -- Calculate unrealized PnL from remaining open trades
  SELECT COUNT(*), COALESCE(SUM(pnl), 0) INTO open_count, unrealized_pnl
  FROM trades 
  WHERE user_id = auth.uid() 
    AND status = 'open' 
    AND account_mode = trade_mode;
  
  current_equity := current_balance + unrealized_pnl;
  
  -- Insert portfolio snapshot
  INSERT INTO portfolio_history (user_id, account_mode, balance, equity, open_positions)
  VALUES (auth.uid(), trade_mode, current_balance, current_equity, open_count);
  
  RETURN p_trade_id;
END;
$$;
```

---

## Implementation Priority

| Step | Component | Complexity | Impact |
|------|-----------|------------|--------|
| 1 | Add snapshot to `execute-trade` | Low | High |
| 2 | Update `close_trade` function | Medium | High |
| 3 | Create `usePortfolioHistory` hook | Medium | High |
| 4 | Build `EquityCurveChart` component | Medium | Medium |
| 5 | Build `PortfolioStats` component | Low | Medium |
| 6 | Integrate into Dashboard | Low | High |
| 7 | Schedule cron job (SQL insert) | Low | Medium |
| 8 | Enhance `evaluate-signals` status | Low | Low |

---

## File Modifications Summary

**Create:**
- `src/hooks/usePortfolioHistory.ts`
- `src/components/portfolio/EquityCurveChart.tsx`
- `src/components/portfolio/PortfolioStats.tsx`

**Modify:**
- `supabase/functions/execute-trade/index.ts` (add snapshot)
- `src/pages/Dashboard.tsx` (add portfolio section)
- `supabase/functions/evaluate-signals/index.ts` (refine status transitions)

**Database:**
- Update `close_trade` function (via migration)
- Execute cron job SQL (via insert tool)

---

## Technical Notes

**Equity Calculation:** Always `equity = balance + unrealizedPnL` where `unrealizedPnL = SUM(open_trades.pnl)`

**Max Drawdown:** Track rolling peak: `peak = max(peak, equity)`, `drawdown = (equity - peak) / peak`

**Profit Factor:** `SUM(winning_trades.pnl) / ABS(SUM(losing_trades.pnl))` (avoid division by zero)

**Real-time Updates:** Existing `useTrades` subscriptions will trigger portfolio history refreshes indirectly

**Cron Security:** Uses anon key (adequate for read-only evaluation function)

