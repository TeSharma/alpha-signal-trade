import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, HelpCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { usePlatformLiquidity, type LiquidityStatus } from '@/hooks/usePlatformLiquidity';

const usd = (value: number | null) =>
  value == null
    ? '—'
    : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const statusMeta: Record<LiquidityStatus, { label: string; icon: React.ReactNode; className: string; note: string }> = {
  SAFE: {
    label: 'SAFE',
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    className: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
    note: 'Settlement liquidity covers all open positions plus the safety buffer.',
  },
  LOW: {
    label: 'LOW',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
    className: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20',
    note: 'Liquidity is above open exposure but below the safety buffer. Top up before opening more live positions.',
  },
  BLOCKED: {
    label: 'BLOCKED',
    icon: <ShieldAlert className="h-4 w-4 text-destructive" />,
    className: 'border-destructive/40 bg-destructive/5',
    note: 'Automatic take-profit closing is paused: the platform cannot cover open exposure. Positions can still be closed from your wallet.',
  },
  UNKNOWN: {
    label: 'UNKNOWN',
    icon: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
    className: 'border-border bg-muted/40',
    note: 'The platform balance could not be read. Automatic closing stays paused until it can.',
  },
};

interface Props {
  accountMode: 'demo' | 'live';
}

const PlatformLiquidityStatus = ({ accountMode }: Props) => {
  const isLive = accountMode === 'live';
  const { data, loading, error, refresh } = usePlatformLiquidity(isLive);

  if (!isLive) return null;

  const meta = statusMeta[data?.status ?? 'UNKNOWN'];

  return (
    <Card className={meta.className}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          {meta.icon}
          Platform settlement liquidity
          <Badge variant="outline" className="text-xs">{meta.label}</Badge>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh liquidity">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {loading && !data && <p className="text-muted-foreground">Reading platform balance…</p>}

        {error && !data && (
          <div className="space-y-2">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform USDC balance</span>
              <span className="font-mono">{usd(data.balance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated take-profit liability</span>
              <span className="font-mono">{usd(data.liability)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Available after liability</span>
              <span className="font-mono">{usd(data.available)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Minimum buffer</span>
              <span className="font-mono">{usd(data.buffer)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Open live positions</span>
              <span>{data.openLivePositions}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">{meta.note}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PlatformLiquidityStatus;
