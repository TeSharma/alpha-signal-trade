// Position monitor: closes trades whose stop loss or take-profit-1 has been reached.
//
// Demo trades close atomically in the database via close_trade_system (idempotent).
// Live trades cannot be closed by anyone but their owner on the currently deployed
// TradingPlatformV2, so a live trigger is recorded as a pending exit plus a notification
// and the trade stays open until the user's wallet confirms the close.
// Trades with neither SL nor TP are never touched.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildLiquiditySnapshot,
  canSettleClose,
  worstCasePayout,
  type LiquiditySnapshot,
} from "../_shared/liquidity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CRYPTO_PAIRS = ["BTC/USD", "ETH/USD", "POL/USD"];

const BINANCE_SYMBOLS: Record<string, string> = {
  "BTC/USD": "BTCUSDT",
  "ETH/USD": "ETHUSDT",
  "POL/USD": "POLUSDT",
};

const FX_PAIRS: Record<string, { base: string; target: string }> = {
  "EUR/USD": { base: "EUR", target: "USD" },
  "GBP/USD": { base: "GBP", target: "USD" },
  "AUD/USD": { base: "AUD", target: "USD" },
  "USD/JPY": { base: "USD", target: "JPY" },
};

function isForexMarketOpen(date = new Date()): boolean {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  if (day === 6) return false;
  if (day === 0) return hour >= 22;
  if (day === 5) return hour < 22;
  return true;
}

async function fetchPrice(pair: string): Promise<number | null> {
  try {
    if (CRYPTO_PAIRS.includes(pair)) {
      const symbol = BINANCE_SYMBOLS[pair];
      if (!symbol) return null;
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      const price = parseFloat(data.price);
      return Number.isFinite(price) && price > 0 ? price : null;
    }

    if (pair === "XAU/USD") {
      const res = await fetch("https://api.gold-api.com/price/XAU");
      if (!res.ok) return null;
      const data = await res.json();
      const price = parseFloat(data.price);
      return Number.isFinite(price) && price > 0 ? price : null;
    }

    const fx = FX_PAIRS[pair];
    if (!fx) return null;
    const res = await fetch(`https://open.er-api.com/v6/latest/${fx.base}`);
    if (!res.ok) return null;
    const data = await res.json();
    const price = data.rates?.[fx.target];
    return typeof price === "number" && price > 0 ? price : null;
  } catch (e) {
    console.error(`[monitor-positions] price fetch failed for ${pair}:`, e);
    return null;
  }
}

