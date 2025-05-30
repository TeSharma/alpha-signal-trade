
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";

interface TradeHistoryProps {
  accountMode: 'demo' | 'live';
}

const TradeHistory = ({ accountMode }: TradeHistoryProps) => {
  const trades = [
    {
      id: 1,
      pair: 'GBP/JPY',
      direction: 'buy',
      lotSize: 0.1,
      entryPrice: 187.85,
      exitPrice: 188.25,
      pnl: 40.0,
      status: 'closed',
      timestamp: '2024-01-15 14:30:00',
    },
    {
      id: 2,
      pair: 'EUR/USD',
      direction: 'sell',
      lotSize: 0.2,
      entryPrice: 1.0865,
      exitPrice: 1.0842,
      pnl: 46.0,
      status: 'closed',
      timestamp: '2024-01-15 13:15:00',
    },
    {
      id: 3,
      pair: 'USD/JPY',
      direction: 'buy',
      lotSize: 0.15,
      entryPrice: 149.50,
      exitPrice: null,
      pnl: 37.5,
      status: 'open',
      timestamp: '2024-01-15 15:45:00',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Trade History
          </CardTitle>
          <Badge variant="outline">
            {accountMode} account
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {trades.map((trade) => (
            <div key={trade.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    trade.direction === 'buy' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {trade.direction === 'buy' ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{trade.pair}</p>
                    <p className="text-sm text-gray-600">
                      {trade.direction.toUpperCase()} {trade.lotSize} lots
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </p>
                  <Badge variant={trade.status === 'open' ? 'default' : 'secondary'}>
                    {trade.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Entry Price</p>
                  <p className="font-medium">{trade.entryPrice}</p>
                </div>
                <div>
                  <p className="text-gray-600">Exit Price</p>
                  <p className="font-medium">
                    {trade.exitPrice ? trade.exitPrice : 'Current: 149.75'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Time</p>
                  <p className="font-medium">{trade.timestamp.split(' ')[1]}</p>
                </div>
                <div className="flex justify-end">
                  {trade.status === 'open' && (
                    <Button variant="outline" size="sm">
                      Close Trade
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {trades.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No trades yet. Start trading to see your history here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradeHistory;
