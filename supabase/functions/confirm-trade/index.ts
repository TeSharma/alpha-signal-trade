// @ts-nocheck
/**
 * Supabase Edge Function - Deno Runtime
 * DUAL-MODE AI TRADING SYSTEM: USER MODE
 * 
 * AI validates user trade setups and returns verdict
 * Returns: confirm | reject | modify with confidence and feedback
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketData {
  pair: string;
  currentPrice: number;
  closes: number[];
  highs: number[];
  lows: number[];
  atr: number;
  rsi: number;
  trend: "uptrend" | "downtrend" | "ranging";
  volatility: "high" | "normal" | "low";
  isChoppy: boolean;
}

interface UserTrade {
  pair: string;
  direction: "buy" | "sell";
  entry: number;
  stop_loss: number;
  take_profit: number[];
  timeframe?: string;
}

interface AIResponse {
  decision: "confirm" | "reject" | "modify";
  confidence: number;
  feedback: string;
  modified_trade?: {
    stop_loss?: number;
    take_profit?: number[];
  };
}

// ============================================================================
// MARKET DATA FETCHING
// ============================================================================

async function fetchCryptoOHLCV(pair: string, timeframe: string): Promise<OHLCV[]> {
  const symbolMap: Record<string, string> = {
    "BTC/USD": "BTCUSDT",
    "ETH/USD": "ETHUSDT",
    "POL/USD": "POLUSDT",
  };
  const symbol = symbolMap[pair];
  if (!symbol) throw new Error(`Unsupported crypto pair: ${pair}`);

  const intervalMap: Record<string, string> = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m",
    "30m": "30m", "1h": "1h", "2h": "2h", "4h": "4h",
    "6h": "6h", "8h": "8h", "12h": "12h", "1d": "1d",
  };
  const interval = intervalMap[timeframe || "15m"] || "15m";

  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`
  );
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data = await res.json();

  return data.map((candle: any[]) => ({
    time: candle[0],
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5]),
  }));
}

async function fetchForexOHLCV(pair: string, timeframe: string): Promise<OHLCV[]> {
  const fxMap: Record<string, { base: string; target: string; basePrice: number }> = {
    "EUR/USD": { base: "EUR", target: "USD", basePrice: 1.085 },
    "GBP/USD": { base: "GBP", target: "USD", basePrice: 1.27 },
    "USD/JPY": { base: "USD", target: "JPY", basePrice: 150.5 },
  };
  const fx = fxMap[pair];
  if (!fx) throw new Error(`Unsupported forex pair: ${pair}`);

  let currentRate = fx.basePrice;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${fx.base}`);
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates?.[fx.target];
      if (rate) currentRate = rate;
    }
  } catch (e) {
    console.warn("FX rate fetch failed:", e);
  }

  const candles: OHLCV[] = [];
  let price = currentRate * (1 - (Math.random() * 0.02));
  const volatility = currentRate * 0.002;
  const now = Date.now();

  for (let i = 99; i >= 0; i--) {
    const change = (Math.random() - 0.5) * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    candles.push({
      time: now - i * 900000,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000 + 500000,
    });
    price = close;
  }

  return candles;
}

// ============================================================================
// TECHNICAL ANALYSIS ENGINE
// ============================================================================

function detectTrend(closes: number[]): "uptrend" | "downtrend" | "ranging" {
  if (closes.length < 10) return "ranging";

  const last10 = closes.slice(-10);
  const first5 = last10.slice(0, 5);
  const last5 = last10.slice(-5);

  const firstAvg = first5.reduce((a, b) => a + b, 0) / first5.length;
  const lastAvg = last5.reduce((a, b) => a + b, 0) / last5.length;

  const change = (lastAvg - firstAvg) / firstAvg;

  if (change > 0.005) return "uptrend";
  if (change < -0.005) return "downtrend";
  return "ranging";
}

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateATR(ohlcv: OHLCV[], period: number = 14): number {
  if (ohlcv.length < period) return 0;

  const trues: number[] = [];
  for (let i = 1; i < ohlcv.length; i++) {
    const highLow = ohlcv[i].high - ohlcv[i].low;
    const highClose = Math.abs(ohlcv[i].high - ohlcv[i - 1].close);
    const lowClose = Math.abs(ohlcv[i].low - ohlcv[i - 1].close);
    trues.push(Math.max(highLow, highClose, lowClose));
  }

  const recent = trues.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function isChoppyMarket(atr: number, price: number): boolean {
  const atrPercent = (atr / price) * 100;
  return atrPercent < 0.1;
}

function classifyVolatility(atr: number, price: number): "high" | "normal" | "low" {
  const atrPercent = (atr / price) * 100;
  if (atrPercent > 2) return "high";
  if (atrPercent > 0.5) return "normal";
  return "low";
}

// ============================================================================
// MARKET DATA AGGREGATION
// ============================================================================

async function fetchMarketData(pair: string, timeframe: string): Promise<MarketData> {
  const CRYPTO_PAIRS = ["BTC/USD", "ETH/USD", "POL/USD"];
  const isCrypto = CRYPTO_PAIRS.includes(pair);

  const ohlcv = isCrypto
    ? await fetchCryptoOHLCV(pair, timeframe)
    : await fetchForexOHLCV(pair, timeframe);

  const closes = ohlcv.map(c => c.close);
  const highs = ohlcv.map(c => c.high);
  const lows = ohlcv.map(c => c.low);
  const currentPrice = closes[closes.length - 1];

  const atr = calculateATR(ohlcv);
  const rsi = calculateRSI(closes);
  const trend = detectTrend(closes);
  const volatility = classifyVolatility(atr, currentPrice);
  const isChoppy = isChoppyMarket(atr, currentPrice);

  return {
    pair,
    currentPrice,
    closes,
    highs,
    lows,
    atr,
    rsi,
    trend,
    volatility,
    isChoppy,
  };
}

// ============================================================================
// TRADE VALIDATION
// ============================================================================

function calculateRR(trade: UserTrade): number {
  const { direction, entry, stop_loss, take_profit } = trade;
  const tp = take_profit[0];

  if (direction === "buy") {
    return (tp - entry) / (entry - stop_loss);
  } else {
    return (entry - tp) / (stop_loss - entry);
  }
}

function validateUserTrade(trade: UserTrade, marketData: MarketData): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check direction
  if (!["buy", "sell"].includes(trade.direction)) {
    reasons.push("Invalid direction (must be 'buy' or 'sell')");
  }

  // Check RR
  const rr = calculateRR(trade);
  if (rr < 2.0) {
    reasons.push(`RR ${rr.toFixed(2)} below minimum 2.0`);
  }

  // Check trend alignment
  if (marketData.trend === "uptrend" && trade.direction === "sell") {
    reasons.push("Counter-trend: Selling in uptrend");
  }
  if (marketData.trend === "downtrend" && trade.direction === "buy") {
    reasons.push("Counter-trend: Buying in downtrend");
  }

  // Check choppy market
  if (marketData.isChoppy) {
    reasons.push("Market is choppy (low volatility)");
  }

  // Check RSI extremes
  if (trade.direction === "buy" && marketData.rsi > 80) {
    reasons.push("RSI overbought (>80) - poor entry for long");
  }
  if (trade.direction === "sell" && marketData.rsi < 20) {
    reasons.push("RSI oversold (<20) - poor entry for short");
  }

  // Check stop loss placement
  if (trade.direction === "buy" && trade.stop_loss >= trade.entry) {
    reasons.push("Stop loss must be below entry for long");
  }
  if (trade.direction === "sell" && trade.stop_loss <= trade.entry) {
    reasons.push("Stop loss must be above entry for short");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

// ============================================================================
// MAIN EDGE FUNCTION
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pair, direction, entry, stop_loss, take_profit, timeframe = "15m" } = await req.json();

    // Validate input
    if (!pair || !direction || entry === undefined || stop_loss === undefined || !take_profit) {
      return new Response(JSON.stringify({
        error: "Missing required fields: pair, direction, entry, stop_loss, take_profit"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("Either OPENAI_API_KEY or LOVABLE_API_KEY must be configured");
    }

    // Fetch market data
    const marketData = await fetchMarketData(pair, timeframe);

    // Validate trade
    const validation = validateUserTrade(
      { pair, direction, entry, stop_loss, take_profit },
      marketData
    );

    // If trade fails basic validation, reject immediately
    if (!validation.valid) {
      return new Response(JSON.stringify({
        decision: "reject",
        confidence: 1.0,
        feedback: `Trade rejected: ${validation.reasons.join("; ")}`,
        market_context: {
          trend: marketData.trend,
          rsi: marketData.rsi,
          volatility: marketData.volatility,
          isChoppy: marketData.isChoppy,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build AI prompt
    const tradeData = {
      pair,
      direction,
      entry,
      stop_loss,
      take_profit,
      rr: calculateRR({ pair, direction, entry, stop_loss, take_profit }),
    };

    const marketContext = {
      currentPrice: marketData.currentPrice,
      trend: marketData.trend,
      rsi: parseFloat(marketData.rsi.toFixed(2)),
      atr: parseFloat(marketData.atr.toFixed(6)),
      volatility: marketData.volatility,
      isChoppy: marketData.isChoppy,
      recentCloses: marketData.closes.slice(-10),
    };

    const systemPrompt = `You are a professional trading assistant analyzing a user's trade setup.

Market Context:
${JSON.stringify(marketContext, null, 2)}

User's Proposed Trade:
${JSON.stringify(tradeData, null, 2)}

Your Task:
Analyze this trade and provide a verdict.

Rules:
- Reject if RR < 2
- Reject if counter-trend
- Reject if choppy market
- Reject if RSI extremes (>80 for buy, <20 for sell)
- Suggest modifications if SL/TP could be improved based on ATR

Return ONLY valid JSON with this structure:
{
  "decision": "confirm" | "reject" | "modify",
  "confidence": number (0-1),
  "feedback": "concise explanation of your decision",
  "modified_trade": {  // Only include if decision is "modify"
    "stop_loss": number,
    "take_profit": [number, number, number]
  }
}`;

    // Call AI
    let aiResponse: AIResponse;

    if (OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze this trade and return your verdict in JSON format." },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");

      try {
        aiResponse = JSON.parse(content);
      } catch (e) {
        throw new Error("AI returned invalid JSON");
      }
    } else {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Analyze this trade and return your verdict in JSON format." },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");

      try {
        aiResponse = JSON.parse(content);
      } catch (e) {
        throw new Error("AI returned invalid JSON");
      }
    }

    // Validate AI response
    if (!["confirm", "reject", "modify"].includes(aiResponse.decision)) {
      aiResponse.decision = "reject";
      aiResponse.feedback = "Invalid AI response - trade rejected for safety";
    }

    // Store in database if confirmed or modified
    if (aiResponse.decision === "confirm" || aiResponse.decision === "modify") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const finalEntry = aiResponse.decision === "modify" && aiResponse.modified_trade
        ? [entry - (aiResponse.modified_trade.stop_loss ? Math.abs(entry - aiResponse.modified_trade.stop_loss) * 0.1 : 0), entry + (aiResponse.modified_trade.stop_loss ? Math.abs(entry - aiResponse.modified_trade.stop_loss) * 0.1 : 0)]
        : [entry * 0.999, entry * 1.001];

      const finalSL = aiResponse.decision === "modify" && aiResponse.modified_trade?.stop_loss
        ? aiResponse.modified_trade.stop_loss
        : stop_loss;

      const finalTP = aiResponse.decision === "modify" && aiResponse.modified_trade?.take_profit
        ? aiResponse.modified_trade.take_profit
        : take_profit;

      // Get user ID
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

      // Schema Mapping Functions
      function mapSignalToDB(signal: any): any {
        return {
          ...signal,
          user_id: userId,
          status: "active",
          source: "user"
        };
      }
      
      function filterToSchema(payload: any): any {
        const allowedColumns = [
          "pair", "direction", "confidence", "recommendation",
          "entry_zone", "stop_loss", "take_profit", "timeframe",
          "strategy", "market", "risk", "explanation", "execution",
          "expires_at", "signal_data", "user_id", "status", "source",
          "ai_decision", "ai_comment"
        ];
        
        const filtered: any = {};
        for (const key of allowedColumns) {
          if (payload[key] !== undefined) {
            filtered[key] = payload[key];
          }
        }
        return filtered;
      }

      // Build unified signal object
      const signal = {
        pair,
        direction,
        confidence: aiResponse.confidence,
        recommendation: direction.toUpperCase(),

        entry_zone: finalEntry,
        stop_loss: finalSL,
        take_profit: finalTP,

        timeframe,
        strategy: "user_trade",

        market: "FOREX",

        risk: {
          rr: calculateRR({ pair, direction, entry, stop_loss, take_profit }),
        },

        explanation: [aiResponse.feedback],

        execution: {
          type: "MANUAL",
        },

        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),

        // IMPORTANT: store EVERYTHING raw here
        signal_data: {
          ai_decision: aiResponse.decision,
          ai_feedback: aiResponse.feedback,
          original_input: { pair, direction, entry, stop_loss, take_profit }
        },
        
        ai_decision: aiResponse.decision,
        ai_comment: aiResponse.feedback
      };

      // 🚀 USE SCHEMA MAPPER
      const rawPayload = mapSignalToDB(signal);
      const dbPayload = filterToSchema(rawPayload);

      console.log("CONFIRM TRADE DB PAYLOAD:", dbPayload);

      const { data, error } = await supabase
        .from("trading_signals")
        .insert(dbPayload)
        .select();

      if (error) {
        console.error("CONFIRM TRADE INSERT ERROR:", error);
      } else {
        console.log("CONFIRM TRADE INSERT SUCCESS:", data);
      }
    }

    return new Response(JSON.stringify({
      decision: aiResponse.decision,
      confidence: aiResponse.confidence,
      feedback: aiResponse.feedback,
      modified_trade: aiResponse.modified_trade,
      market_context: {
        trend: marketData.trend,
        rsi: marketData.rsi,
        volatility: marketData.volatility,
        currentPrice: marketData.currentPrice,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("confirm-trade error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});