import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Clock, Star, Check, X } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import CollapsibleCard from "@/components/ui/collapsible-card";

const Signals = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  const mockSignals = [
    {
      id: 1,
      pair: 'EUR/USD',
      direction: 'Buy',
      confidence: 85,
      trader: 'AI_Pro_Trader',
      entry: '1.0850',
      stopLoss: '1.0820',
      takeProfit: '1.0900',
      timeframe: '4H',
      timestamp: '5 min ago',
      notes: 'Strong bullish momentum'
    },
    {
      id: 2,
      pair: 'GBP/JPY',
      direction: 'Sell',
      confidence: 78,
      trader: 'ForexMaster',
      entry: '185.50',
      stopLoss: '186.00',
      takeProfit: '184.80',
      timeframe: '1H',
      timestamp: '15 min ago',
      notes: 'Resistance level reached'
    }
  ];

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
          <DesktopSignals mockSignals={mockSignals} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileSignals mockSignals={mockSignals} accountMode={accountMode} />
      </div>
    </div>
  );
};

const DesktopSignals = ({ mockSignals }: any) => (
  <main className="flex-1 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trading Signals</h1>
        <p className="text-gray-600">AI-powered trading signals from top traders</p>
      </div>

      <div className="grid gap-4">
        {mockSignals.map((signal) => (
          <Card key={signal.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">{signal.pair}</CardTitle>
                  <Badge variant={signal.direction === 'Buy' ? 'default' : 'destructive'}>
                    {signal.direction === 'Buy' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {signal.direction}
                  </Badge>
                  <Badge variant="outline">
                    <Star className="h-3 w-3 mr-1" />
                    {signal.confidence}% Confidence
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">by {signal.trader}</p>
                  <p className="text-xs text-gray-400 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {signal.timestamp}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Entry Price</p>
                  <p className="font-semibold">{signal.entry}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Stop Loss</p>
                  <p className="font-semibold text-red-500">{signal.stopLoss}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Take Profit</p>
                  <p className="font-semibold text-green-500">{signal.takeProfit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Timeframe</p>
                  <p className="font-semibold">{signal.timeframe}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1">
                  Approve Signal
                </Button>
                <Button variant="outline" className="flex-1">
                  Reject
                </Button>
                <Button variant="ghost">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </main>
);

const MobileSignals = ({ mockSignals, accountMode }: any) => (
  <main className="p-4 space-y-4">
    {/* Signal Tabs */}
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="all">All Signals</TabsTrigger>
        <TabsTrigger value="approved">My Approved</TabsTrigger>
        <TabsTrigger value="past">Past Signals</TabsTrigger>
      </TabsList>
      
      <TabsContent value="all" className="space-y-4 mt-4">
        {/* Signal Feed */}
        {mockSignals.map((signal: any) => (
          <Card key={signal.id} className="w-full">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{signal.pair}</CardTitle>
                    <Badge variant={signal.direction === 'Buy' ? 'default' : 'destructive'}>
                      {signal.direction === 'Buy' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {signal.direction}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      <Star className="h-3 w-3 mr-1" />
                      {signal.confidence}%
                    </Badge>
                    <p className="text-sm text-gray-600">by {signal.trader}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {signal.timestamp}
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Signal Details */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-gray-600">Entry</p>
                  <p className="font-semibold">{signal.entry}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600">Stop Loss</p>
                  <p className="font-semibold text-red-500">{signal.stopLoss}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600">Take Profit</p>
                  <p className="font-semibold text-green-500">{signal.takeProfit}</p>
                </div>
              </div>

              {/* Signal Notes */}
              {signal.notes && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-800">{signal.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-12 bg-green-500 hover:bg-green-600">
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button variant="outline" className="h-12">
                  <X className="h-4 w-4 mr-2" />
                  Ignore
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="approved" className="space-y-4 mt-4">
        <div className="text-center py-8">
          <p className="text-gray-500">No approved signals yet</p>
        </div>
      </TabsContent>

      <TabsContent value="past" className="space-y-4 mt-4">
        <div className="text-center py-8">
          <p className="text-gray-500">No past signals to show</p>
        </div>
      </TabsContent>
    </Tabs>

    {/* Risk Control Panel */}
    <CollapsibleCard title="Risk Control">
      <div className="space-y-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800 font-medium">Recommended Lot Size</p>
          <p className="text-lg font-bold text-yellow-900">
            0.1 lots (based on {accountMode} account)
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Account Balance</p>
            <p className="font-semibold">${accountMode === 'demo' ? '1,000.00' : '2,547.83'}</p>
          </div>
          <div>
            <p className="text-gray-600">Risk Per Trade</p>
            <p className="font-semibold">2%</p>
          </div>
        </div>
      </div>
    </CollapsibleCard>

    {/* Bottom padding for sticky elements */}
    <div className="h-4"></div>
  </main>
);

export default Signals;
