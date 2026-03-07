import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSession(): string {
  const hour = new Date().getUTCHours();
  if (hour >= 0 && hour < 8) return "ASIA";
  if (hour >= 8 && hour < 16) return "LONDON";
  return "NEW_YORK";
}

function getDayOfWeek(): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getUTCDay()];
}

async function fetchCryptoPrice(pair: string): Promise<{ price: number; high: number; low: number }> {
  const symbolMap: Record<string, string> = {
    "BTC/USD": "BTCUSDT",
    "ETH/USD": "ETHUSDT",
    "POL/USD": "POLUSDT",
  };
  const symbol = symbolMap[pair];
  if (!symbol) throw new Error(`Unsupported crypto pair: ${pair}`);

  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = await res.json();
  return {
    price: parseFloat(data.lastPrice),
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
  };
}

async function fetchForexPrice(pair: string): Promise<{ price: number; high: number; low: number }> {
  // Try free FX API first
  const fxMap: Record<string, { base: string; target: string }> = {
    "EUR/USD": { base: "EUR", target: "USD" },
    "GBP/USD": { base: "GBP", target: "USD" },
    "USD/JPY": { base: "USD", target: "JPY" },
  };
  const fx = fxMap[pair];
  if (!fx) throw new Error(`Unsupported forex pair: ${pair}`);

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fx.base}`);
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates?.[fx.target];
      if (rate) {
        // For EUR/USD and GBP/USD the rate IS the price; for USD/JPY it's direct
        const price = rate;
        const range = price * 0.003; // estimate ~0.3% daily range
        return { price, high: price + range / 2, low: price - range / 2 };
      }
    }
  } catch (e) {
    console.warn("FX API failed, using fallback:", e);
  }

  // Fallback estimates
  const estimates: Record<string, { price: number; range: number }> = {
    "EUR/USD": { price: 1.085, range: 0.005 },
    "GBP/USD": { price: 1.27, range: 0.008 },
    "USD/JPY": { price: 150.5, range: 1.5 },
  };
  const est = estimates[pair]!;
  return { price: est.price, high: est.price + est.range / 2, low: est.price - est.range / 2 };
}

const CRYPTO_PAIRS = ["BTC/USD", "ETH/USD", "POL/USD"];
const MODEL_VERSION = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pair, timeframe = "15m" } = await req.json();
    if (!pair) throw new Error("pair is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isCrypto = CRYPTO_PAIRS.includes(pair);
    const market = isCrypto ? "CRYPTO" : "FOREX";
    const priceData = isCrypto ? await fetchCryptoPrice(pair) : await fetchForexPrice(pair);
    const session = getSession();
    const dayOfWeek = getDayOfWeek();
    const volatilityRange = ((priceData.high - priceData.low) / priceData.price) * 100;
    const volatilityRegime = volatilityRange > 3 ? "HIGH" : volatilityRange > 1 ? "NORMAL" : "LOW";

    const systemPrompt = `You are a professional trading signal AI. You run 5 analysis engines:

1. TrendEngine: Determine higher-timeframe trend (bullish/bearish/neutral)
2. StructureEngine: Detect market structure (HH/HL = bullish, LH/LL = bearish)
3. MomentumEngine: Session-based momentum and volatility expansion
4. RiskEngine: Calculate stop distance, risk-reward ratio, position sizing
5. ConfidenceEngine: Aggregate all engines into final confidence (0.0-1.0)

Current market context:
- Pair: ${pair}
- Market: ${market}
- Current Price: ${priceData.price}
- 24h High: ${priceData.high}
- 24h Low: ${priceData.low}
- Session: ${session}
- Day: ${dayOfWeek}
- Volatility: ${volatilityRegime} (${volatilityRange.toFixed(2)}% range)
- Timeframe: ${timeframe}

Analyze this market and produce a trading signal. Be conservative — only give confidence >= 0.60 if there's a clear setup. Consider the session timing and volatility regime.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_VERSION,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a trading signal for ${pair} on the ${timeframe} timeframe.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_signal",
              description: "Emit a structured trading signal after analysis",
              parameters: {
                type: "object",
                properties: {
                  direction: { type: "string", enum: ["LONG", "SHORT"] },
                  entry_zone: {
                    type: "array",
                    items: { type: "number" },
                    minItems: 2,
                    maxItems: 2,
                    description: "Price range [low, high] for entry",
                  },
                  stop_loss: { type: "number", description: "Stop loss price" },
                  take_profit: {
                    type: "array",
                    items: { type: "number" },
                    description: "Take profit targets (1-3 levels)",
                  },
                  strategy: { type: "string", description: "Strategy name, e.g. Trend Continuation, Reversal" },
                  confidence: { type: "number", description: "Confidence score 0.0 to 1.0" },
                  rr: { type: "number", description: "Risk-reward ratio" },
                  risk_level: { type: "string", enum: ["LOW", "MODERATE", "HIGH"] },
                  explanation: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 bullet points explaining the signal reasoning",
                  },
                },
                required: ["direction", "entry_zone", "stop_loss", "take_profit", "strategy", "confidence", "rr", "risk_level", "explanation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_signal" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const signalData = JSON.parse(toolCall.function.arguments);

    // Enforce confidence threshold
    if (signalData.confidence < 0.60) {
      return new Response(JSON.stringify({
        filtered: true,
        confidence: signalData.confidence,
        message: "Signal below confidence threshold (0.60). Not published.",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const executionType = isCrypto ? "ON_CHAIN" : "MANUAL";
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    const signal = {
      id: crypto.randomUUID(),
      market,
      pair,
      direction: signalData.direction,
      entry_zone: signalData.entry_zone,
      stop_loss: signalData.stop_loss,
      take_profit: signalData.take_profit,
      timeframe,
      strategy: signalData.strategy,
      confidence: signalData.confidence,
      risk: { rr: signalData.rr, risk_level: signalData.risk_level },
      execution: { type: executionType, supported: true },
      explanation: signalData.explanation,
      expires_at: Math.floor(Date.now() / 1000) + 4 * 3600,
      model_version: MODEL_VERSION,
    };

    // Store in DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
      const userClient = createClient(supabaseUrl, anonKey!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    const { error: insertError } = await supabase.from("trading_signals").insert({
      id: signal.id,
      pair,
      direction: signalData.direction,
      confidence: signalData.confidence,
      recommendation: signalData.strategy,
      signal_data: signal,
      user_id: userId, // nullable — OK for anonymous users
      market,
      entry_zone: signalData.entry_zone,
      stop_loss: signalData.stop_loss,
      take_profit: signalData.take_profit,
      timeframe,
      strategy: signalData.strategy,
      risk_data: signal.risk,
      explanation: signalData.explanation,
      execution_type: executionType,
      expires_at: expiresAt,
      status: "active",
    });

    if (insertError) {
      console.error("Failed to store signal in DB:", insertError);
    } else {
      // Seed performance record
      const entryMid = (signalData.entry_zone[0] + signalData.entry_zone[1]) / 2;
      const { error: perfError } = await supabase.from("signal_performance").insert({
        signal_id: signal.id,
        pair,
        direction: signalData.direction,
        entry_price: entryMid,
        stop_loss: signalData.stop_loss,
        take_profit: signalData.take_profit[0] || null,
        result: "open",
        model_version: MODEL_VERSION,
        strategy: signalData.strategy,
      });
      if (perfError) console.error("Failed to seed signal_performance:", perfError);
    }

    return new Response(JSON.stringify(signal), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-signal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
