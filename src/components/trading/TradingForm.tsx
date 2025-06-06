
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calculator } from "lucide-react";
import { connectToBlockchain, getContractInstance, getWeb3 } from '@/lib/web3';

interface TradingFormProps {
  accountMode: 'demo' | 'live';
}

interface AISignalResponse {
  pair: string;
  direction: string;
  confidence: number;
  recommendation: string;
}

const TradingForm = ({ accountMode }: TradingFormProps) => {
  const [selectedPair, setSelectedPair] = useState('GBP/JPY');
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState('0.1');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [signalResponse, setSignalResponse] = useState<AISignalResponse | null>(null);
  const [isLoadingSignal, setIsLoadingSignal] = useState(false);

  const forexPairs = [
    { pair: 'GBP/JPY', price: '188.25', change: '+0.45%' },
    { pair: 'EUR/USD', price: '1.0842', change: '-0.12%' },
    { pair: 'USD/JPY', price: '149.75', change: '+0.23%' },
    { pair: 'GBP/USD', price: '1.2567', change: '+0.18%' },
  ];

  const selectedPairData = forexPairs.find(p => p.pair === selectedPair);

  const handleSubmitTrade = async () => {
    const tradeData = {
      pair: selectedPair,
      direction: tradeDirection,
      lotSize: parseFloat(lotSize),
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      accountMode
    };

    if (accountMode === 'demo') {
      console.log('Demo trade submitted:', tradeData);
      setIsLoadingSignal(true);
      try {
        const response = await checkAISignal(selectedPair, tradeDirection);
        setSignalResponse(response);
        console.log('AI Signal:', response);
        if (response.confidence > 70) {
          console.log('Strong signal - would execute trade in live mode');
        }
      } catch (error) {
        console.error('Error checking AI signal:', error);
      } finally {
        setIsLoadingSignal(false);
      }
      return;
    }

    try {
      const isConnected = await connectToBlockchain();
      if (!isConnected) {
        console.error('Failed to connect to blockchain');
        return;
      }

      const contractAddress = '0x...'; // Replace with actual contract address
      const contractAbi = []; // Replace with actual ABI
      const contract = getContractInstance(contractAddress, contractAbi);

      const web3 = getWeb3();
      const accounts = await web3.eth.getAccounts();
      const tx = await contract.methods.openPosition(
        tradeData.pair,
        tradeData.lotSize,
        parseFloat(selectedPairData?.price || '0'), // Current price
        tradeData.stopLoss || 0,
        tradeData.takeProfit || 0
      ).send({ from: accounts[0] });

      console.log('Transaction successful:', tx);
    } catch (error) {
      console.error('Error submitting trade:', error);
    }
  };

  const calculateLotSize = () => {
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
        {signalResponse && (
          <div className={`p-3 rounded-lg ${
            signalResponse.confidence > 70 ? 'bg-green-50' : 'bg-yellow-50'
          }`}>
            <div className="flex justify-between items-center">
              <span className="font-medium">AI Signal:</span>
              <span className={`font-bold ${
                signalResponse.confidence > 70 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {signalResponse.confidence}% Confidence
              </span>
            </div>
            <div className="text-sm mt-1">
              Recommendation: {signalResponse.recommendation}
            </div>
          </div>
        )}

        <Button 
          className="w-full" 
          size="lg"
          onClick={handleSubmitTrade}
          disabled={isLoadingSignal}
        >
          {isLoadingSignal ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing Signal...
            </span>
          ) : (
            `Place ${tradeDirection.toUpperCase()} Order`
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

// AI Signal Check (mock implementation)
const checkAISignal = async (pair: string, direction: string): Promise<AISignalResponse> => {
  // In a real implementation, this would call your AI service
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        pair,
        direction,
        confidence: Math.floor(Math.random() * 100), // Random confidence for demo
        recommendation: Math.random() > 0.5 ? 'strong_buy' : 'hold' // Random recommendation
      });
    }, 500);
  });
};

export default TradingForm;
