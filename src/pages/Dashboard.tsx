
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import AccountBalance from "@/components/trading/AccountBalance";
import TradingForm from "@/components/trading/TradingForm";
import TradeHistory from "@/components/trading/TradeHistory";
import MarketOverview from "@/components/trading/MarketOverview";

const Dashboard = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trading Dashboard</h1>
            <p className="text-gray-600">Decentralized Forex Trading Platform</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={accountMode === 'demo' ? 'default' : 'secondary'}>
              {accountMode === 'demo' ? 'Demo Account' : 'Live Account'}
            </Badge>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Connected</span>
          </div>
        </div>

        {/* Account Balance */}
        <AccountBalance accountMode={accountMode} onModeChange={setAccountMode} />

        {/* Main Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trading Form */}
          <div className="lg:col-span-1">
            <TradingForm accountMode={accountMode} />
          </div>

          {/* Market Overview & Chart */}
          <div className="lg:col-span-2">
            <MarketOverview />
          </div>
        </div>

        {/* Trade History */}
        <TradeHistory accountMode={accountMode} />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Winning Trades</p>
                  <p className="text-xl font-bold text-green-500">12</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-gray-600">Losing Trades</p>
                  <p className="text-xl font-bold text-red-500">3</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total P&L</p>
                  <p className="text-xl font-bold text-green-500">+$247.50</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Win Rate</p>
                  <p className="text-xl font-bold text-purple-500">80%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
