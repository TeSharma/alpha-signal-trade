import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pair, direction } = await req.json();
    if (!pair || !direction) throw new Error("pair and direction are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a pre-trade validation AI. Given a trading pair and proposed direction, quickly assess whether this trade aligns with current market conditions. Be concise and practical.`,
          },
          {
            role: "user",
            content: `Validate this proposed trade: ${direction.toUpperCase()} ${pair}. Give a quick confidence check and recommendation.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "check_trade",
              description: "Return a pre-trade confidence check",
              parameters: {
                type: "object",
                properties: {
                  confidence: { type: "number", description: "Confidence 0-100" },
                  direction: { type: "string", enum: ["buy", "sell", "hold"] },
                  recommendation: { type: "string", enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"] },
                  explanation: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-3 brief reasons",
                  },
                },
                required: ["confidence", "direction", "recommendation", "explanation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "check_trade" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const checkData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      pair,
      direction: checkData.direction,
      confidence: checkData.confidence,
      recommendation: checkData.recommendation,
      explanation: checkData.explanation,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-signal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
