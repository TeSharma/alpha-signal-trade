import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─────────────────────────────────────────────────────────────
// eulerpool-candles — TEST-ONLY OHLCV probe (Phase 2).
//
// ISOLATION CONTRACT (do not weaken):
// - NOT imported or invoked by any frontend/production code.
// - Twelve Data path untouched. Key server-side only.
// - Low-volume: exactly ONE upstream call per invocation.
//
// Verified Eulerpool surface (2026-09-14, live probes):
// - GET /charting/ohlcv/{IDENTIFIER}?interval=daily
//   → { t: [unixSec...], o: [...], h: [...], l: [...], c: [...], v: [...] }
// - Works for equity-style identifiers (verified: AAPL).
// - FX pairs are NOT supported here: EURUSD and XAU both returned
//   404 {"error":"Security not found"}. Crypto is served via
//   /crypto/quotes/{SYM} time-series instead (verified: BTC → 705
//   {timestamp, price} points), NOT via /charting/ohlcv.
// Until an FX-capable candle identifier is verified, this function
// returns `supported: false` for FX pairs rather than guessing.
// ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://api.eulerpool.com/api/1";

// Only identifiers verified to return OHLCV may be listed here.
const VERIFIED_OHLCV_IDS = new Set(["AAPL"]);

export interface NormalizedCandle {
  symbol: string;
  timestamp: number; // ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  source: "eulerpool";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeNumber(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0 = Date.now();
  try {
    const apiKey = Deno.env.get("EULERPOOL_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "EULERPOOL_API_KEY not configured" }, 500);
    }

    const url = new URL(req.url);
    const identifier = (url.searchParams.get("identifier") || "AAPL").trim();
    const interval = (url.searchParams.get("interval") || "daily").trim();

    if (!VERIFIED_OHLCV_IDS.has(identifier)) {
      return jsonResponse(
        {
          error: "identifier_not_verified_for_ohlcv",
          identifier,
          verified: [...VERIFIED_OHLCV_IDS],
          note: "FX pairs (EURUSD) and XAU return 404 Security not found on /charting/ohlcv; crypto uses /crypto/quotes time-series instead. No endpoint guessed.",
          testOnly: true,
        },
        400,
      );
    }

    const upstream = await fetch(
      `${BASE_URL}/charting/ohlcv/${encodeURIComponent(identifier)}?interval=${encodeURIComponent(interval)}`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` } },
    );
    if (upstream.status === 429) {
      return jsonResponse({ error: "eulerpool_rate_limited", upstreamStatus: 429 }, 429);
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return jsonResponse({ error: "eulerpool_auth_failed", upstreamStatus: upstream.status }, 502);
    }
    if (!upstream.ok) {
      return jsonResponse(
        { error: "eulerpool_upstream_error", upstreamStatus: upstream.status },
        502,
      );
    }
    const data = await upstream.json();
    const t: unknown[] = data?.t ?? [];
    const o: unknown[] = data?.o ?? [];
    const h: unknown[] = data?.h ?? [];
    const l: unknown[] = data?.l ?? [];
    const c: unknown[] = data?.c ?? [];
    const v: unknown[] = data?.v ?? [];
    const n = Math.min(t.length, o.length, h.length, l.length, c.length);
    const candles: NormalizedCandle[] = [];
    for (let i = 0; i < n; i++) {
      const ts = safeNumber(t[i]);
      const open = safeNumber(o[i]);
      const high = safeNumber(h[i]);
      const low = safeNumber(l[i]);
      const close = safeNumber(c[i]);
      if (ts == null || open == null || high == null || low == null || close == null) continue;
      const vol = v.length === n ? safeNumber(v[i]) : null;
      candles.push({
        symbol: identifier,
        timestamp: Math.floor(ts) * 1000,
        open,
        high,
        low,
        close,
        volume: vol,
        source: "eulerpool",
      });
    }

    return jsonResponse({
      symbol: identifier,
      interval,
      candles,
      count: candles.length,
      timestamp: Date.now(),
      source: "eulerpool",
      testOnly: true,
      upstreamStatus: upstream.status,
      latencyMs: Date.now() - t0,
      delayed: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg, candles: [], testOnly: true }, 500);
  }
});
