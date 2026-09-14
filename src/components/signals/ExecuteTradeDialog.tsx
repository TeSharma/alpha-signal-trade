import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { SignalObject } from '@/types/signal';
import { getAssetMultiplier } from '@/lib/pnl';
import {
  computeSignalSizing,
  getPipSize,
  validateEnteredSize,
  DEMO_LEVERAGE,
  RISK_PERCENT,
} from '@/lib/riskEngine';

interface ExecuteTradeDialogProps {
  signal: SignalObject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecuted?: () => void;
}

export function ExecuteTradeDialog({ signal, open, onOpenChange, onExecuted }: ExecuteTradeDialogProps) {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(10000);
  const [lotSize, setLotSize] = useState<string>('');
  const [executing, setExecuting] = useState(false);

  const entryMid = useMemo(() => {
    if (!signal) return 0;
    return (signal.entry_zone[0] + signal.entry_zone[1]) / 2;
  }, [signal]);

  const multiplier = useMemo(() => (signal ? getAssetMultiplier(signal.pair) : 1), [signal]);

  // 1%-risk sizing. Leverage affects required margin only, never the loss at the stop.
  const sizing = useMemo(
    () =>
      computeSignalSizing({
        pair: signal?.pair ?? '',
        entryPrice: entryMid,
        stopLoss: signal?.stop_loss ?? 0,
        balance,
        leverage: DEMO_LEVERAGE,
      }),
    [signal, entryMid, balance],
  );

  const stopDistance = sizing.stopDistance;
  const suggestedSize = sizing.size;
  const pipSize = signal ? getPipSize(signal.pair) : null;
  const stopPips = pipSize ? stopDistance / pipSize : null;

  // Load balance + reset lot size when opening
  useEffect(() => {
    if (!open || !signal) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('account_balances')
        .select('demo_balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.demo_balance != null) setBalance(Number(data.demo_balance));
    })();
  }, [open, signal]);

  useEffect(() => {
    if (open && suggestedSize > 0) {
      setLotSize(suggestedSize.toString());
    }
  }, [open, suggestedSize]);

  if (!signal) return null;

  const lotNum = parseFloat(lotSize) || 0;
  const riskIfHit = lotNum * stopDistance * multiplier;
  const notional = lotNum * entryMid * multiplier;
  const marginRequired = notional / DEMO_LEVERAGE;
  const isLong = signal.direction === 'LONG';
  const takeProfits = Array.isArray(signal.take_profit) ? signal.take_profit : [signal.take_profit];
  const tp1 = Number(takeProfits[0]);
  const riskReward =
    stopDistance > 0 && Number.isFinite(tp1) ? Math.abs(tp1 - entryMid) / stopDistance : null;
  const invalid = lotNum <= 0 || lotNum > 999999.9999 || marginRequired > balance;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleConfirm = async () => {
    if (invalid) {
      toast({
        title: 'Invalid lot size',
        description: marginRequired > balance
          ? `Required margin ($${fmt(marginRequired)}) exceeds balance ($${fmt(balance)}).`
          : 'Lot size must be greater than 0.',
        variant: 'destructive',
      });
      return;
    }
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke('execute-trade', {
        body: {
          signal_id: signal.id,
          account_mode: 'demo',
          position_size_override: lotNum,
        },
      });
      if (error) {
        // Surface the server's actual rejection reason instead of a generic message
        let serverMessage = '';
        const ctx = (error as any)?.context;
        if (ctx instanceof Response) {
          try {
            const body = await ctx.clone().json();
            serverMessage = body?.error || body?.message || '';
          } catch {
            serverMessage = await ctx.clone().text().catch(() => '');
          }
        }
        throw new Error(serverMessage || error.message || 'Execution failed');
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Trade Executed',
        description: `${signal.direction} ${signal.pair} — ${lotNum} @ $${data.entry_price?.toFixed?.(4) ?? data.entry_price}`,
      });
      onOpenChange(false);
      onExecuted?.();
    } catch (err: any) {
      toast({
        title: 'Execution Failed',
        description: err?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Confirm Trade
            <Badge variant={isLong ? 'default' : 'destructive'}>
              {isLong ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {signal.direction} {signal.pair}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review and confirm the lot size before placing the trade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Entry Zone</p>
              <p className="font-mono font-medium">
                {signal.entry_zone[0]} – {signal.entry_zone[1]}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Entry (mid)</p>
              <p className="font-mono font-medium">{entryMid.toFixed(5)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Stop Loss</p>
              <p className="font-mono font-medium text-destructive">
                {signal.stop_loss}
                {stopPips != null && (
                  <span className="text-muted-foreground"> ({stopPips.toFixed(1)} pips)</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Take Profit</p>
              <p className="font-mono font-medium text-green-600">
                {Number.isFinite(tp1) ? tp1 : '—'}
                <span className="text-muted-foreground"> (TP1)</span>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Account Balance</p>
              <p className="font-mono font-medium">${fmt(balance)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Suggested ({(RISK_PERCENT * 100).toFixed(0)}% risk)</p>
              <p className="font-mono font-medium">{suggestedSize}</p>
            </div>
          </div>

          {takeProfits.length > 1 && (
            <p className="text-xs text-muted-foreground bg-muted rounded-md p-2">
              This signal lists {takeProfits.length} targets ({takeProfits.map((tp) => tp).join(' / ')}).
              Only <strong>TP1</strong> is attached to the trade and executed; TP2 and TP3 are guidance
              for manual management.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="lot-size">Lot Size</Label>
            <Input
              id="lot-size"
              type="number"
              step="0.0001"
              min="0"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder="Enter lot size"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLotSize(suggestedSize.toString())}
              >
                Use suggested
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLotSize((suggestedSize / 2).toFixed(4))}
              >
                ½ suggested
              </Button>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target risk (1% of balance):</span>
              <span className="font-mono">${fmt(sizing.riskAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stop distance:</span>
              <span className="font-mono">
                {stopDistance.toFixed(5)}
                {stopPips != null ? ` (${stopPips.toFixed(1)} pips)` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position value (notional):</span>
              <span className="font-mono">${fmt(notional)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margin required ({DEMO_LEVERAGE}x):</span>
              <span className="font-mono">${fmt(marginRequired)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loss if SL hit:</span>
              <span className={`font-mono ${riskIfHit > sizing.riskAmount * 1.01 ? 'text-destructive' : ''}`}>
                ${fmt(riskIfHit)} ({balance > 0 ? ((riskIfHit / balance) * 100).toFixed(2) : '0'}%)
              </span>
            </div>
            {riskReward != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk : Reward (TP1):</span>
                <span className="font-mono">1 : {riskReward.toFixed(2)}</span>
              </div>
            )}
            {sizing.capped && (
              <p className="text-xs text-amber-600 pt-1">
                Margin limits cap the size at {sizing.size} lots, so the risk at the stop is
                ${fmt(sizing.riskAtStop)} ({(sizing.riskPercentOfBalance * 100).toFixed(2)}%) instead of
                the full 1% target.
              </p>
            )}
            {marginRequired > balance && (
              <p className="text-xs text-destructive pt-1">
                ⚠ Required margin exceeds your balance.
              </p>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Leverage changes only the margin needed to hold this position — never the dollar loss at
              your stop.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={executing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={executing || invalid}>
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              'Confirm & Execute'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
