
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Activity, Plus, RefreshCw } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import AccountBalance from "@/components/trading/AccountBalance";

const Dashboard = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  const recentTrades = [
    { id: 1, pair: 'EUR/USD', type: 'Buy', amount: '0.1', result: '+$25.50', status: 'Closed', time: '2 hours ago' },
    { id: 2, pair: 'GBP/JPY', type: 'Sell', amount: '0.05', result: '-$12.30', status: 'Closed', time: '4 hours ago' },
    { id: 3, pair: 'USD/CHF', type: 'Buy', amount: '0.2', result: '+$45.20', status: 'Open', time: '1 day ago' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <TopBar accountMode={accountMode} />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Trading Dashboard</h1>
                <p className="text-gray-600">Overview of your trading activity and performance</p>
              </div>
              <div className="flex gap-2">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Trade
                </Button>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Account Summary */}
            <AccountBalance accountMode={accountMode} onModeChange={setAccountMode} />

            {/* Quick Stats Grid */}
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

            {/* Recent Trades */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Trades</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTrades.map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold">{trade.pair}</div>
                        <Badge variant={trade.type === 'Buy' ? 'default' : 'secondary'}>
                          {trade.type}
                        </Badge>
                        <span className="text-sm text-gray-600">{trade.amount} lots</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${trade.result.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.result}
                        </span>
                        <Badge variant={trade.status === 'Open' ? 'outline' : 'secondary'}>
                          {trade.status}
                        </Badge>
                        <span className="text-sm text-gray-500">{trade.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* News/Updates Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Latest Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="font-semibold text-blue-800">New Signal Algorithm Released</p>
                    <p className="text-sm text-blue-600">Our AI signals now include sentiment analysis for better accuracy.</p>
                  </div>
                  <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded">
                    <p className="font-semibold text-green-800">Educational Content Updated</p>
                    <p className="text-sm text-green-600">New forex fundamentals course now available in the Education section.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
