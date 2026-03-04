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
  status?: 'active' | 'expired' | 'executed';
}
