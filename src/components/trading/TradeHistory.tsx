
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { useTrades } from '@/hooks/useTrades';
import { format } from 'date-fns';

interface TradeHistoryProps {
  accountMode: 'demo' | 'live';
}

const TradeHistory = ({ accountMode }: TradeHistoryProps) => {
  const { trades, closeTrade, loading } = useTrades();
  
  const filteredTrades = trades.filter(trade => trade.account_mode === accountMode);

  const handleCloseTrade = async (tradeId: string) => {
    // Use a mock current price for demo - in real app, get from market data
    const mockCurrentPrice = 188.50;
    await closeTrade(tradeId, mockCurrentPrice);
  };

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
        {loading ? (
          <div className="text-center py-8">
            <p>Loading trades...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrades.map((trade) => (
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
                        {trade.direction.toUpperCase()} {trade.lot_size} lots
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
                    <p className="font-medium">{trade.entry_price}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Exit Price</p>
                    <p className="font-medium">
                      {trade.exit_price ? trade.exit_price : 'Market'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Time</p>
                    <p className="font-medium">
                      {format(new Date(trade.created_at), 'HH:mm')}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    {trade.status === 'open' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCloseTrade(trade.id)}
                      >
                        Close Trade
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredTrades.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No trades yet. Start trading to see your history here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TradeHistory;
