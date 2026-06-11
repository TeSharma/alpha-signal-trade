import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FOREX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"];
const CACHE_TTL_MS = 60_000; // serve cached prices for 60s to stay under Twelve Data free-tier limits
const RATE_LIMIT_BACKOFF_MS = 60_000;

type CacheEntry = { prices: Record<string, number>; timestamp: number };
let cache: CacheEntry | null = null;
let rateLimitedUntil = 0;

function isForexMarketOpen(date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  if (day === 6) return false;
  if (day === 0) return hour >= 22;
  if (day === 5) return hour < 22;
  return true;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!isForexMarketOpen()) {
      return jsonResponse({ prices: {}, timestamp: Date.now(), marketOpen: false });
    }

    const now = Date.now();

    // Serve fresh cache
    if (cache && now - cache.timestamp < CACHE_TTL_MS) {
      return jsonResponse({
        prices: cache.prices,
        timestamp: cache.timestamp,
        marketOpen: true,
        cached: true,
      });
    }

    // If we recently hit rate limit, serve stale cache (if any) instead of calling API
    if (now < rateLimitedUntil) {
      if (cache) {
        return jsonResponse({
          prices: cache.prices,
          timestamp: cache.timestamp,
          marketOpen: true,
          cached: true,
          stale: true,
        });
      }
      return jsonResponse({
        prices: {},
        timestamp: now,
        marketOpen: true,
        error: "rate_limited",
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
      if (res.status === 429) {
        rateLimitedUntil = now + RATE_LIMIT_BACKOFF_MS;
        console.warn("[forex-prices] Rate limited by Twelve Data; serving cached data.");
        if (cache) {
          return jsonResponse({
            prices: cache.prices,
            timestamp: cache.timestamp,
            marketOpen: true,
            cached: true,
            stale: true,
          });
        }
        return jsonResponse({
          prices: {},
          timestamp: now,
          marketOpen: true,
          error: "rate_limited",
        });
      }
      throw new Error(`Twelve Data API error [${res.status}]: ${errText}`);
    }

    const data = await res.json();
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

    cache = { prices, timestamp: now };

    return jsonResponse({ prices, timestamp: now, marketOpen: true });
  } catch (e: unknown) {
    console.error("[forex-prices] Error:", e);
    // Fall back to cache on any unexpected failure
    if (cache) {
      return jsonResponse({
        prices: cache.prices,
        timestamp: cache.timestamp,
        marketOpen: true,
        cached: true,
        stale: true,
      });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg, prices: {}, marketOpen: true }, 200);
  }
});
