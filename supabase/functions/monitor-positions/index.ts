// Position monitor: closes trades whose stop loss or take-profit-1 has been reached.
//
// Demo trades close atomically in the database via close_trade_system (idempotent).
// Live trades are closed on-chain by calling closeWithTrigger() on TradingPlatformV2
// from an authorised keeper wallet; the database is only updated after the transaction
// is confirmed. Trades with neither SL nor TP are never touched.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.4";

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

// Polygon mainnet — live trading
const POLYGON_RPC_URLS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
  "https://1rpc.io/matic",
];
const TRADING_PLATFORM_V2 = "0x0465161D9aeD6e1C2F9E986Be97F5628E46421D3";
const PLATFORM_ABI = [
  "function closeWithTrigger(uint256 id) external",
  "function keepers(address) view returns (bool)",
  "function getPosition(uint256 id) view returns (tuple(address trader,bytes32 pairId,bool isLong,uint256 margin,uint256 leverage,uint256 notional,uint256 entryPrice,uint256 liquidationPrice,uint256 stopLoss,uint256 takeProfit,bool isOpen))",
];

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

async function getKeeperContract(): Promise<
  { contract: ethers.Contract; address: string } | null
> {
  const key = Deno.env.get("KEEPER_PRIVATE_KEY");
  if (!key) return null;

  for (const url of POLYGON_RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url, 137);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 137) continue;
      const wallet = new ethers.Wallet(key, provider);
      const contract = new ethers.Contract(
        TRADING_PLATFORM_V2,
        PLATFORM_ABI,
        wallet,
      );
      const authorised = await contract.keepers(wallet.address);
      if (!authorised) {
        console.warn(
          `[monitor-positions] keeper ${wallet.address} is not authorised on the platform contract`,
        );
        return null;
      }
      return { contract, address: wallet.address };
    } catch (e) {
      console.warn(`[monitor-positions] RPC ${url} unusable:`, e);
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
        "id, user_id, pair, direction, stop_loss, take_profit, account_mode, chain_position_id, close_tx_hash, close_requested_at",
      )
      .eq("status", "open");

    if (error) throw error;

    const summary = {
      checked: 0,
      skippedNoTrigger: 0,
      closedDemo: 0,
      closedLive: 0,
      liveFailed: 0,
      liveUnavailable: 0,
      priceUnavailable: 0,
    };

    if (!openTrades || openTrades.length === 0) {
      return new Response(JSON.stringify({ ...summary, message: "No open trades" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceCache: Record<string, number | null> = {};
    let keeper: { contract: ethers.Contract; address: string } | null = null;
    let keeperResolved = false;

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

      // ---- Live: close on-chain through the keeper, database follows confirmation ----
      if (t.chain_position_id == null) {
        console.warn(
          `[monitor-positions] live trade ${t.id} has no on-chain position id; cannot auto-close`,
        );
        summary.liveUnavailable++;
        continue;
      }

      // A close submitted in the last 5 minutes is still considered in flight.
      if (
        t.close_requested_at &&
        Date.now() - new Date(t.close_requested_at).getTime() < 5 * 60 * 1000
      ) {
        continue;
      }

      if (!keeperResolved) {
        keeper = await getKeeperContract();
        keeperResolved = true;
      }
      if (!keeper) {
        summary.liveUnavailable++;
        continue;
      }

      try {
        // Mark the attempt before sending so a crash cannot cause a double submission.
        await supabase
          .from("trades")
          .update({ close_requested_at: new Date().toISOString() })
          .eq("id", t.id)
          .eq("status", "open");

        const tx = await keeper.contract.closeWithTrigger(t.chain_position_id);
        const receipt = await tx.wait();

        if (!receipt || receipt.status !== 1) {
          console.error(
            `[monitor-positions] live close reverted for trade ${t.id} (tx ${tx.hash})`,
          );
          summary.liveFailed++;
          continue;
        }

        // Confirmed on-chain — now record it.
        const { data: result, error: closeErr } = await supabase.rpc(
          "close_trade_system",
          {
            p_trade_id: t.id,
            p_exit_price: trigger.exitPrice,
            p_reason: trigger.kind,
          },
        );
        if (closeErr) {
          console.error(
            `[monitor-positions] on-chain close confirmed but DB update failed for ${t.id}:`,
            closeErr,
          );
          summary.liveFailed++;
          continue;
        }

        await supabase.from("trades").update({ close_tx_hash: tx.hash }).eq("id", t.id);

        if ((result as { closed?: boolean } | null)?.closed) {
          summary.closedLive++;
          await supabase.rpc("create_notification", {
            p_user_id: t.user_id,
            p_title: `${t.pair} ${trigger.kind === "stop_loss" ? "stop loss" : "take profit"} executed`,
            p_message: `Your live ${t.pair} position was closed on-chain at ${trigger.exitPrice}.`,
            p_type: trigger.kind === "stop_loss" ? "warning" : "success",
          }).catch(() => undefined);
        }
      } catch (e) {
        // Leave the trade open; the next run retries.
        console.error(`[monitor-positions] live close failed for ${t.id}:`, e);
        summary.liveFailed++;
      }
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
