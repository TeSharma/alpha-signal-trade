// Platform USDC liquidity model for Live (on-chain) settlement.
//
// Mirrors TradingPlatformV2 settlement: payout = margin + pnl, where pnl is capped
// at maxProfitBps (300%) of margin and floored at -margin, and a close fee of
// closeFeeBps is taken out of profit only. The largest amount the contract can
// ever pay for a single position is therefore margin * (1 + 300%) = margin * 4,
// less the close fee on that profit.
//
// Live trades store their USDC margin in trades.lot_size, so the worst-case
// payable exposure of an open live position is derived from that margin. This is a
// deliberate upper bound: we would rather hold too much USDC than submit a close
// transaction that reverts.

export const MAX_PROFIT_BPS = 30_000; // 300% profit cap
export const CLOSE_FEE_BPS = 8; // 0.08% on profit only
export const BPS_DENOMINATOR = 10_000;

/** Default minimum liquidity buffer, in USDC, kept free on top of open liability. */
export const DEFAULT_LIQUIDITY_BUFFER = 250;

export type LiquidityStatus = "SAFE" | "LOW" | "BLOCKED";

/** Largest amount the contract can pay out for a position with this net margin. */
export function worstCasePayout(margin: number): number {
  if (!Number.isFinite(margin) || margin <= 0) return 0;
  const maxProfit = (margin * MAX_PROFIT_BPS) / BPS_DENOMINATOR;
  const closeFee = (maxProfit * CLOSE_FEE_BPS) / BPS_DENOMINATOR;
  return margin + maxProfit - closeFee;
}

export function getLiquidityBuffer(): number {
  const raw = Deno.env.get("PLATFORM_LIQUIDITY_BUFFER_USDC");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LIQUIDITY_BUFFER;
}

export function classifyLiquidity(
  balance: number,
  liability: number,
  buffer: number,
): { status: LiquidityStatus; available: number } {
  const available = balance - liability;
  if (available < 0) return { status: "BLOCKED", available };
  if (available < buffer) return { status: "LOW", available };
  return { status: "SAFE", available };
}

/**
 * Can the contract settle a single close of this size right now?
 * Take profits additionally require the configured buffer to stay intact; stop
 * losses only need the payout itself to be covered so users are never trapped.
 */
export function canSettleClose(
  balance: number,
  payout: number,
  buffer: number,
  kind: "stop_loss" | "take_profit",
): boolean {
  if (!Number.isFinite(balance)) return false;
  return kind === "take_profit" ? balance >= payout + buffer : balance >= payout;
}

const USDC_DECIMALS = 6;

/** Read an ERC-20 balance with a plain eth_call — no web3 dependency needed. */
export async function readUsdcBalance(
  rpcUrls: string[],
  token: string,
  holder: string,
): Promise<number | null> {
  const data = "0x70a08231" + holder.toLowerCase().replace(/^0x/, "").padStart(64, "0");

  for (const url of rpcUrls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: token, data }, "latest"],
        }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.error || typeof json.result !== "string") continue;
      const raw = BigInt(json.result);
      return Number(raw) / 10 ** USDC_DECIMALS;
    } catch (_e) {
      continue;
    }
  }
  return null;
}

export const POLYGON_RPC_URLS = [
  Deno.env.get("VITE_ALCHEMY_POLYGON_RPC") ?? "",
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
  "https://1rpc.io/matic",
].filter(Boolean);

export const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

/**
 * Live platform address the keeper settles against. Overridable so the new
 * keeper-enabled deployment can be pointed at without a code change.
 */
export function getLivePlatformAddress(): string {
  return (
    Deno.env.get("TRADING_PLATFORM_V2_ADDRESS") ??
    "0x0465161D9aeD6e1C2F9E986Be97F5628E46421D3"
  );
}

export interface LiquiditySnapshot {
  platformAddress: string;
  balance: number | null;
  liability: number;
  available: number | null;
  buffer: number;
  status: LiquidityStatus | "UNKNOWN";
  openLivePositions: number;
  checkedAt: string;
}

/** Platform-wide snapshot: USDC on the platform vs worst-case payable exposure. */
export async function buildLiquiditySnapshot(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<LiquiditySnapshot> {
  const platformAddress = getLivePlatformAddress();
  const buffer = getLiquidityBuffer();

  const { data: liveTrades, error } = await supabase
    .from("trades")
    .select("id, lot_size")
    .eq("status", "open")
    .eq("account_mode", "live");

  if (error) throw error;

  const liability = (liveTrades ?? []).reduce(
    (sum: number, t: { lot_size: number | null }) =>
      sum + worstCasePayout(Number(t.lot_size ?? 0)),
    0,
  );

  const balance = await readUsdcBalance(POLYGON_RPC_URLS, POLYGON_USDC, platformAddress);

  if (balance == null) {
    return {
      platformAddress,
      balance: null,
      liability,
      available: null,
      buffer,
      status: "UNKNOWN",
      openLivePositions: liveTrades?.length ?? 0,
      checkedAt: new Date().toISOString(),
    };
  }

  const { status, available } = classifyLiquidity(balance, liability, buffer);

  return {
    platformAddress,
    balance,
    liability,
    available,
    buffer,
    status,
    openLivePositions: liveTrades?.length ?? 0,
    checkedAt: new Date().toISOString(),
  };
}
