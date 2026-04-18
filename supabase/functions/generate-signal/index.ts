import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALL_PAIRS = [
  { pair: "BTC/USD", market: "CRYPTO" },
  { pair: "ETH/USD", market: "CRYPTO" },
  { pair: "POL/USD", market: "CRYPTO" },
  { pair: "EUR/USD", market: "FOREX" },
  { pair: "GBP/USD", market: "FOREX" },
  { pair: "USD/JPY", market: "FOREX" },
];

const EXPIRY_MINUTES: Record<string, number> = {
  "5m": 15,
  "15m": 30,
  "30m": 40,
  "1h": 120,
  "4h": 480,
};

function isForexMarketOpen(date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 6) return false;
  if (day === 0) return hour >= 22;
  if (day === 5) return hour < 22;

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[generate-signal] FUNCTION TRIGGERED");

  try {
    const body = await req.json();
    const isBatch = body.batch === true;
    const pair = body.pair as string | undefined;
    const timeframe = (body.timeframe as string) || "30m";

    console.log("[generate-signal] PAYLOAD", JSON.stringify({ isBatch, pair, timeframe }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (isBatch) {
      console.log("[generate-signal] BATCH MODE — generating for all pairs");
      const results = [];
      for (const p of ALL_PAIRS) {
        const result = await generateForPair(supabaseClient, LOVABLE_API_KEY, p.pair, p.market, timeframe);
        results.push(result);
        await new Promise((r) => setTimeout(r, 2000));
      }
      const ok = results.filter((r) => r.ok).length;
      const filtered = results.filter((r) => r.filtered).length;
      const skipped = results.filter((r) => r.skipped).length;
      const failed = results.filter((r) => !r.ok && !r.filtered && !r.skipped).length;
      console.log(`[generate-signal] BATCH COMPLETE: ${ok} inserted, ${filtered} filtered, ${skipped} skipped (duplicate), ${failed} failed`);
      return respond({ success: true, inserted: ok, filtered, skipped, failed, results });
    }

    if (!pair) {
      return respond({ error: "Missing 'pair' or 'batch' flag" }, 400);
    }

    const actualMarket = ALL_PAIRS.find((p) => p.pair === pair)?.market || "CRYPTO";
    const result = await generateForPair(supabaseClient, LOVABLE_API_KEY, pair, actualMarket, timeframe);

    if (result.skipped) {
      return respond({ skipped: true, message: `Active signal already exists for ${pair}` });
    }
    if (result.filtered) {
      return respond({ filtered: true, confidence: result.confidence, rr: result.rr, message: `Signal for ${pair} below quality threshold. Not published.` });
    }
    if (!result.ok) {
      return respond({ error: result.error }, 500);
    }
    return respond(result.signal);
  } catch (e: any) {
    console.error("[generate-signal] ERROR:", e);
    return respond({ error: e.message || "Unknown error" }, 500);
  }
});

