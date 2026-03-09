import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, Star, Shield, Target, ArrowRight, AlertTriangle, Loader2 } from "lucide-react";
import type { SignalObject } from "@/types/signal";
import { isExpired } from "@/types/signal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface SignalCardProps {
  signal: SignalObject;
  onApprove: (s: SignalObject) => void;
}

export function SignalCard({ signal, onApprove }: SignalCardProps) {
  const isLong = signal.direction === 'LONG';
  const confidencePct = signal.confidence <= 1 ? (signal.confidence * 100).toFixed(0) : signal.confidence.toFixed(0);
  const highConf = parseFloat(confidencePct) >= 70;
  const timeAgo = signal.created_at ? getTimeAgo(signal.created_at) : '';
  const expired = isExpired(signal);

  return (
    <Card className={expired ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-xl">{signal.pair}</CardTitle>
            <Badge variant={isLong ? 'default' : 'destructive'}>
              {isLong ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {signal.direction}
            </Badge>
            <Badge variant={highConf ? 'default' : 'secondary'} className={highConf ? 'bg-green-600' : ''}>
              <Star className="h-3 w-3 mr-1" />
              {confidencePct}%
            </Badge>
            <Badge variant="outline">{signal.market}</Badge>
            <Badge variant="outline">{signal.timeframe}</Badge>
            {expired && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Expired
              </Badge>
            )}
            {signal.status === 'closed' && (
              <Badge variant={signal.signal_strength !== undefined && signal.signal_strength > 0 ? 'default' : 'destructive'}
                className={signal.signal_strength !== undefined && signal.signal_strength > 0 ? 'bg-green-600' : ''}>
                {signal.signal_strength !== undefined && signal.signal_strength > 0 ? '✓ Win' : '✗ Loss'}
              </Badge>
            )}
            {signal.status === 'executed' && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                In Progress
              </Badge>
            )}
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{signal.strategy}</p>
            {timeAgo && <p className="text-xs flex items-center justify-end"><Clock className="h-3 w-3 mr-1" />{timeAgo}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Entry Zone</p>
            <p className="font-semibold font-mono">{signal.entry_zone[0]} – {signal.entry_zone[1]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Stop Loss</p>
            <p className="font-semibold font-mono text-red-500">{signal.stop_loss}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Take Profit</p>
            <p className="font-semibold font-mono text-green-500">{signal.take_profit.join(' / ')}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Risk</p>
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3" />
              <span className="font-semibold">{signal.risk.rr.toFixed(1)}R</span>
              <Badge variant="outline" className="text-xs">{signal.risk.risk_level}</Badge>
            </div>
          </div>
        </div>

        {signal.explanation.length > 0 && (
          <div className="bg-muted rounded-lg p-3 space-y-1">
            {signal.explanation.map((e, i) => (
              <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <Target className="h-3 w-3 mt-0.5 shrink-0" />
                {e}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {signal.execution.type === 'ON_CHAIN' ? (
            <Button className="flex-1" onClick={() => onApprove(signal)} disabled={expired}>
              <ArrowRight className="h-4 w-4 mr-2" />
              {expired ? 'Signal Expired' : 'Execute On-Chain'}
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1" disabled>
              Manual Execution (Copy Parameters)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
