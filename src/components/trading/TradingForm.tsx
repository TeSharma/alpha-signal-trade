
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calculator } from "lucide-react";

interface TradingFormProps {
  accountMode: 'demo' | 'live';
}

const TradingForm = ({ accountMode }: TradingFormProps) => {
  const [selectedPair, setSelectedPair] = useState('GBP/JPY');
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState('0.1');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const forexPairs = [
    { pair: 'GBP/JPY', price: '188.25', change: '+0.45%' },
    { pair: 'EUR/USD', price: '1.0842', change: '-0.12%' },
    { pair: 'USD/JPY', price: '149.75', change: '+0.23%' },
    { pair: 'GBP/USD', price: '1.2567', change: '+0.18%' },
  ];

  const selectedPairData = forexPairs.find(p => p.pair === selectedPair);

  const handleSubmitTrade = () => {
    const tradeData = {
      pair: selectedPair,
      direction: tradeDirection,
      lotSize: parseFloat(lotSize),
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      accountMode
    };
    console.log('Submitting trade:', tradeData);
  };

  const calculateLotSize = () => {
    // Simple lot size calculator based on risk percentage
    const balance = accountMode === 'demo' ? 1000 : 2547.83;
    const riskPercent = 2; // 2% risk
    const suggestedLot = (balance * (riskPercent / 100) / 100).toFixed(2);
    setLotSize(suggestedLot);
  };

  return (
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
        {/* Currency Pair Selection */}
        <div className="space-y-2">
          <Label>Currency Pair</Label>
          <div className="grid grid-cols-2 gap-2">
            {forexPairs.map((pair) => (
              <Button
                key={pair.pair}
                variant={selectedPair === pair.pair ? 'default' : 'outline'}
                className="h-auto p-3 flex flex-col items-start"
                onClick={() => setSelectedPair(pair.pair)}
              >
                <span className="font-semibold">{pair.pair}</span>
                <span className="text-xs">{pair.price}</span>
                <span className={`text-xs ${pair.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {pair.change}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Trade Direction */}
        <div className="space-y-2">
          <Label>Direction</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={tradeDirection === 'buy' ? 'default' : 'outline'}
              className={tradeDirection === 'buy' ? 'bg-green-500 hover:bg-green-600' : ''}
              onClick={() => setTradeDirection('buy')}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Buy
            </Button>
            <Button
              variant={tradeDirection === 'sell' ? 'default' : 'outline'}
              className={tradeDirection === 'sell' ? 'bg-red-500 hover:bg-red-600' : ''}
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
            <Button variant="ghost" size="sm" onClick={calculateLotSize}>
              <Calculator className="h-4 w-4 mr-1" />
              Calculate
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

        {/* Stop Loss */}
        <div className="space-y-2">
          <Label>Stop Loss (Optional)</Label>
          <Input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="Enter stop loss price"
            step="0.01"
          />
        </div>

        {/* Take Profit */}
        <div className="space-y-2">
          <Label>Take Profit (Optional)</Label>
          <Input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder="Enter take profit price"
            step="0.01"
          />
        </div>

        {/* Trade Summary */}
        {selectedPairData && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <h4 className="font-semibold text-sm">Trade Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Pair:</span>
                <span>{selectedPair}</span>
              </div>
              <div className="flex justify-between">
                <span>Direction:</span>
                <span className={tradeDirection === 'buy' ? 'text-green-500' : 'text-red-500'}>
                  {tradeDirection.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Lot Size:</span>
                <span>{lotSize}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Price:</span>
                <span>{selectedPairData.price}</span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button 
          className="w-full" 
          size="lg"
          onClick={handleSubmitTrade}
        >
          Place {tradeDirection.toUpperCase()} Order
        </Button>
      </CardContent>
    </Card>
  );
};

export default TradingForm;
