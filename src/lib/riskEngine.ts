/**
 * Shared risk math for the trading forms.
 * Mirrors the 1%-risk rule used by the AI signal execution dialog and
 * reuses the same asset multipliers as PnL math so UI and database agree.
 */

import { getAssetMultiplier } from '@/lib/pnl';

export const RISK_PERCENT = 0.01; // 1% of available capital per trade

/**
 * Leverage applied to demo / AI-signal executions.
 * Leverage NEVER changes the dollar loss at the stop — it only changes
 * how much of the balance is tied up as margin to hold the position.
 */
export const DEMO_LEVERAGE = 30;

/** Max lot size the trades.lot_size column can store (numeric(10,4)). */
export const MAX_LOT_SIZE = 999999.9999;

export interface SignalSizing {
  /** 1% of balance */
  riskAmount: number;
  /** |entry - stop| in price terms */
  stopDistance: number;
  /** lot size that risks exactly 1% at the stop */
  targetSize: number;
  /** lot size after margin / storage caps */
  size: number;
  /** true when caps forced a smaller size than the 1% target */
  capped: boolean;
  notional: number;
  marginRequired: number;
  /** actual dollar loss at the stop for `size` */
  riskAtStop: number;
  /** riskAtStop as a fraction of balance */
  riskPercentOfBalance: number;
  leverage: number;
  multiplier: number;
}

/**
 * Position sizing for a signal execution.
 * Size is derived from risk / (stop distance × multiplier); the balance limit
 * applies to REQUIRED MARGIN (notional ÷ leverage), not to notional itself.
 */
export function computeSignalSizing(params: {
  pair: string;
  entryPrice: number;
  stopLoss: number;
  balance: number;
  leverage?: number;
}): SignalSizing {
  const leverage = Math.max(1, params.leverage ?? DEMO_LEVERAGE);
  const multiplier = getAssetMultiplier(params.pair);
  const balance = Math.max(0, params.balance);
  const riskAmount = balance * RISK_PERCENT;
  const stopDistance =
    params.entryPrice && params.stopLoss ? Math.abs(params.entryPrice - params.stopLoss) : 0;

  const targetSize =
    stopDistance > 0 && multiplier > 0 ? riskAmount / (stopDistance * multiplier) : 0;

  // Margin cap: notional / leverage must fit inside the balance.
  const maxByMargin =
    params.entryPrice > 0 && multiplier > 0
      ? (balance * leverage) / (params.entryPrice * multiplier)
      : 0;

  let size = Math.min(targetSize, maxByMargin, MAX_LOT_SIZE);
  size = Math.max(0, Math.floor(size * 10000) / 10000);

  const notional = size * params.entryPrice * multiplier;
  const riskAtStop = size * stopDistance * multiplier;

  return {
    riskAmount,
    stopDistance,
    targetSize: Math.max(0, Math.floor(targetSize * 10000) / 10000),
    size,
    capped: targetSize > 0 && size < Math.floor(targetSize * 10000) / 10000 - 1e-9,
    notional,
    marginRequired: notional / leverage,
    riskAtStop,
    riskPercentOfBalance: balance > 0 ? riskAtStop / balance : 0,
    leverage,
    multiplier,
  };
}

/** Pip size for display: JPY pairs 0.01, other forex 0.0001, crypto/metals n/a. */
export function getPipSize(pair: string): number | null {
  const m = getAssetMultiplier(pair);
  if (m === 1 || m === 100) return null; // crypto & metals — quote in price terms
  return pair.includes('JPY') ? 0.01 : 0.0001;
}

export interface EnteredSizeValidation {
  /** Blocking reason, or null when the entered value is acceptable */
  error: string | null;
  /** Non-blocking note (e.g. risk cannot be verified without a stop loss) */
  warning: string | null;
  notional: number;
  requiredMargin: number;
  lossAtStop: number | null;
  riskAmount: number;
}

