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
  "30m": 60,
  "1h": 120,
  "4h": 480,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[generate-signal] FUNCTION TRIGGERED");

  try {
    const body = await req.json();
    const isBatch = body.batch === true;
    const pair = body.pair as string | undefined;
    const timeframe = (body.timeframe as string) || "15m";

    console.log("[generate-signal] DB PAYLOAD", JSON.stringify({ isBatch, pair, timeframe }));

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
        // Small delay between calls to avoid rate limits
        await new Promise((r) => setTimeout(r, 2000));
      }
      const ok = results.filter((r) => r.ok).length;
      const filtered = results.filter((r) => r.filtered).length;
      const failed = results.filter((r) => !r.ok && !r.filtered).length;
      console.log(`[generate-signal] BATCH COMPLETE: ${ok} inserted, ${filtered} filtered, ${failed} failed`);
      return respond({ success: true, inserted: ok, filtered, failed, results });
    }

    if (!pair) {
      return respond({ error: "Missing 'pair' or 'batch' flag" }, 400);
    }

    const market = pair.includes("USD") && !["EUR/USD", "GBP/USD", "USD/JPY"].includes(pair) ? "CRYPTO" : "FOREX";
    const actualMarket = ALL_PAIRS.find((p) => p.pair === pair)?.market || market;

    const result = await generateForPair(supabaseClient, LOVABLE_API_KEY, pair, actualMarket, timeframe);

    if (result.filtered) {
      return respond({ filtered: true, confidence: result.confidence, message: `Signal for ${pair} below 0.60 threshold. Not published.` });
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

async function generateForPair(
  supabase: any,
  apiKey: string,
  pair: string,
  market: string,
  timeframe: string
): Promise<{ ok: boolean; filtered?: boolean; confidence?: number; signal?: any; error?: string }> {
  console.log(`[generate-signal] Generating for ${pair} @ ${timeframe}`);

  try {
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
4. Risk Engine — calculate risk/reward ratio
5. Confidence Engine — aggregate signal quality score

Generate a trading signal for the given pair and timeframe. Be realistic with price levels. For crypto pairs use current approximate market prices. For forex pairs use standard pip-level precision.`,
          },
          {
            role: "user",
            content: `Generate a ${timeframe} trading signal for ${pair} (${market} market). Analyze current conditions and provide a structured signal.`,
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
                  confidence: { type: "number", description: "Signal confidence from 0.0 to 1.0" },
                  strategy: { type: "string", description: "Strategy name, e.g. Trend Following, Mean Reversion, Breakout" },
                  risk_level: { type: "string", enum: ["LOW", "MODERATE", "HIGH"], description: "Risk classification" },
                  rr_ratio: { type: "number", description: "Risk/Reward ratio (e.g. 2.5)" },
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
    console.log(`[generate-signal] AI returned: ${args.direction} ${pair} @ ${args.confidence} confidence`);

    // Filter low confidence
    if (args.confidence < 0.6) {
      console.log(`[generate-signal] FILTERED — confidence ${args.confidence} < 0.60`);
      return { ok: false, filtered: true, confidence: args.confidence };
    }

    const expiryMinutes = EXPIRY_MINUTES[timeframe] || 60;
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
    headers: {
      ...{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      },
      "Content-Type": "application/json",
    },
  });
}
