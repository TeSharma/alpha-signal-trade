import React, { useState, forwardRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, RefreshCw, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import { useSignals } from "@/hooks/useSignals";
import type { SignalObject } from "@/types/signal";
import { SignalCard } from "@/components/signals/SignalCard";
import { useNavigate } from "react-router-dom";

const ALL_PAIRS = ['BTC/USD', 'ETH/USD', 'POL/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY'];
const TIMEFRAMES = ['5m', '15m', '1h', '4h'];

const Signals = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const [selectedPair, setSelectedPair] = useState('BTC/USD');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const { signals, isLoading, isGenerating, generateSignal } = useSignals();
  const navigate = useNavigate();

  const handleGenerate = () => {
    console.info('[Signals] User requested signal for %s @ %s', selectedPair, selectedTimeframe);
    generateSignal(selectedPair, selectedTimeframe);
  };

  const handleApprove = (signal: SignalObject) => {
    console.info('[Signals] User executing signal %s — %s %s', signal.id, signal.direction, signal.pair);
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
          <MobileSignalTabs signals={signals} isLoading={isLoading} onApprove={handleApprove} />
        </main>
      </div>
    </div>
  );
};

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

// Use forwardRef to prevent Radix ref warnings
const SignalList = forwardRef<HTMLDivElement, { signals: SignalObject[]; isLoading: boolean; onApprove: (s: SignalObject) => void }>(
  function SignalList({ signals, isLoading, onApprove }, ref) {
    if (isLoading) return <div ref={ref} className="text-center py-12 text-muted-foreground">Loading signals...</div>;
    if (!signals.length) return (
      <div ref={ref} className="text-center py-12 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No active signals. Generate one above.</p>
      </div>
    );
    return (
      <div ref={ref} className="grid gap-4">
        {signals.map(signal => <SignalCard key={signal.id} signal={signal} onApprove={onApprove} />)}
      </div>
    );
  }
);

const MobileSignalTabs = forwardRef<HTMLDivElement, { signals: SignalObject[]; isLoading: boolean; onApprove: (s: SignalObject) => void }>(
  function MobileSignalTabs({ signals, isLoading, onApprove }, ref) {
    return (
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Signals</TabsTrigger>
          <TabsTrigger value="crypto">Crypto Only</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4 mt-4">
          <SignalList ref={ref} signals={signals} isLoading={isLoading} onApprove={onApprove} />
        </TabsContent>
        <TabsContent value="crypto" className="space-y-4 mt-4">
          <SignalList signals={signals.filter((s: SignalObject) => s.market === 'CRYPTO')} isLoading={isLoading} onApprove={onApprove} />
        </TabsContent>
      </Tabs>
    );
  }
);

export default Signals;