async function getPerformanceFeedback(supabase: any, pair: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("signal_performance")
      .select("result, pnl_percent, strategy")
      .eq("pair", pair)
      .in("result", ["win", "loss"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return "";

    const total = data.length;
    const wins = data.filter((r: any) => r.result === "win").length;
    const winRate = ((wins / total) * 100).toFixed(1);
    const avgPnl = (data.reduce((s: number, r: any) => s + (r.pnl_percent || 0), 0) / total).toFixed(2);

    return `\n\nHistorical performance for ${pair} (last ${total} signals): ${winRate}% win rate, avg PnL ${avgPnl}%. Use this data to calibrate your confidence and improve signal quality. If win rate is below 50%, be more conservative with entry zones and tighter with stop losses.`;
  } catch {
    return "";
  }
}

async function checkDuplicate(supabase: any, pair: string): Promise<boolean> {
  const { data } = await supabase
    .from("trading_signals")
    .select("id")
    .eq("pair", pair)
    .eq("status", "active")
    .limit(1);
  return !!(data && data.length > 0);
}

async function fetchCurrentPrice(pair: string, market: string): Promise<number | null> {
  try {
    if (market === "CRYPTO") {
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
      const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
      if (!apiKey) return null;
      const res = await fetch(`https://api.twelvedata.com/price?symbol=${pair}&apikey=${apiKey}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.price ? parseFloat(data.price) : null;
    }
  } catch (e) {
    console.error(`[generate-signal] Price fetch failed for ${pair}:`, e);
    return null;
  }
}

async function generateForPair(
  supabase: any,
  apiKey: string,
  pair: string,
  market: string,
  timeframe: string
): Promise<{ ok: boolean; filtered?: boolean; skipped?: boolean; confidence?: number; rr?: number; signal?: any; error?: string }> {
  console.log(`[generate-signal] Generating for ${pair} @ ${timeframe}`);

  try {
    if (market === "FOREX" && !isForexMarketOpen()) {
      console.log(`[generate-signal] SKIPPED — forex market closed for ${pair}`);
      return { ok: false, skipped: true };
    }

    // Duplicate check
    const hasDuplicate = await checkDuplicate(supabase, pair);
    if (hasDuplicate) {
      console.log(`[generate-signal] SKIPPED — active signal already exists for ${pair}`);
      return { ok: false, skipped: true };
    }

    // Fetch real current price
    const currentPrice = await fetchCurrentPrice(pair, market);
    const priceContext = currentPrice
      ? `\n\nCurrent live price of ${pair}: $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}. Use this as your reference for entry zones, stop loss, and take profit levels.`
      : "";

    // Performance feedback loop
    const perfFeedback = await getPerformanceFeedback(supabase, pair);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a professional trading signal generator using a 5-engine analysis framework:
1. Trend Engine — identify the dominant trend direction
2. Structure Engine — key support/resistance levels
3. Momentum Engine — RSI, MACD, volume analysis
4. Risk Engine — calculate risk/reward ratio (must be >= 2.2)
5. Confidence Engine — aggregate signal quality score (only output signals with confidence >= 0.75)

Generate a trading signal for the given pair and timeframe. Be realistic with price levels. For crypto pairs use current approximate market prices. For forex pairs use standard pip-level precision.

IMPORTANT: Only generate HIGH QUALITY signals. Confidence must be >= 0.75 and risk/reward ratio must be >= 2.2. If market conditions are unclear, set confidence below 0.75 to filter it out.${perfFeedback}`,
          },
          {
            role: "user",
            content: `Generate a ${timeframe} trading signal for ${pair} (${market} market). Analyze current conditions and provide a structured signal.${priceContext}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_trading_signal",
              description: "Generate a structured trading signal with entry, exit, and risk parameters",
              parameters: {
                type: "object",
                properties: {
                  direction: { type: "string", enum: ["LONG", "SHORT"], description: "Trade direction" },
                  entry_low: { type: "number", description: "Lower bound of entry zone" },
                  entry_high: { type: "number", description: "Upper bound of entry zone" },
                  stop_loss: { type: "number", description: "Stop loss price" },
                  tp1: { type: "number", description: "Take profit target 1" },
                  tp2: { type: "number", description: "Take profit target 2" },
                  tp3: { type: "number", description: "Take profit target 3" },
                  confidence: { type: "number", description: "Signal confidence from 0.0 to 1.0 — only output >= 0.75 for high quality" },
                  strategy: { type: "string", description: "Strategy name, e.g. Trend Following, Mean Reversion, Breakout" },
                  risk_level: { type: "string", enum: ["LOW", "MODERATE", "HIGH"], description: "Risk classification" },
                  rr_ratio: { type: "number", description: "Risk/Reward ratio — must be >= 2.2" },
                  reason1: { type: "string", description: "First reason for the signal" },
                  reason2: { type: "string", description: "Second reason for the signal" },
                  reason3: { type: "string", description: "Third reason for the signal" },
                },
                required: [
                  "direction", "entry_low", "entry_high", "stop_loss",
                  "tp1", "tp2", "tp3", "confidence", "strategy",
                  "risk_level", "rr_ratio", "reason1", "reason2", "reason3",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_trading_signal" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[generate-signal] AI gateway ${response.status}: ${errText}`);
      return { ok: false, error: `AI gateway error: ${response.status}` };
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("[generate-signal] No tool call in AI response");
      return { ok: false, error: "No tool call in AI response" };
    }

    const args = JSON.parse(toolCall.function.arguments);
    console.log(`[generate-signal] AI returned: ${args.direction} ${pair} @ confidence=${args.confidence} rr=${args.rr_ratio}`);

    // ===== Normalize SL/TP geometry to enforce correct sides + tight SL =====
    normalizeSignalGeometry(args, pair, market);
    console.log(`[generate-signal] Normalized: ${args.direction} entry=[${args.entry_low}, ${args.entry_high}] SL=${args.stop_loss} TP=[${args.tp1}, ${args.tp2}, ${args.tp3}]`);

    // Filter: confidence >= 0.75
    if (args.confidence < 0.75) {
      console.log(`[generate-signal] FILTERED — confidence ${args.confidence} < 0.75`);
      return { ok: false, filtered: true, confidence: args.confidence, rr: args.rr_ratio };
    }

    // Filter: RR >= 2.2
    if (args.rr_ratio < 2.2) {
      console.log(`[generate-signal] FILTERED — RR ${args.rr_ratio} < 2.2`);
      return { ok: false, filtered: true, confidence: args.confidence, rr: args.rr_ratio };
    }

    const expiryMinutes = EXPIRY_MINUTES[timeframe] || 40;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60_000).toISOString();

    const signalRow = {
      pair,
      market,
      direction: args.direction === "LONG" ? "buy" : "sell",
      confidence: args.confidence,
      entry_zone: [args.entry_low, args.entry_high],
      stop_loss: args.stop_loss,
      take_profit: [args.tp1, args.tp2, args.tp3],
      timeframe,
      strategy: args.strategy,
      recommendation: args.strategy,
      risk_data: { rr: args.rr_ratio, risk_level: args.risk_level },
      explanation: [args.reason1, args.reason2, args.reason3],
      execution_type: market === "CRYPTO" ? "ON_CHAIN" : "MANUAL",
      expires_at: expiresAt,
      status: "active",
      user_id: null,
      signal_data: {
        id: crypto.randomUUID(),
        market,
        pair,
        direction: args.direction,
        entry_zone: [args.entry_low, args.entry_high],
        stop_loss: args.stop_loss,
        take_profit: [args.tp1, args.tp2, args.tp3],
        timeframe,
        strategy: args.strategy,
        confidence: args.confidence,
        risk: { rr: args.rr_ratio, risk_level: args.risk_level },
        execution: { type: market === "CRYPTO" ? "ON_CHAIN" : "MANUAL", supported: true },
        explanation: [args.reason1, args.reason2, args.reason3],
        expires_at: Math.floor(new Date(expiresAt).getTime() / 1000),
        model_version: "gemini-3-flash-preview",
        signal_strength: args.confidence,
      },
    };

    const { data: inserted, error: dbError } = await supabase
      .from("trading_signals")
      .insert(signalRow)
      .select("*")
      .single();

    if (dbError) {
      console.error("[generate-signal] DB INSERT FAILED:", dbError);
      return { ok: false, error: `DB insert failed: ${dbError.message}` };
    }

    console.log("[generate-signal] INSERT SUCCESS:", inserted.id);
    return { ok: true, signal: inserted };
  } catch (err: any) {
    console.error(`[generate-signal] Error for ${pair}:`, err);
    return { ok: false, error: err.message };
  }
}

