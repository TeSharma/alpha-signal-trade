
import React, { useState } from 'react';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import TradingForm from "@/components/trading/TradingForm";
import MarketOverview from "@/components/trading/MarketOverview";
import MobileTradingInterface from "@/components/trading/MobileTradingInterface";
import TradeHistory from "@/components/trading/TradeHistory";
import AccountBalance from "@/components/trading/AccountBalance";
import { DeploymentGuide } from "@/components/trading/DeploymentGuide";
import V2PositionsPanel from "@/components/trading/V2PositionsPanel";
import OracleStatus from "@/components/trading/OracleStatus";
import TradingViewChart from "@/components/trading/TradingViewChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getNetworkName } from '@/config/contracts';

const CHART_PAIRS = ['BTC/USD', 'ETH/USD', 'POL/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY'];

const Trade = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const [chartPair, setChartPair] = useState<string>('BTC/USD');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader 
        accountMode={accountMode} 
        onAccountModeChange={setAccountMode}
      />
      
      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar accountMode={accountMode} />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Trade</h1>
                <p className="text-gray-600">
                  {accountMode === 'demo' 
                    ? 'Demo trading on Polygon Amoy — POL/USD powered by Chainlink oracle'
                    : `Live trading on ${getNetworkName('live')} — BTC, ETH, POL powered by Chainlink oracles`
                  }
                </p>
              </div>
              <Tabs defaultValue="trading" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="trading">Trading Interface</TabsTrigger>
                  <TabsTrigger value="deployment">Smart Contracts</TabsTrigger>
                </TabsList>
                
                <TabsContent value="trading" className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                      <AccountBalance 
                        accountMode={accountMode} 
                        onModeChange={setAccountMode} 
                      />
                      <TradingForm accountMode={accountMode} />
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                      {accountMode === 'live' && (
                        <div className="flex justify-end">
                          <OracleStatus accountMode={accountMode} />
                        </div>
                      )}
                      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold">Live Chart</h2>
                          <Select value={chartPair} onValueChange={setChartPair}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHART_PAIRS.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <TradingViewChart pair={chartPair} height={500} />
                      </div>
                      <MarketOverview accountMode={accountMode} />
                      {accountMode === 'live' && <V2PositionsPanel />}
                      <TradeHistory accountMode={accountMode} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="deployment" className="mt-6">
                  <DeploymentGuide />
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileTradingInterface accountMode={accountMode} />
      </div>
    </div>
  );
};

export default Trade;
