import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, RefreshCw, Loader2, BarChart3, Signal, User, Sparkles } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import { useSignalList } from "@/hooks/useSignalList";
import { SignalAnalytics } from "@/components/signals/SignalAnalytics";
import { EnhancedSignalList } from "@/components/signals/EnhancedSignalList";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AVAILABLE_PAIRS = [
  { value: "EUR/USD", label: "EUR/USD" },
  { value: "GBP/USD", label: "GBP/USD" },
  { value: "USD/JPY", label: "USD/JPY" },
  { value: "BTC/USD", label: "BTC/USD" },
  { value: "ETH/USD", label: "ETH/USD" },
];

const TIMEFRAMES = [
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "30m", label: "30 Minutes" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
];

const Signals = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const { refreshSignals, isRefreshing } = useSignalList();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleRefresh = () => {
    console.info('[Signals] User refreshing signals');
    refreshSignals(true);
  };

  const handleGenerateSignal = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-signal", {
        body: {
          pair: selectedPair,
          timeframe: selectedTimeframe
        }
      });

      if (error) throw error;

      if (data?.filtered) {
        toast({
          title: "Signal Filtered",
          description: data.message || "Signal confidence below threshold. Not published.",
          variant: "default",
        });
      } else {
        toast({
          title: "Signal Generated!",
          description: `New AI signal for ${selectedPair} has been created.`,
        });
        
        // Auto-refresh signals after successful generation
        refreshSignals(true);
        setIsDialogOpen(false);
      }
    } catch (err: any) {
      console.error('Error generating signal:', err);
      toast({
        title: "Error",
        description: err.message || "Failed to generate signal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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
                onRefresh={handleRefresh} 
                onGenerate={handleGenerateSignal}
                selectedPair={selectedPair}
                selectedTimeframe={selectedTimeframe}
                onPairChange={setSelectedPair}
                onTimeframeChange={setSelectedTimeframe}
                isGenerating={isGenerating}
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
                  <EnhancedSignalList defaultView="all" />
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
          <SignalHeader onRefresh={handleRefresh} compact />
          <Tabs defaultValue="enhanced" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="enhanced">Enhanced</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>
            <TabsContent value="enhanced" className="space-y-4 mt-4">
              <EnhancedSignalList defaultView="all" />
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

function SignalHeader({ onRefresh, compact, onGenerate, selectedPair, selectedTimeframe, onPairChange, onTimeframeChange, isGenerating }: { 
  onRefresh: () => void; 
  compact?: boolean; 
  onGenerate?: () => void;
  selectedPair?: string;
  selectedTimeframe?: string;
  onPairChange?: (value: string) => void;
  onTimeframeChange?: (value: string) => void;
  isGenerating?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-2'}>
      {!compact && (
        <>
          <h1 className="text-3xl font-bold text-foreground">AI Trading Signals</h1>
          <p className="text-muted-foreground">AI-powered signals with comprehensive trading dashboard and lifecycle management</p>
        </>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          AI Intelligence Layer
        </Badge>
        {onGenerate && (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                <Sparkles className="h-4 w-4" />
                Generate Signal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Generate AI Trading Signal</DialogTitle>
                <DialogDescription>
                  Select a trading pair and timeframe to generate an AI-powered trading signal.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="col-span-4 text-sm font-medium">Trading Pair</label>
                  <Select value={selectedPair} onValueChange={onPairChange}>
                    <SelectTrigger className="col-span-4">
                      <SelectValue placeholder="Select pair" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_PAIRS.map((pair) => (
                        <SelectItem key={pair.value} value={pair.value}>
                          {pair.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="col-span-4 text-sm font-medium">Timeframe</label>
                  <Select value={selectedTimeframe} onValueChange={onTimeframeChange}>
                    <SelectTrigger className="col-span-4">
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES.map((tf) => (
                        <SelectItem key={tf.value} value={tf.value}>
                          {tf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}} disabled={isGenerating}>Cancel</Button>
                <Button onClick={onGenerate} className="flex items-center gap-2" disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={isGenerating}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh Signals
        </Button>
      </div>
    </div>
  );
}

export default Signals;