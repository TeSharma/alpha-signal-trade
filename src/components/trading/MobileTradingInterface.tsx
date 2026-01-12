
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, TrendingDown, Calculator, X, AlertTriangle, Zap, Link } from "lucide-react";
import CollapsibleCard from "@/components/ui/collapsible-card";
import OracleStatus from "@/components/trading/OracleStatus";
import { useTrades } from '@/hooks/useTrades';
import { useMarketData } from '@/hooks/useMarketData';
import { useOnChainTradingV2 } from '@/hooks/useOnChainTradingV2';
import { useToast } from '@/hooks/use-toast';

interface MobileTradingInterfaceProps {
  accountMode: 'demo' | 'live';
}

const MobileTradingInterface = ({ accountMode }: MobileTradingInterfaceProps) => {
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState('10');
  const [leverage, setLeverage] = useState(5);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [showChart, setShowChart] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collateralBalance, setCollateralBalance] = useState('0');

  const { createTrade, accountBalance } = useTrades();
  const { prices, getCurrentPrice, getBidPrice, getAskPrice } = useMarketData();
  const { openPosition: openOnChainPositionV2, isLoading: onChainLoading, approvalPending, getCollateralBalance, getPlatformConfig } = useOnChainTradingV2();
  const { toast } = useToast();
  const [maxLeverage, setMaxLeverage] = useState(50);

  // Fetch collateral balance and platform config for live mode
  useEffect(() => {
    if (accountMode === 'live') {
      getCollateralBalance().then(setCollateralBalance);
      getPlatformConfig().then(config => {
        if (config) setMaxLeverage(config.maxLeverage);
      });
    }
  }, [accountMode, getCollateralBalance, getPlatformConfig]);

  const selectedPairData = prices.find(p => p.pair === selectedPair);
  const currentPrice = getCurrentPrice(selectedPair);
  const bidPrice = getBidPrice(selectedPair);
  const askPrice = getAskPrice(selectedPair);

  const handleSubmitTrade = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Validate inputs
      if (!lotSize || parseFloat(lotSize) <= 0) {
        toast({
          title: 'Invalid lot size',
          description: 'Please enter a valid lot size',
          variant: 'destructive'
        });
        return;
      }

      // Pre-trade validation for live mode
      if (accountMode === 'live') {
        const balance = parseFloat(collateralBalance);
        const requiredMargin = parseFloat(lotSize);
        
        if (balance < requiredMargin) {
          toast({
            title: 'Insufficient tUSD Balance',
            description: `You need ${requiredMargin} tUSD but only have ${balance.toFixed(2)} tUSD.`,
            variant: 'destructive'
          });
          return;
        }

        if (typeof window.ethereum === 'undefined') {
          toast({
            title: 'Wallet Not Connected',
            description: 'Please install and connect MetaMask.',
            variant: 'destructive'
          });
          return;
        }
      }

      const executionPrice = tradeDirection === 'buy' ? askPrice : bidPrice;

      const tradeResult = await createTrade({
        pair: selectedPair,
        direction: tradeDirection,
        lot_size: parseFloat(lotSize),
        entry_price: executionPrice,
        stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
        take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
        account_mode: accountMode
      });

      if (accountMode === 'live' && tradeResult) {
        const txHash = await openOnChainPositionV2({
          pair: selectedPair,
          direction: tradeDirection,
          margin: lotSize,
          leverage: leverage
        });

        if (txHash) {
          getCollateralBalance().then(setCollateralBalance);
        }
      }

      if (tradeResult) {
        setLotSize('10');
        setStopLoss('');
        setTakeProfit('');
        toast({
          title: 'Trade Placed',
          description: `${tradeDirection.toUpperCase()} ${selectedPair} executed successfully`,
        });
      }
    } catch (error: any) {
      console.error('Error submitting trade:', error);
      const errorMessage = error?.message || 'Transaction failed';
      
      if (error?.code === 4001 || errorMessage.includes('rejected')) {
        toast({ title: 'Transaction Cancelled', description: 'You cancelled the transaction.' });
        return;
      }
      
      toast({
        title: 'Trade Failed',
        description: errorMessage.length > 100 ? 'An unexpected error occurred.' : errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateLotSize = () => {
    const balance = accountMode === 'demo' 
      ? (accountBalance?.demo_balance || 10000) 
      : parseFloat(collateralBalance) || 0;
    const riskPercent = 2;
    const suggestedLot = Math.max(1, Math.floor(balance * (riskPercent / 100)));
    setLotSize(suggestedLot.toString());
  };

  return (
    <main className="space-y-4 p-4">
      {/* Oracle Status for Live Mode */}
      {accountMode === 'live' && (
        <div className="flex justify-center">
          <OracleStatus />
        </div>
      )}

      {/* Pair Selector */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Trading Pair</Label>
          <Select value={selectedPair} onValueChange={setSelectedPair}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {prices.slice(0, 7).map((pair) => (
                <SelectItem key={pair.pair} value={pair.pair}>
                  <div className="flex justify-between w-full">
                    <span>{pair.pair}</span>
                    <span className="ml-4 text-sm text-muted-foreground">{pair.price}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Live mode collateral display */}
          {accountMode === 'live' && parseFloat(collateralBalance) > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Link className="h-3 w-3 mr-1" />
                {parseFloat(collateralBalance).toFixed(2)} tUSD
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart View - Collapsible */}
      <CollapsibleCard title="Chart View" defaultOpen={showChart}>
        <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">TradingView Chart</p>
          <p className="text-sm text-muted-foreground ml-2">(Pinch to zoom)</p>
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

          {/* Margin/Lot Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{accountMode === 'live' ? 'Margin (tUSD)' : 'Lot Size'}</Label>
              <Button variant="ghost" size="sm" onClick={calculateLotSize}>
                <Calculator className="h-4 w-4 mr-1" />
                Calc
              </Button>
            </div>
            <Input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder={accountMode === 'live' ? '10' : '0.1'}
              step={accountMode === 'live' ? '1' : '0.01'}
              min={accountMode === 'live' ? '1' : '0.01'}
            />
          </div>

          {/* Leverage (Live mode only) */}
          {accountMode === 'live' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Leverage</Label>
                <Badge variant="outline" className="font-mono">{leverage}x</Badge>
              </div>
              <Slider
                value={[leverage]}
                onValueChange={(value) => setLeverage(value[0])}
                min={1}
                max={maxLeverage}
                step={1}
                className="w-full"
              />
              {leverage >= 20 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  <AlertTriangle className="h-3 w-3" />
                  High leverage risk
                </div>
              )}
            </div>
          )}

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
            <div className="bg-muted rounded-lg p-3 space-y-2">
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
                {accountMode === 'live' ? (
                  <>
                    <div className="flex justify-between">
                      <span>Margin:</span>
                      <span>{lotSize} tUSD</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span>Position:</span>
                      <span>${(parseFloat(lotSize || '0') * leverage).toLocaleString()} @ {leverage}x</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>Lot:</span>
                    <span>{lotSize}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Positions - Only for live mode with V2 positions panel integration */}
      {accountMode === 'demo' && (
        <CollapsibleCard title="Open Positions">
          <div className="text-center text-sm text-muted-foreground py-4">
            Demo positions are shown in Trade History
          </div>
        </CollapsibleCard>
      )}

      {/* Sticky Submit Button */}
      <div className="fixed bottom-4 left-4 right-4 lg:hidden">
        <Button 
          className="w-full h-12 text-lg font-semibold" 
          size="lg"
          onClick={handleSubmitTrade}
          disabled={isSubmitting || onChainLoading || approvalPending}
        >
          {approvalPending ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Approving...
            </span>
          ) : isSubmitting || onChainLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {accountMode === 'live' ? 'Executing...' : 'Placing...'}
            </span>
          ) : (
            <span className="flex items-center justify-center">
              {accountMode === 'live' && <Zap className="h-4 w-4 mr-2" />}
              {tradeDirection.toUpperCase()} {selectedPair}
            </span>
          )}
        </Button>
      </div>

      {/* Bottom padding to prevent content being hidden behind sticky button */}
      <div className="h-20"></div>
    </main>
  );
};

export default MobileTradingInterface;
