import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─────────────────────────────────────────────────────────────
// eulerpool-prices — TEST-ONLY market-data probe (Phase 2).
//
// ISOLATION CONTRACT (do not weaken):
// - NOT imported or invoked by any frontend code, hook, component,
//   AI pipeline (generate-signal), evaluator, trader, wallet, auth,
//   contract, or risk path. Discoverable only via direct
//   `supabase.functions.invoke('eulerpool-prices')` test calls.
// - Twelve Data production path (forex-prices) is untouched.
// - API key is server-side only: Deno.env.get("EULERPOOL_API_KEY").
//   Never accepted from, echoed to, or logged for the client.
// - Low-volume by design: one upstream call per invocation (the
//   /forex/rates/{base} snapshot), no fan-out, no retries on 429.
//
// Verified Eulerpool surface (2026-09-14, live probes):
// - Base: https://api.eulerpool.com/api/1
// - Auth: Authorization: Bearer <key> header
// - GET /forex/rates/{BASE} → { base, rates: { USD, GBP, JPY, ... } }
//   Spot snapshot only (no per-quote timestamps on free tier).
// ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://api.eulerpool.com/api/1";

// ShTrader "PAIR" -> (rates-base, rates-key). Inversion matches the
// convention already used by forex-prices fallbacks (frankfurter/er-api).
const PAIRS: Record<string, { base: string; key: string; invert: boolean }> = {
  "EUR/USD": { base: "EUR", key: "USD", invert: false },
  "GBP/USD": { base: "GBP", key: "USD", invert: false },
  "USD/JPY": { base: "USD", key: "JPY", invert: false },
  "AUD/USD": { base: "AUD", key: "USD", invert: false },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeNumber(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
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

    let symbols: string[] | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (Array.isArray(body.symbols)) symbols = body.symbols;
      } catch {
        // fall through to defaults
      }
    }
    if (!symbols) {
      const url = new URL(req.url);
      const q = url.searchParams.get("symbols");
      symbols = q ? q.split(",").map((s) => s.trim()) : Object.keys(PAIRS);
    }
    const wanted = symbols.filter((s) => s in PAIRS);
    if (wanted.length === 0) {
      return jsonResponse({ error: "no_supported_symbols", supported: Object.keys(PAIRS) }, 400);
    }

    // One upstream call per needed base (deduped): EUR, GBP, USD, AUD.
    const bases = [...new Set(wanted.map((s) => PAIRS[s].base))];
    const snapshots: Record<string, Record<string, number>> = {};
    let upstreamStatus = 0;
    for (const base of bases) {
      const res = await fetch(`${BASE_URL}/forex/rates/${base}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
      });
      upstreamStatus = res.status;
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        return jsonResponse(
          { error: "eulerpool_rate_limited", upstreamStatus: 429, retryAfter, symbols: wanted },
          429,
        );
      }
      if (res.status === 401 || res.status === 403) {
        return jsonResponse({ error: "eulerpool_auth_failed", upstreamStatus: res.status }, 502);
      }
      if (!res.ok) {
        return jsonResponse({ error: "eulerpool_upstream_error", upstreamStatus: res.status }, 502);
      }
      const data = await res.json();
      const rates = data?.rates ?? {};
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(rates)) {
        const n = safeNumber(v);
        if (n !== null) clean[k] = n;
      }
      snapshots[base] = clean;
    }

    const now = Date.now();
    const prices: Record<string, number> = {};
    const missing: string[] = [];
    for (const pair of wanted) {
      const { base, key, invert } = PAIRS[pair];
      const raw = snapshots[base]?.[key];
      if (raw == null) {
        missing.push(pair);
        continue;
      }
      prices[pair] = invert ? 1 / raw : raw;
    }

    return jsonResponse({
      prices,
      missing,
      timestamp: now,
      marketOpen: true,
      source: "eulerpool",
      testOnly: true,
      upstreamStatus,
      latencyMs: Date.now() - t0,
      // Free tier serves EOD/delayed snapshots; treat as delayed, not live.
      delayed: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg, prices: {}, testOnly: true }, 500);
  }
});
