import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, RefreshCw, BarChart3, Signal, Filter } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import { useSignalList } from "@/hooks/useSignalList";
import { SignalAnalytics } from "@/components/signals/SignalAnalytics";
import { EnhancedSignalList } from "@/components/signals/EnhancedSignalList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAIR_FILTERS = [
  { value: "all", label: "All Pairs" },
  { value: "BTC/USD", label: "BTC/USD" },
  { value: "ETH/USD", label: "ETH/USD" },
  { value: "POL/USD", label: "POL/USD" },
  { value: "EUR/USD", label: "EUR/USD" },
  { value: "GBP/USD", label: "GBP/USD" },
  { value: "USD/JPY", label: "USD/JPY" },
];

const Signals = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const { refreshSignals, isRefreshing } = useSignalList();
  const [selectedPair, setSelectedPair] = useState("all");

  const handleRefresh = () => {
    console.info('[Signals] User refreshing signals');
    refreshSignals(true);
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
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                selectedPair={selectedPair}
                onPairChange={setSelectedPair}
              />
              <Tabs defaultValue="enhanced" className="w-full">
                <TabsList>
                  <TabsTrigger value="enhanced" className="flex items-center gap-2">
                    <Signal className="h-4 w-4" />
                    Enhanced Signals
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Performance
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="enhanced" className="mt-4">
                  <EnhancedSignalList defaultView="all" pairFilter={selectedPair !== "all" ? selectedPair : undefined} />
                </TabsContent>

                <TabsContent value="performance" className="mt-4">
                  <SignalAnalytics />
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      <div className="lg:hidden">
        <main className="p-4 space-y-4">
          <SignalHeader onRefresh={handleRefresh} isRefreshing={isRefreshing} compact selectedPair={selectedPair} onPairChange={setSelectedPair} />
          <Tabs defaultValue="enhanced" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>
            <TabsContent value="enhanced" className="space-y-4 mt-4">
              <EnhancedSignalList defaultView="all" pairFilter={selectedPair !== "all" ? selectedPair : undefined} />
            </TabsContent>
            <TabsContent value="performance" className="space-y-4 mt-4">
              <SignalAnalytics />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

function SignalHeader({ onRefresh, isRefreshing, compact, selectedPair, onPairChange }: {
  onRefresh: () => void;
  isRefreshing?: boolean;
  compact?: boolean;
  selectedPair: string;
  onPairChange: (value: string) => void;
}) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-2'}>
      {!compact && (
        <>
          <h1 className="text-3xl font-bold text-foreground">AI Trading Signals</h1>
          <p className="text-muted-foreground">Centralized AI-powered signals updated every 30 minutes</p>
        </>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          AI Intelligence Layer
        </Badge>
        <Select value={selectedPair} onValueChange={onPairChange}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Filter pair" />
          </SelectTrigger>
          <SelectContent>
            {PAIR_FILTERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Signals
        </Button>
      </div>
    </div>
  );
}

export default Signals;
