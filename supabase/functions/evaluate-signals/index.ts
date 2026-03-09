import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRYPTO_PAIRS = ["BTC/USD", "ETH/USD", "POL/USD"];

async function fetchCurrentPrice(pair: string): Promise<number | null> {
  try {
    if (CRYPTO_PAIRS.includes(pair)) {
      const symbolMap: Record<string, string> = {
        "BTC/USD": "BTCUSDT",
        "ETH/USD": "ETHUSDT",
        "POL/USD": "POLUSDT",
      };
      const symbol = symbolMap[pair];
      if (!symbol) return null;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      if (!res.ok) return null;
      const data = await res.json();
      return parseFloat(data.price);
    } else {
      const fxMap: Record<string, { base: string; target: string }> = {
        "EUR/USD": { base: "EUR", target: "USD" },
        "GBP/USD": { base: "GBP", target: "USD" },
        "USD/JPY": { base: "USD", target: "JPY" },
      };
      const fx = fxMap[pair];
      if (!fx) return null;
      const res = await fetch(`https://open.er-api.com/v6/latest/${fx.base}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.rates?.[fx.target] ?? null;
    }
  } catch (e) {
    console.error(`Failed to fetch price for ${pair}:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active/executed signals
    const { data: signals, error: fetchErr } = await supabase
      .from("trading_signals")
      .select("*")
      .in("status", ["active", "executed"]);

    if (fetchErr) throw fetchErr;
    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ evaluated: 0, message: "No active signals" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ signal_id: string; pair: string; result: string }> = [];
    const now = Date.now();

    for (const sig of signals) {
      const signalData = sig.signal_data as any;
      const entryZone = sig.entry_zone as number[] | null;
      const stopLoss = sig.stop_loss as number | null;
      const takeProfit = sig.take_profit as number[] | null;
      const expiresAt = sig.expires_at ? new Date(sig.expires_at).getTime() : null;
      const direction = sig.direction;

      // Check expiry first
      if (expiresAt && now > expiresAt) {
        await supabase.from("trading_signals").update({ status: "expired" }).eq("id", sig.id);
        await supabase.from("signal_performance").update({ result: "expired", closed_at: new Date().toISOString() }).eq("signal_id", sig.id);
        results.push({ signal_id: sig.id, pair: sig.pair, result: "expired" });
        continue;
      }

      const currentPrice = await fetchCurrentPrice(sig.pair);
      if (currentPrice === null) {
        console.warn(`Skipping ${sig.pair} — price unavailable`);
        continue;
      }

      const tp1 = Array.isArray(takeProfit) && takeProfit.length > 0 ? takeProfit[0] : null;
      const sl = stopLoss;
      let outcome: string | null = null;

      if (direction === "LONG" || direction === "buy") {
        if (tp1 !== null && currentPrice >= tp1) outcome = "win";
        else if (sl !== null && currentPrice <= sl) outcome = "loss";
      } else {
        if (tp1 !== null && currentPrice <= tp1) outcome = "win";
        else if (sl !== null && currentPrice >= sl) outcome = "loss";
      }

      if (outcome) {
        const entryPrice = entryZone && entryZone.length >= 2 ? (entryZone[0] + entryZone[1]) / 2 : currentPrice;
        const pnlPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 * (direction === "LONG" || direction === "buy" ? 1 : -1) : 0;
        
        const createdAt = new Date(sig.created_at).getTime();
        const closedAt = Date.now();
        const timeToTarget = Math.floor((closedAt - createdAt) / 1000); // seconds
        
        // Calculate slippage (execution vs midpoint of entry zone)
        const slippage = entryPrice > 0 ? Math.abs((currentPrice - entryPrice) / entryPrice) * 100 : 0;

        // Enhanced status transitions
        const signalStatus = outcome === "win" ? "tp_hit" : "sl_hit";

        await supabase.from("trading_signals").update({ status: signalStatus }).eq("id", sig.id);
        await supabase.from("signal_performance").update({
          result: outcome,
          pnl_percent: parseFloat(pnlPercent.toFixed(4)),
          closed_at: new Date(closedAt).toISOString(),
          time_to_target: outcome === "win" ? `${timeToTarget} seconds` : null,
          time_to_tp: outcome === "win" ? `${timeToTarget} seconds` : null,
          time_to_sl: outcome === "loss" ? `${timeToTarget} seconds` : null,
          slippage: parseFloat(slippage.toFixed(4)),
        }).eq("signal_id", sig.id);

        results.push({ signal_id: sig.id, pair: sig.pair, result: outcome });
      }
    }

    return new Response(JSON.stringify({ evaluated: signals.length, resolved: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
