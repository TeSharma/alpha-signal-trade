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

interface ExecuteTradeDialogProps {
  signal: SignalObject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecuted?: () => void;
}

const RISK_PERCENT = 0.01; // 1% of balance suggested risk

export function ExecuteTradeDialog({ signal, open, onOpenChange, onExecuted }: ExecuteTradeDialogProps) {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(10000);
  const [lotSize, setLotSize] = useState<string>('');
  const [executing, setExecuting] = useState(false);

  const entryMid = useMemo(() => {
    if (!signal) return 0;
    return (signal.entry_zone[0] + signal.entry_zone[1]) / 2;
  }, [signal]);

  const stopDistance = useMemo(() => {
    if (!signal) return 0;
    return Math.abs(entryMid - signal.stop_loss);
  }, [signal, entryMid]);

  const multiplier = useMemo(() => (signal ? getAssetMultiplier(signal.pair) : 1), [signal]);

  // Suggested 1%-risk position size (units of base asset / standard lots)
  const suggestedSize = useMemo(() => {
    if (!signal || stopDistance <= 0 || multiplier <= 0) return 0;
    const riskAmount = balance * RISK_PERCENT;
    const size = riskAmount / (stopDistance * multiplier);
    // Cap so notional ≤ balance
    const maxByBalance = balance / Math.max(entryMid * multiplier, 0.0001);
    const capped = Math.min(size, maxByBalance, 999999.9999);
    return Math.max(0, Math.floor(capped * 10000) / 10000);
  }, [signal, stopDistance, balance, entryMid, multiplier]);

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
  const isLong = signal.direction === 'LONG';
  const invalid = lotNum <= 0 || lotNum > 999999.9999 || notional > balance;

  const handleConfirm = async () => {
    if (invalid) {
      toast({
        title: 'Invalid lot size',
        description: notional > balance
          ? `Notional ($${notional.toFixed(2)}) exceeds balance ($${balance.toFixed(2)}).`
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
      if (error) throw new Error(error.message || 'Execution failed');
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
      <DialogContent className="max-w-md">
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
              <p className="font-mono font-medium text-destructive">{signal.stop_loss}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Take Profit</p>
              <p className="font-mono font-medium text-green-500">
                {signal.take_profit.join(' / ')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Account Balance</p>
              <p className="font-mono font-medium">${balance.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Suggested (1% risk)</p>
              <p className="font-mono font-medium">{suggestedSize}</p>
            </div>
          </div>

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
              <span className="text-muted-foreground">Notional value:</span>
              <span className="font-mono">${notional.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Risk if SL hit:</span>
              <span className={`font-mono ${riskIfHit > balance * 0.05 ? 'text-destructive' : ''}`}>
                ${riskIfHit.toFixed(2)} ({balance > 0 ? ((riskIfHit / balance) * 100).toFixed(2) : '0'}%)
              </span>
            </div>
            {notional > balance && (
              <p className="text-xs text-destructive pt-1">
                ⚠ Notional exceeds account balance.
              </p>
            )}
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