/** Which trigger, if any, has been reached. Returns null when nothing triggered. */
function detectTrigger(
  direction: string,
  price: number,
  stopLoss: number | null,
  takeProfit: number | null,
): { kind: "stop_loss" | "take_profit"; exitPrice: number } | null {
  const isLong = ["buy", "long"].includes(String(direction).toLowerCase());

  if (isLong) {
    if (stopLoss != null && price <= stopLoss) {
      return { kind: "stop_loss", exitPrice: stopLoss };
    }
    if (takeProfit != null && price >= takeProfit) {
      return { kind: "take_profit", exitPrice: takeProfit };
    }
  } else {
    if (stopLoss != null && price >= stopLoss) {
      return { kind: "stop_loss", exitPrice: stopLoss };
    }
    if (takeProfit != null && price <= takeProfit) {
      return { kind: "take_profit", exitPrice: takeProfit };
    }
  }
  return null;
}

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: openTrades, error } = await supabase
      .from("trades")
      .select(
        "id, user_id, pair, direction, lot_size, stop_loss, take_profit, account_mode, pending_exit_kind",
      )
      .eq("status", "open");

    if (error) throw error;

    const summary = {
      checked: 0,
      skippedNoTrigger: 0,
      closedDemo: 0,
      livePendingExits: 0,
      priceUnavailable: 0,
      liquidityBlocked: 0,
      liquidityStatus: "n/a" as string,
    };

    if (!openTrades || openTrades.length === 0) {
      return new Response(JSON.stringify({ ...summary, message: "No open trades" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceCache: Record<string, number | null> = {};

    // Platform liquidity pre-flight — read once per run, only when live trades exist.
    let liquidity: LiquiditySnapshot | null = null;
    const hasLiveTrades = openTrades.some((t) => t.account_mode === "live");
    if (hasLiveTrades) {
      try {
        liquidity = await buildLiquiditySnapshot(supabase);
        summary.liquidityStatus = liquidity.status;
        console.log("[monitor-positions] liquidity", JSON.stringify(liquidity));
      } catch (e) {
        console.error("[monitor-positions] liquidity check failed:", e);
        summary.liquidityStatus = "UNKNOWN";
      }
    }

    for (const t of openTrades) {
      // Manual trades without SL and without TP stay open until closed by the user.
      if (t.stop_loss == null && t.take_profit == null) {
        summary.skippedNoTrigger++;
        continue;
      }

      if (!CRYPTO_PAIRS.includes(t.pair) && !isForexMarketOpen()) continue;

      summary.checked++;

      if (!(t.pair in priceCache)) {
        priceCache[t.pair] = await fetchPrice(t.pair);
      }
      const price = priceCache[t.pair];
      if (price == null) {
        summary.priceUnavailable++;
        continue;
      }

      const trigger = detectTrigger(t.direction, price, t.stop_loss, t.take_profit);
      if (!trigger) continue;

      if (t.account_mode === "demo") {
        const { data: result, error: closeErr } = await supabase.rpc(
          "close_trade_system",
          {
            p_trade_id: t.id,
            p_exit_price: trigger.exitPrice,
            p_reason: trigger.kind,
          },
        );
        if (closeErr) {
          console.error(`[monitor-positions] demo close failed for ${t.id}:`, closeErr);
          continue;
        }
        if ((result as { closed?: boolean } | null)?.closed) {
          summary.closedDemo++;
          await supabase.rpc("create_notification", {
            p_user_id: t.user_id,
            p_title: `${t.pair} ${trigger.kind === "stop_loss" ? "stop loss" : "take profit"} reached`,
            p_message: `Your demo ${t.pair} trade was closed automatically at ${trigger.exitPrice}.`,
            p_type: trigger.kind === "stop_loss" ? "warning" : "success",
          }).catch(() => undefined);
        }
        continue;
      }

      // ---- Live: record a pending exit; only the owner's wallet can close on-chain ----
      // The deployed TradingPlatformV2 restricts closePosition() to the position owner,
      // so nothing off-chain can settle a live position. We flag it and notify the user.
      if (t.pending_exit_kind) continue; // already flagged

      // Liquidity pre-flight: the keeper must never submit a close that is
      // guaranteed to revert because the platform cannot pay the settlement.
      // This gate runs before any closeWithTrigger submission is attempted.
      const requiredPayout = worstCasePayout(Number(t.lot_size ?? 0));
      const settleable =
        liquidity?.balance != null &&
        canSettleClose(liquidity.balance, requiredPayout, liquidity.buffer, trigger.kind);

      if (!settleable) {
        summary.liquidityBlocked++;
        console.warn(
          `[monitor-positions] liquidity gate blocked automatic close of ${t.id}: ` +
            `needs ${requiredPayout} USDC, platform balance ${liquidity?.balance ?? "unknown"}, ` +
            `buffer ${liquidity?.buffer ?? "unknown"} (${trigger.kind})`,
        );
        // Still flag the pending exit so the user can close from their own wallet,
        // but never submit an on-chain close while liquidity is insufficient.
      }

      const { error: flagErr } = await supabase
        .from("trades")
        .update({
          pending_exit_kind: trigger.kind,
          pending_exit_price: trigger.exitPrice,
          pending_exit_at: new Date().toISOString(),
        })
        .eq("id", t.id)
        .eq("status", "open");

      if (flagErr) {
        console.error(`[monitor-positions] could not flag live trade ${t.id}:`, flagErr);
        continue;
      }

      summary.livePendingExits++;
      await supabase.rpc("create_notification", {
        p_user_id: t.user_id,
        p_title: `${t.pair} ${trigger.kind === "stop_loss" ? "stop loss" : "take profit"} reached`,
        p_message: `Your live ${t.pair} position reached ${trigger.exitPrice}. Open Positions to close it from your wallet.`,
        p_type: trigger.kind === "stop_loss" ? "warning" : "success",
        p_action_url: "/trade",
      }).catch(() => undefined);
    }

    console.log("[monitor-positions]", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[monitor-positions] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