/**
 * Validate a size the user typed by hand with exactly the same rules the
 * suggested size is derived from: contract size, 1% risk at the stop, leverage
 * and available margin. Never adjusts the entered value — it only reports.
 *
 * `enteredSize` is a lot size in demo mode and a margin amount in live mode,
 * matching the trading form's input semantics.
 */
export function validateEnteredSize(params: {
  pair: string;
  entryPrice: number;
  stopLoss?: number | null;
  capital: number;
  leverage?: number;
  mode: 'demo' | 'live';
  enteredSize: number;
}): EnteredSizeValidation {
  const { pair, entryPrice, mode, enteredSize } = params;
  const leverage = Math.max(1, params.leverage ?? (mode === 'demo' ? DEMO_LEVERAGE : 1));
  const multiplier = getAssetMultiplier(pair);
  const capital = Math.max(0, params.capital);
  const riskAmount = capital * RISK_PERCENT;
  const stopLoss =
    params.stopLoss != null && Number.isFinite(params.stopLoss) ? params.stopLoss : null;
  const stopDistance = stopLoss != null && entryPrice ? Math.abs(entryPrice - stopLoss) : 0;

  const notional = mode === 'live' ? enteredSize * leverage : enteredSize * entryPrice * multiplier;
  const requiredMargin = mode === 'live' ? enteredSize : notional / leverage;
  const units =
    mode === 'live'
      ? entryPrice > 0 && multiplier > 0
        ? notional / (entryPrice * multiplier)
        : 0
      : enteredSize;
  const lossAtStop = stopDistance > 0 ? stopDistance * units * multiplier : null;

  const money = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  let error: string | null = null;
  let warning: string | null = null;

  if (!Number.isFinite(enteredSize) || enteredSize <= 0) {
    error = mode === 'live' ? 'Enter a margin amount greater than 0.' : 'Enter a lot size greater than 0.';
  } else if (mode === 'demo' && enteredSize > MAX_LOT_SIZE) {
    error = `Lot size cannot exceed ${MAX_LOT_SIZE}.`;
  } else if (!entryPrice) {
    warning = 'Waiting for a live price before this size can be checked.';
  } else if (capital <= 0) {
    error = 'No available trading capital for this account.';
  } else if (requiredMargin > capital + 1e-9) {
    error = `This size needs ${money(requiredMargin)} of margin at ${leverage}x but only ${money(
      capital,
    )} is available (position value ${money(notional)}).`;
  } else if (lossAtStop != null && lossAtStop > riskAmount * 1.0001) {
    error = `Loss at your stop would be ${money(lossAtStop)} — above the ${(
      RISK_PERCENT * 100
    ).toFixed(0)}% limit of ${money(riskAmount)}. Reduce the size or move the stop closer.`;
  } else if (lossAtStop == null) {
    warning = 'Without a stop loss the 1% risk limit cannot be verified for this size.';
  }

  return { error, warning, notional, requiredMargin, lossAtStop, riskAmount };
}

export interface RiskPlanInput {
  pair: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  capital: number;
  leverage?: number;
  mode: 'demo' | 'live';
}

export interface RiskPlan {
  /** 1% of available capital */
  riskAmount: number;
  /** |entry - stop loss| in price terms */
  stopDistance: number;
  /** Units of base asset / lots implied by the risk rule */
  positionSize: number;
  /** Notional value of that position size */
  notional: number;
  /** Margin needed for that notional at the chosen leverage */
  suggestedMargin: number;
  /** Loss if the stop loss is hit, for the size the user actually entered */
  potentialLoss: number | null;
  /** Profit if the take profit is hit, for the size the user actually entered */
  potentialProfit: number | null;
  /** Reward-to-risk ratio from the SL/TP levels */
  riskReward: number | null;
  hasStopLoss: boolean;
}

export interface StopValidation {
  stopLossError: string | null;
  takeProfitError: string | null;
  valid: boolean;
}