function respond(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Force SL/TP to correct sides relative to direction with a tight pip buffer
function normalizeSignalGeometry(args: any, pair: string, market: string) {
  // Ensure entry_low <= entry_high
  if (args.entry_low > args.entry_high) {
    const tmp = args.entry_low;
    args.entry_low = args.entry_high;
    args.entry_high = tmp;
  }

  const entryMid = (args.entry_low + args.entry_high) / 2;

  // Buffer = distance from entry edge to stop loss (tight, "few pips")
  let buffer: number;
  if (market === "CRYPTO") {
    if (pair === "BTC/USD") buffer = entryMid * 0.0015;       // 0.15%
    else if (pair === "ETH/USD") buffer = entryMid * 0.0015;  // 0.15%
    else buffer = entryMid * 0.0025;                          // 0.25% (POL etc.)
  } else {
    // FOREX: 15 pips
    buffer = pair.includes("JPY") ? 0.15 : 0.0015;
  }

  // RR ladder for TP1/TP2/TP3
  const rrLadder = [1.0, 1.5, Math.max(2.2, args.rr_ratio || 2.2)];

  if (args.direction === "LONG") {
    args.stop_loss = args.entry_low - buffer;
    const risk = entryMid - args.stop_loss;
    args.tp1 = entryMid + risk * rrLadder[0];
    args.tp2 = entryMid + risk * rrLadder[1];
    args.tp3 = entryMid + risk * rrLadder[2];
  } else {
    // SHORT
    args.stop_loss = args.entry_high + buffer;
    const risk = args.stop_loss - entryMid;
    args.tp1 = entryMid - risk * rrLadder[0];
    args.tp2 = entryMid - risk * rrLadder[1];
    args.tp3 = entryMid - risk * rrLadder[2];
  }

  // Round to pair-appropriate precision
  const dp = getPairPrecision(pair);
  args.entry_low = round(args.entry_low, dp);
  args.entry_high = round(args.entry_high, dp);
  args.stop_loss = round(args.stop_loss, dp);
  args.tp1 = round(args.tp1, dp);
  args.tp2 = round(args.tp2, dp);
  args.tp3 = round(args.tp3, dp);

  // Recompute rr_ratio from final geometry (TP3-based)
  const finalRisk = Math.abs(entryMid - args.stop_loss);
  const finalReward = Math.abs(args.tp3 - entryMid);
  args.rr_ratio = finalRisk > 0 ? round(finalReward / finalRisk, 2) : args.rr_ratio;
}

function getPairPrecision(pair: string): number {
  if (pair === "BTC/USD" || pair === "ETH/USD") return 2;
  if (pair === "POL/USD") return 4;
  if (pair.includes("JPY")) return 3;
  return 5; // standard FX
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
