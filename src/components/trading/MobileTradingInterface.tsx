
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Calculator, ChevronDown, ChevronUp, X } from "lucide-react";
import CollapsibleCard from "@/components/ui/collapsible-card";

interface MobileTradingInterfaceProps {
  accountMode: 'demo' | 'live';
}

const MobileTradingInterface = ({ accountMode }: MobileTradingInterfaceProps) => {
  const [selectedPair, setSelectedPair] = useState('GBP/JPY');
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState('0.1');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [showChart, setShowChart] = useState(true);

  const forexPairs = [
    { pair: 'GBP/JPY', price: '188.25', change: '+0.45%' },
    { pair: 'EUR/USD', price: '1.0842', change: '-0.12%' },
    { pair: 'USD/JPY', price: '149.75', change: '+0.23%' },
    { pair: 'GBP/USD', price: '1.2567', change: '+0.18%' },
  ];

  const openPositions = [
    { id: 1, pair: 'EUR/USD', type: 'Buy', lot: '0.1', pnl: '+$23.50', entry: '1.0850' },
    { id: 2, pair: 'GBP/JPY', type: 'Sell', lot: '0.05', pnl: '-$8.20', entry: '188.90' },
  ];

  const selectedPairData = forexPairs.find(p => p.pair === selectedPair);

  return (
    <main className="space-y-4 p-4">
      {/* Pair Selector */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Trading Pair</Label>
          <Select value={selectedPair} onValueChange={setSelectedPair}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {forexPairs.map((pair) => (
                <SelectItem key={pair.pair} value={pair.pair}>
                  <div className="flex justify-between w-full">
                    <span>{pair.pair}</span>
                    <span className="ml-4 text-sm text-gray-500">{pair.price}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Chart View - Collapsible */}
      <CollapsibleCard title="Chart View" defaultOpen={showChart}>
        <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">TradingView Chart</p>
          <p className="text-sm text-gray-400 ml-2">(Pinch to zoom)</p>
        </div>
      </CollapsibleCard>

      {/* Trading Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Place Trade</span>
            <Badge variant={accountMode === 'demo' ? 'default' : 'destructive'}>
              {accountMode}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trade Direction */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={tradeDirection === 'buy' ? 'default' : 'outline'}
                className={`h-12 ${tradeDirection === 'buy' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                onClick={() => setTradeDirection('buy')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Buy
              </Button>
              <Button
                variant={tradeDirection === 'sell' ? 'default' : 'outline'}
                className={`h-12 ${tradeDirection === 'sell' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                onClick={() => setTradeDirection('sell')}
              >
                <TrendingDown className="h-4 w-4 mr-2" />
                Sell
              </Button>
            </div>
          </div>

          {/* Lot Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lot Size</Label>
              <Button variant="ghost" size="sm">
                <Calculator className="h-4 w-4 mr-1" />
                Calc
              </Button>
            </div>
            <Input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder="0.1"
              step="0.01"
              min="0.01"
            />
          </div>

          {/* Stop Loss & Take Profit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Stop Loss</Label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="SL"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Take Profit</Label>
              <Input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="TP"
                step="0.01"
              />
            </div>
          </div>

          {/* Trade Summary */}
          {selectedPairData && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <h4 className="font-semibold text-sm">Trade Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Pair:</span>
                  <span>{selectedPair}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span>{selectedPairData.price}</span>
                </div>
                <div className="flex justify-between">
                  <span>Direction:</span>
                  <span className={tradeDirection === 'buy' ? 'text-green-500' : 'text-red-500'}>
                    {tradeDirection.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Lot:</span>
                  <span>{lotSize}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Positions */}
      <CollapsibleCard title={`Open Positions (${openPositions.length})`}>
        <div className="space-y-3">
          {openPositions.map((position) => (
            <div key={position.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">{position.pair}</p>
                  <p className="text-sm text-gray-600">{position.type} • {position.lot} lot</p>
                  <p className="text-xs text-gray-500">Entry: {position.entry}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${position.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                    {position.pnl}
                  </p>
                  <Button variant="outline" size="sm" className="mt-1">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* Sticky Submit Button */}
      <div className="fixed bottom-4 left-4 right-4 lg:hidden">
        <Button className="w-full h-12 text-lg font-semibold" size="lg">
          Place {tradeDirection.toUpperCase()} Order
        </Button>
      </div>

      {/* Bottom padding to prevent content being hidden behind sticky button */}
      <div className="h-16"></div>
    </main>
  );
};

export default MobileTradingInterface;
