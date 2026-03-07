export interface SignalObject {
  id: string;
  market: 'FOREX' | 'CRYPTO';
  pair: string;
  direction: 'LONG' | 'SHORT';
  entry_zone: [number, number];
  stop_loss: number;
  take_profit: number[];
  timeframe: string;
  strategy: string;
  confidence: number;
  risk: {
    rr: number;
    risk_level: 'LOW' | 'MODERATE' | 'HIGH';
  };
  execution: {
    type: 'ON_CHAIN' | 'MANUAL';
    supported: boolean;
  };
  explanation: string[];
  expires_at: number;
  created_at?: string;
  user_id?: string;
  status?: 'active' | 'expired' | 'executed' | 'closed';
  model_version?: string;
  signal_strength?: number;
}

/** Check if a signal has expired */
export function isExpired(signal: SignalObject): boolean {
  if (!signal.expires_at || signal.expires_at <= 0) return false;
  return signal.expires_at < Date.now() / 1000;
}

/** Check if a price is within the signal's entry zone */
export function isPriceInZone(signal: SignalObject, currentPrice: number): boolean {
  if (!signal.entry_zone || signal.entry_zone.length < 2) return false;
  const [low, high] = signal.entry_zone;
  return currentPrice >= low && currentPrice <= high;
}
