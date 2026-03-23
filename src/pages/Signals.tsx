import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, RefreshCw, Loader2, BarChart3, Signal, User } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import { useSignalList } from "@/hooks/useSignalList";
import { SignalAnalytics } from "@/components/signals/SignalAnalytics";
import { EnhancedSignalList } from "@/components/signals/EnhancedSignalList";

const Signals = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const { refreshSignals } = useSignalList();

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
              <SignalHeader onRefresh={handleRefresh} />
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

function SignalHeader({ onRefresh, compact }: { onRefresh: () => void; compact?: boolean }) {
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
        <Button size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh Signals
        </Button>
      </div>
    </div>
  );
}

export default Signals;