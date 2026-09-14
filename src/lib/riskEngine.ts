/**
 * Shared risk math for the trading forms.
 * Mirrors the 1%-risk rule used by the AI signal execution dialog and
 * reuses the same asset multipliers as PnL math so UI and database agree.
 */

import { getAssetMultiplier } from '@/lib/pnl';

export const RISK_PERCENT = 0.01; // 1% of available capital per trade

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
    } else if (Math.abs(takeProfit - entryPrice) / entryPrice > 5) {
      takeProfitError = 'Take profit is unrealistically far from the entry price.';
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