/** Validate SL/TP against direction and entry price. Empty values are allowed. */
export function validateStops(
  direction: 'buy' | 'sell',
  entryPrice: number,
  stopLoss?: number | null,
  takeProfit?: number | null,
  pair = '',
): StopValidation {
  let stopLossError: string | null = null;
  let takeProfitError: string | null = null;

  const isLong = direction === 'buy';

  if (stopLoss != null && Number.isFinite(stopLoss)) {
    if (stopLoss <= 0) {
      stopLossError = 'Stop loss must be greater than 0.';
    } else if (!entryPrice) {
      stopLossError = 'Waiting for a live price before the stop loss can be checked.';
    } else if (isLong && stopLoss >= entryPrice) {
      stopLossError = `For a BUY the stop loss must be below the entry price (${entryPrice}).`;
    } else if (!isLong && stopLoss <= entryPrice) {
      stopLossError = `For a SELL the stop loss must be above the entry price (${entryPrice}).`;
    } else if (Math.abs(entryPrice - stopLoss) / entryPrice > 0.5) {
      stopLossError = 'Stop loss is more than 50% away from the entry price.';
    }
  }

  if (takeProfit != null && Number.isFinite(takeProfit)) {
    if (takeProfit <= 0) {
      takeProfitError = 'Take profit must be greater than 0.';
    } else if (!entryPrice) {
      takeProfitError = 'Waiting for a live price before the take profit can be checked.';
    } else if (isLong && takeProfit <= entryPrice) {
      takeProfitError = `For a BUY the take profit must be above the entry price (${entryPrice}).`;
    } else if (!isLong && takeProfit >= entryPrice) {
      takeProfitError = `For a SELL the take profit must be below the entry price (${entryPrice}).`;
    } else {
      // Forex and metals never travel far from spot; crypto genuinely can.
      const maxAwayFraction = getAssetMultiplier(pair) === 1 ? 5 : 0.1;
      if (Math.abs(takeProfit - entryPrice) / entryPrice > maxAwayFraction) {
        takeProfitError = `Take profit is unrealistically far from the entry price (${entryPrice}).`;
      }
    }
  }

  return { stopLossError, takeProfitError, valid: !stopLossError && !takeProfitError };
}

/**
 * Compute the 1%-risk plan.
 * @param enteredSize position size (demo lots) or notional-bearing margin (live)
 */
export function computeRiskPlan(input: RiskPlanInput, enteredSize?: number): RiskPlan {
  const { pair, direction, entryPrice, capital } = input;
  const leverage = Math.max(1, input.leverage ?? 1);
  const multiplier = getAssetMultiplier(pair);
  const stopLoss = input.stopLoss != null && Number.isFinite(input.stopLoss) ? input.stopLoss : null;
  const takeProfit = input.takeProfit != null && Number.isFinite(input.takeProfit) ? input.takeProfit : null;

  const riskAmount = Math.max(0, capital) * RISK_PERCENT;
  const stopDistance = stopLoss != null && entryPrice ? Math.abs(entryPrice - stopLoss) : 0;

  const positionSize =
    stopDistance > 0 && multiplier > 0 ? riskAmount / (stopDistance * multiplier) : 0;
  const notional = positionSize * entryPrice * multiplier;
  const suggestedMargin = notional / leverage;

  // Loss / profit for the size the user actually entered
  let potentialLoss: number | null = null;
  let potentialProfit: number | null = null;

  if (enteredSize != null && enteredSize > 0 && entryPrice) {
    // Live: the entered value is margin, so notional = margin × leverage.
    // Demo: the entered value is already a lot size.
    const units =
      input.mode === 'live'
        ? (enteredSize * leverage) / (entryPrice * multiplier)
        : enteredSize;

    if (stopDistance > 0) potentialLoss = stopDistance * units * multiplier;
    if (takeProfit != null) potentialProfit = Math.abs(takeProfit - entryPrice) * units * multiplier;
  }

  const riskReward =
    stopDistance > 0 && takeProfit != null && entryPrice
      ? Math.abs(takeProfit - entryPrice) / stopDistance
      : null;

  return {
    riskAmount,
    stopDistance,
    positionSize,
    notional,
    suggestedMargin,
    potentialLoss,
    potentialProfit,
    riskReward,
    hasStopLoss: stopLoss != null,
  };
}
