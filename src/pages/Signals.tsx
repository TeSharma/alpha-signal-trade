import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Clock, Star, Brain, RefreshCw, Loader2, Shield, Target, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import CollapsibleCard from "@/components/ui/collapsible-card";
import { useSignals } from "@/hooks/useSignals";
import type { SignalObject } from "@/types/signal";
import { useNavigate } from "react-router-dom";

const ALL_PAIRS = ['BTC/USD', 'ETH/USD', 'POL/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY'];
const TIMEFRAMES = ['5m', '15m', '1h', '4h'];

const Signals = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const [selectedPair, setSelectedPair] = useState('BTC/USD');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const { signals, isLoading, isGenerating, generateSignal } = useSignals();
  const navigate = useNavigate();

  const handleGenerate = () => generateSignal(selectedPair, selectedTimeframe);

  const handleApprove = (signal: SignalObject) => {
    if (signal.execution.type === 'ON_CHAIN') {
      navigate('/trade', { state: { prefill: signal } });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader accountMode={accountMode} onAccountModeChange={setAccountMode} />
      <div className="hidden lg:flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar accountMode={accountMode} />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <SignalHeader
                selectedPair={selectedPair}
                setSelectedPair={setSelectedPair}
                selectedTimeframe={selectedTimeframe}
                setSelectedTimeframe={setSelectedTimeframe}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
              <SignalList signals={signals} isLoading={isLoading} onApprove={handleApprove} />
            </div>
          </main>
        </div>
      </div>
      <div className="lg:hidden">
        <main className="p-4 space-y-4">
          <SignalHeader
            selectedPair={selectedPair}
            setSelectedPair={setSelectedPair}
            selectedTimeframe={selectedTimeframe}
            setSelectedTimeframe={setSelectedTimeframe}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            compact
          />
          <MobileSignalTabs signals={signals} isLoading={isLoading} onApprove={handleApprove} accountMode={accountMode} />
        </main>
      </div>
    </div>
  );
};

// --- Sub-components ---

function SignalHeader({ selectedPair, setSelectedPair, selectedTimeframe, setSelectedTimeframe, onGenerate, isGenerating, compact }: any) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-2'}>
      {!compact && (
        <>
          <h1 className="text-3xl font-bold text-foreground">AI Trading Signals</h1>
          <p className="text-muted-foreground">AI-powered signals with 5-engine analysis</p>
        </>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          AI Intelligence Layer
        </Badge>
        <Select value={selectedPair} onValueChange={setSelectedPair}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_PAIRS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
          <SelectTrigger className="w-[80px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Generate Signal
        </Button>
      </div>
    </div>
  );
}

function SignalList({ signals, isLoading, onApprove }: { signals: SignalObject[]; isLoading: boolean; onApprove: (s: SignalObject) => void }) {
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading signals...</div>;
  if (!signals.length) return (
    <div className="text-center py-12 text-muted-foreground">
      <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p>No active signals. Generate one above.</p>
    </div>
  );
  return (
    <div className="grid gap-4">
      {signals.map(signal => <SignalCard key={signal.id} signal={signal} onApprove={onApprove} />)}
    </div>
  );
}

function SignalCard({ signal, onApprove }: { signal: SignalObject; onApprove: (s: SignalObject) => void }) {
  const isLong = signal.direction === 'LONG';
  const confidencePct = signal.confidence <= 1 ? (signal.confidence * 100).toFixed(0) : signal.confidence.toFixed(0);
  const highConf = parseFloat(confidencePct) >= 70;
  const timeAgo = signal.created_at ? getTimeAgo(signal.created_at) : '';

  return (
    <Card>
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
            <Button className="flex-1" onClick={() => onApprove(signal)}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Execute On-Chain
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

function MobileSignalTabs({ signals, isLoading, onApprove, accountMode }: any) {
  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="all">All Signals</TabsTrigger>
        <TabsTrigger value="crypto">Crypto Only</TabsTrigger>
      </TabsList>
      <TabsContent value="all" className="space-y-4 mt-4">
        <SignalList signals={signals} isLoading={isLoading} onApprove={onApprove} />
      </TabsContent>
      <TabsContent value="crypto" className="space-y-4 mt-4">
        <SignalList signals={signals.filter((s: SignalObject) => s.market === 'CRYPTO')} isLoading={isLoading} onApprove={onApprove} />
      </TabsContent>
    </Tabs>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default Signals;
