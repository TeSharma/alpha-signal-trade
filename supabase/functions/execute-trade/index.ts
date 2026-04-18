import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteTradeRequest {
  signal_id: string;
  account_mode: 'demo' | 'live';
  position_size_override?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const executionStart = Date.now();

    const body: ExecuteTradeRequest = await req.json();
    const { signal_id, account_mode, position_size_override } = body;

    // Validate input
    if (!signal_id || !account_mode) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: signal_id, account_mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch signal
    const { data: signal, error: signalError } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('id', signal_id)
      .single();

    if (signalError || !signal) {
      return new Response(
        JSON.stringify({ error: 'Signal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate signal status
    if (signal.status !== 'active') {
      return new Response(
        JSON.stringify({ error: `Signal is ${signal.status}, not active` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (signal.expires_at && new Date(signal.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Signal has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check confidence threshold
    if (signal.confidence < 0.60) {
      return new Response(
        JSON.stringify({ error: `Signal confidence too low: ${(signal.confidence * 100).toFixed(0)}% (minimum 60%)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get account balance
    const { data: balanceData, error: balanceError } = await supabase
      .from('account_balances')
      .select('demo_balance, live_balance')
      .eq('user_id', userId)
      .single();

    if (balanceError || !balanceData) {
      return new Response(
        JSON.stringify({ error: 'Account balance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountBalance = account_mode === 'demo' ? balanceData.demo_balance : balanceData.live_balance;

    if (accountBalance <= 0) {
      return new Response(
        JSON.stringify({ error: `Insufficient ${account_mode} balance: $${accountBalance}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Risk Engine - Max Open Positions
    const { count: openPositions, error: countError } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'open')
      .eq('account_mode', account_mode);

    if (countError) {
      console.error('Error counting open positions:', countError);
    }

    if ((openPositions || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: 'Maximum 5 open positions reached. Close some positions first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Risk Engine - Daily Loss Limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayTrades, error: todayError } = await supabase
      .from('trades')
      .select('pnl')
      .eq('user_id', userId)
      .eq('account_mode', account_mode)
      .eq('status', 'closed')
      .gte('closed_at', todayStart.toISOString());

    if (todayError) {
      console.error('Error fetching today trades:', todayError);
    }

    const todayPnl = (todayTrades || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const dailyLossLimit = accountBalance * -0.03;

    if (todayPnl <= dailyLossLimit) {
      return new Response(
        JSON.stringify({ error: `Daily loss limit reached: -$${Math.abs(todayPnl).toFixed(2)} (limit: -$${Math.abs(dailyLossLimit).toFixed(2)})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Risk Engine - Asset Exposure
    const { data: assetTrades, error: assetError } = await supabase
      .from('trades')
      .select('lot_size, entry_price')
      .eq('user_id', userId)
      .eq('pair', signal.pair)
      .eq('status', 'open')
      .eq('account_mode', account_mode);

    if (assetError) {
      console.error('Error fetching asset trades:', assetError);
    }

    const assetExposure = (assetTrades || []).reduce((sum, t) => sum + (t.lot_size * t.entry_price), 0);
    const maxAssetExposure = accountBalance * 0.20;

    if (assetExposure >= maxAssetExposure) {
      return new Response(
        JSON.stringify({ error: `Maximum exposure for ${signal.pair} reached: $${assetExposure.toFixed(2)} (limit: $${maxAssetExposure.toFixed(2)})` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Calculate position size
    const entryPrice = Array.isArray(signal.entry_zone) && signal.entry_zone.length >= 2 
      ? (signal.entry_zone[0] + signal.entry_zone[1]) / 2 
      : signal.entry_zone?.[0] || 0;
    
    const stopLoss = signal.stop_loss || 0;
    const stopDistance = Math.abs(entryPrice - stopLoss);

    if (stopDistance === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid signal: stop loss equals entry price' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const riskAmount = accountBalance * 0.01; // 1% risk
    let positionSize = riskAmount / stopDistance;

    // Apply override if provided
    if (position_size_override && position_size_override > 0) {
      positionSize = position_size_override;
    }

    // Cap position size by available balance (don't risk more notional than account holds)
    const maxPositionByBalance = accountBalance / entryPrice;
    if (positionSize > maxPositionByBalance) {
      positionSize = maxPositionByBalance;
    }

    // Cap by DB column constraint: numeric(10,4) → max < 1,000,000
    const MAX_LOT_SIZE = 999999.9999;
    if (positionSize > MAX_LOT_SIZE) {
      positionSize = MAX_LOT_SIZE;
    }

    // Round to 4 decimals to match column scale
    positionSize = Math.floor(positionSize * 10000) / 10000;

    if (positionSize <= 0) {
      return new Response(
        JSON.stringify({ error: 'Calculated position size is too small to execute' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Create trade record
    const takeProfit = Array.isArray(signal.take_profit) && signal.take_profit.length > 0 
      ? signal.take_profit[0] 
      : null;

    const executionLatency = Date.now() - executionStart;

    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: userId,
        signal_id: signal_id,
        pair: signal.pair,
        direction: signal.direction === 'LONG' ? 'buy' : 'sell',
        entry_price: entryPrice,
        execution_price: entryPrice, // In real system, would be actual execution price
        lot_size: positionSize,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        account_mode: account_mode,
        status: 'open',
        slippage: 0, // Calculate from actual execution vs intended
        execution_latency: executionLatency,
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error creating trade:', tradeError);
      return new Response(
        JSON.stringify({ error: 'Failed to create trade', details: tradeError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Update signal status to 'executed'
    const { error: updateError } = await supabase
      .from('trading_signals')
      .update({ status: 'executed' })
      .eq('id', signal_id);

    if (updateError) {
      console.error('Error updating signal status:', updateError);
    }

    // 11. Create performance tracking record
    const entryZoneLow = Array.isArray(signal.entry_zone) && signal.entry_zone.length >= 2 ? signal.entry_zone[0] : entryPrice;
    const entryZoneHigh = Array.isArray(signal.entry_zone) && signal.entry_zone.length >= 2 ? signal.entry_zone[1] : entryPrice;

    const { error: perfError } = await supabase
      .from('signal_performance')
      .insert({
        signal_id: signal_id,
        pair: signal.pair,
        direction: signal.direction,
        entry_price: entryPrice,
        entry_zone_low: entryZoneLow,
        entry_zone_high: entryZoneHigh,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        strategy: signal.strategy,
        result: 'open',
      });

    if (perfError) {
      console.error('Error creating performance record:', perfError);
    }

    console.log(`[execute-trade] Trade created: ${trade.id} for signal ${signal_id} — ${signal.direction} ${signal.pair} @ ${entryPrice}`);

    // 12. Capture portfolio snapshot after trade opens
    const { data: allOpenTrades, error: openTradesError } = await supabase
      .from('trades')
      .select('pnl')
      .eq('user_id', userId)
      .eq('account_mode', account_mode)
      .eq('status', 'open');

    if (openTradesError) {
      console.error('Error fetching open trades for snapshot:', openTradesError);
    }

    const unrealizedPnL = (allOpenTrades || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const currentEquity = accountBalance + unrealizedPnL;
    const openPositionsCount = (allOpenTrades || []).length;

    const { error: snapshotError } = await supabase
      .from('portfolio_history')
      .insert({
        user_id: userId,
        account_mode: account_mode,
        balance: accountBalance,
        equity: currentEquity,
        open_positions: openPositionsCount,
      });

    if (snapshotError) {
      console.error('Error creating portfolio snapshot:', snapshotError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        trade_id: trade.id,
        signal_id: signal_id,
        pair: signal.pair,
        direction: signal.direction,
        position_size: positionSize,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        execution_latency: executionLatency,
        status: 'open',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Execute trade error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
