
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

const MarketOverview = () => {
  const marketData = [
    { pair: 'GBP/JPY', price: '188.25', change: '+0.45%', changeValue: '+0.84', volume: '2.1B' },
    { pair: 'EUR/USD', price: '1.0842', change: '-0.12%', changeValue: '-0.0013', volume: '4.2B' },
    { pair: 'USD/JPY', price: '149.75', change: '+0.23%', changeValue: '+0.34', volume: '3.8B' },
    { pair: 'GBP/USD', price: '1.2567', change: '+0.18%', changeValue: '+0.0023', volume: '2.9B' },
    { pair: 'AUD/USD', price: '0.6745', change: '-0.08%', changeValue: '-0.0005', volume: '1.5B' },
    { pair: 'USD/CAD', price: '1.3412', change: '+0.15%', changeValue: '+0.0020', volume: '1.8B' },
  ];

  return (
    <div className="space-y-6">
      {/* TradingView Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Live Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-lg p-8 text-center h-96 flex items-center justify-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto flex items-center justify-center">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">TradingView Integration</h3>
                <p className="text-gray-600">Professional charts and analysis tools</p>
                <p className="text-sm text-gray-500 mt-2">
                  This will be replaced with TradingView widget in Phase 1
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {marketData.map((item) => (
              <div key={item.pair} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    item.change.startsWith('+') ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {item.change.startsWith('+') ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{item.pair}</p>
                    <p className="text-sm text-gray-600">Vol: {item.volume}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{item.price}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.change.startsWith('+') ? 'default' : 'destructive'}>
                      {item.change}
                    </Badge>
                    <span className={`text-sm ${
                      item.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {item.changeValue}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketOverview;
