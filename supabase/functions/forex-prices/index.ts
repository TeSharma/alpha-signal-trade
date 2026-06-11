import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FOREX_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"];
const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;

type Source = "twelvedata" | "exchangerate.host" | "cache";
type CacheEntry = { prices: Record<string, number>; timestamp: number; source: Source };

let cache: CacheEntry | null = null;
let rateLimitedUntil = 0;

class RateLimitError extends Error {}

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

async function fetchFromTwelveData(): Promise<Record<string, number>> {
  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!apiKey) throw new Error("TWELVE_DATA_API_KEY not configured");

  const symbols = FOREX_PAIRS.join(",");
  const res = await fetch(
    `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${apiKey}`
  );

  if (res.status === 429) {
    await res.text().catch(() => "");
    throw new RateLimitError("Twelve Data 429");
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twelve Data API error [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  const prices: Record<string, number> = {};
  if (FOREX_PAIRS.length === 1) {
    prices[FOREX_PAIRS[0]] = parseFloat(data.price);
  } else {
    for (const pair of FOREX_PAIRS) {
      if (data[pair]?.price) prices[pair] = parseFloat(data[pair].price);
    }
  }
  if (Object.keys(prices).length === 0) {
    throw new Error("Twelve Data returned no prices");
  }
  return prices;
}

async function fetchFromExchangerateHost(): Promise<Record<string, number>> {
  // Free, no API key. Rates are quoted against `base` (USD here).
  const res = await fetch(
    "https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP,JPY,XAU"
  );
  if (!res.ok) {
    throw new Error(`exchangerate.host error [${res.status}]`);
  }
  const data = await res.json();
  const rates = data?.rates ?? {};
  const prices: Record<string, number> = {};

  // EUR/USD = 1 / (USD->EUR)
  if (rates.EUR) prices["EUR/USD"] = 1 / rates.EUR;
  if (rates.GBP) prices["GBP/USD"] = 1 / rates.GBP;
  // USD/JPY = USD->JPY (already in correct direction)
  if (rates.JPY) prices["USD/JPY"] = rates.JPY;
  // XAU is troy ounces per USD; XAU/USD price = 1 / rate
  if (rates.XAU) prices["XAU/USD"] = 1 / rates.XAU;

  if (Object.keys(prices).length === 0) {
    throw new Error("exchangerate.host returned no usable rates");
  }
  return prices;
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

    // Fresh cache
    if (cache && now - cache.timestamp < CACHE_TTL_MS) {
      return jsonResponse({
        prices: cache.prices,
        timestamp: cache.timestamp,
        marketOpen: true,
        source: cache.source,
        cached: true,
      });
    }

    // Try Twelve Data unless we're in backoff
    if (now >= rateLimitedUntil) {
      try {
        const prices = await fetchFromTwelveData();
        cache = { prices, timestamp: now, source: "twelvedata" };
        return jsonResponse({
          prices,
          timestamp: now,
          marketOpen: true,
          source: "twelvedata",
        });
      } catch (e) {
        if (e instanceof RateLimitError) {
          rateLimitedUntil = now + RATE_LIMIT_BACKOFF_MS;
          console.warn("[forex-prices] Twelve Data rate-limited; falling back.");
        } else {
          console.error("[forex-prices] Twelve Data failed:", e);
        }
      }
    }

    // Fallback provider
    try {
      const prices = await fetchFromExchangerateHost();
      cache = { prices, timestamp: now, source: "exchangerate.host" };
      return jsonResponse({
        prices,
        timestamp: now,
        marketOpen: true,
        source: "exchangerate.host",
      });
    } catch (e) {
      console.error("[forex-prices] Fallback failed:", e);
    }

    // Stale cache as last resort
    if (cache) {
      return jsonResponse({
        prices: cache.prices,
        timestamp: cache.timestamp,
        marketOpen: true,
        source: cache.source,
        cached: true,
        stale: true,
      });
    }

    return jsonResponse({
      prices: {},
      timestamp: now,
      marketOpen: true,
      error: "all_providers_failed",
    });
  } catch (e: unknown) {
    console.error("[forex-prices] Unexpected error:", e);
    if (cache) {
      return jsonResponse({
        prices: cache.prices,
        timestamp: cache.timestamp,
        marketOpen: true,
        source: cache.source,
        cached: true,
        stale: true,
      });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg, prices: {}, marketOpen: true });
  }
});
