import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FOREX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY"];

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

  try {
    if (!isForexMarketOpen()) {
      return new Response(JSON.stringify({ prices: {}, timestamp: Date.now(), marketOpen: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!apiKey) {
      throw new Error("TWELVE_DATA_API_KEY not configured");
    }

    const symbols = FOREX_PAIRS.join(",");
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${apiKey}`
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Twelve Data API error [${res.status}]: ${errText}`);
    }

    const data = await res.json();

    // Twelve Data returns { "EUR/USD": { price: "1.12345" }, ... } for multiple symbols
    // or { price: "1.12345" } for a single symbol
    const prices: Record<string, number> = {};

    if (FOREX_PAIRS.length === 1) {
      prices[FOREX_PAIRS[0]] = parseFloat(data.price);
    } else {
      for (const pair of FOREX_PAIRS) {
        if (data[pair]?.price) {
          prices[pair] = parseFloat(data[pair].price);
        }
      }
    }

    return new Response(JSON.stringify({ prices, timestamp: Date.now(), marketOpen: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[forex-prices] Error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
