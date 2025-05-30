
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Clock, Star } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

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
      timestamp: '5 min ago'
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
      timestamp: '15 min ago'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <TopBar accountMode={accountMode} />
        
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
      </div>
    </div>
  );
};

export default Signals;
