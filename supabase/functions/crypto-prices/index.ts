import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pair -> { binance symbol, coingecko id }
const PAIRS: Record<string, { binance: string; cg: string }> = {
  "BTC/USD": { binance: "BTCUSDT", cg: "bitcoin" },
  "ETH/USD": { binance: "ETHUSDT", cg: "ethereum" },
  "POL/USD": { binance: "POLUSDT", cg: "polygon-ecosystem-token" },
};

type Ticker = {
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  source: "binance" | "coingecko";
};

async function fetchBinance(symbol: string): Promise<Ticker | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!res.ok) {
      await res.text().catch(() => "");
      return null;
    }
    const j = await res.json();
    return {
      lastPrice: j.lastPrice,
      priceChange: j.priceChange,
      priceChangePercent: j.priceChangePercent,
      highPrice: j.highPrice,
      lowPrice: j.lowPrice,
      volume: j.volume,
      source: "binance",
    };
  } catch {
    return null;
  }
}

async function fetchCoinGecko(ids: string[]): Promise<Record<string, any>> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(
      ","
    )}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
    const res = await fetch(url);
    if (!res.ok) {
      await res.text().catch(() => "");
      return {};
    }
    return await res.json();
  } catch {
    return {};
  }
}

function cgToTicker(price: number, changePct: number, vol: number): Ticker {
  const priceChange = (price * changePct) / 100;
  return {
    lastPrice: String(price),
    priceChange: String(priceChange),
    priceChangePercent: String(changePct),
    highPrice: String(price),
    lowPrice: String(price),
    volume: String(vol ?? 0),
    source: "coingecko",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Try Binance for each pair in parallel
    const binanceResults = await Promise.all(
      Object.entries(PAIRS).map(async ([pair, { binance }]) => {
        const t = await fetchBinance(binance);
        return [pair, t] as const;
      })
    );

    const prices: Record<string, Ticker> = {};
    const missing: string[] = [];
    for (const [pair, t] of binanceResults) {
      if (t) prices[pair] = t;
      else missing.push(pair);
    }

    // Fallback to CoinGecko for any missing
    if (missing.length > 0) {
      const ids = missing.map((p) => PAIRS[p].cg);
      const cg = await fetchCoinGecko(ids);
      for (const pair of missing) {
        const id = PAIRS[pair].cg;
        const data = cg[id];
        if (data && typeof data.usd === "number") {
          prices[pair] = cgToTicker(
            data.usd,
            data.usd_24h_change ?? 0,
            data.usd_24h_vol ?? 0
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ prices, timestamp: Date.now() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    console.error("[crypto-prices] Unexpected error:", e);
    // Never return 5xx — return empty prices so client can keep working with WS
    return new Response(
      JSON.stringify({ prices: {}, timestamp: Date.now(), fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
