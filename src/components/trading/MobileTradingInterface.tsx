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
import { useNetworkEnforcement } from '@/hooks/useNetworkEnforcement';
import { getMinimums, isMainnet, FEE_CONFIG, calculateOpenFee, getNetworkName } from '@/config/contracts';
import { getMarketsForMode, MARKET_METADATA, formatPrice } from '@/config/markets';

interface MobileTradingInterfaceProps {
  accountMode: 'demo' | 'live';
}

const MobileTradingInterface = ({ accountMode }: MobileTradingInterfaceProps) => {
  const availableMarkets = getMarketsForMode(accountMode);
  const [selectedPair, setSelectedPair] = useState(availableMarkets[0] || 'POL/USD');
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState('10');
  const [leverage, setLeverage] = useState(5);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [showChart, setShowChart] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collateralBalance, setCollateralBalance] = useState('0');
  const [maticBalance, setMaticBalance] = useState('0');

  const { createTrade, accountBalance } = useTrades();
  const { prices, getCurrentPrice, getBidPrice, getAskPrice, oracleAvailable } = useMarketData(accountMode);
  const { openPosition: openOnChainPositionV2, isLoading: onChainLoading, approvalPending, getCollateralBalance, getMaticBalance, getPlatformConfig } = useOnChainTradingV2(accountMode);
  const { toast } = useToast();
  const { isCorrectNetwork, currentChainId, switchToRequiredNetwork, requiredNetworkName } = useNetworkEnforcement(accountMode);
  
  const networkMinimums = getMinimums(currentChainId ?? undefined);
  const minMargin = networkMinimums.minMargin;
  const [maxLeverage, setMaxLeverage] = useState(50);

  // Reset selected pair when mode changes
  useEffect(() => {
    const markets = getMarketsForMode(accountMode);
    if (!markets.includes(selectedPair)) {
      setSelectedPair(markets[0] || 'POL/USD');
    }
  }, [accountMode, selectedPair]);

  useEffect(() => {
    if (accountMode === 'live') {
      getCollateralBalance().then(setCollateralBalance);
      getMaticBalance().then(setMaticBalance);
      getPlatformConfig().then(config => {
        if (config) setMaxLeverage(config.maxLeverage);
      });
    }
  }, [accountMode, getCollateralBalance, getMaticBalance, getPlatformConfig]);

  const selectedPairData = prices.find(p => p.pair === selectedPair);
  const currentPrice = getCurrentPrice(selectedPair);
  const bidPrice = getBidPrice(selectedPair);
  const askPrice = getAskPrice(selectedPair);

  const oracleHealthy = accountMode === 'demo' || selectedPairData?.isOraclePrice === true;
  const maticLow = accountMode === 'live' && parseFloat(maticBalance) < 0.001;

  const handleSubmitTrade = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const marginAmount = parseFloat(lotSize);
      if (!lotSize || marginAmount <= 0) {
        toast({ title: 'Invalid lot size', description: 'Please enter a valid lot size', variant: 'destructive' });
        return;
      }

      if (accountMode === 'live' && isMainnet(currentChainId ?? undefined) && marginAmount < minMargin) {
        toast({ title: 'Minimum Margin Required', description: `Mainnet requires a minimum margin of ${minMargin} tUSD`, variant: 'destructive' });
        return;
      }

      if (accountMode === 'live') {
        if (!isCorrectNetwork) {
          toast({ title: 'Wrong Network', description: `Please switch to ${requiredNetworkName} to trade.`, variant: 'destructive' });
          return;
        }

        if (!oracleHealthy) {
          toast({ title: 'Oracle Unavailable', description: `Price feed for ${selectedPair} is offline or stale.`, variant: 'destructive' });
          return;
        }

        const balance = parseFloat(collateralBalance);
        if (balance < marginAmount) {
          toast({ title: 'Insufficient tUSD Balance', description: `You need ${marginAmount} tUSD but only have ${balance.toFixed(2)} tUSD.`, variant: 'destructive' });
          return;
        }

        if (maticLow) {
          toast({ title: 'Insufficient Gas Token', description: 'You need native tokens to pay gas fees.', variant: 'destructive' });
          return;
        }

        if (typeof window.ethereum === 'undefined') {
          toast({ title: 'Wallet Not Connected', description: 'Please install and connect MetaMask.', variant: 'destructive' });
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
        toast({ title: 'Trade Placed', description: `${tradeDirection.toUpperCase()} ${selectedPair} executed successfully` });
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
          <OracleStatus accountMode={accountMode} />
        </div>
      )}

      {/* Pair Selector — only valid markets for mode */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Trading Pair</Label>
          <Select value={selectedPair} onValueChange={setSelectedPair}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMarkets.map((pairName) => {
                const pairData = prices.find(p => p.pair === pairName);
                const meta = MARKET_METADATA[pairName];
                return (
                  <SelectItem key={pairName} value={pairName}>
                    <div className="flex justify-between w-full">
                      <span>{meta?.icon} {meta?.symbol}/{pairName.split('/')[1]}</span>
                      <span className="ml-4 text-sm text-muted-foreground">
                        {pairData ? formatPrice(pairName, pairData.price) : '—'}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Forex markets — signals live, execution coming in v2
          </p>
          
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

      {/* Chart View */}
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
          {/* Direction */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={tradeDirection === 'buy' ? 'default' : 'outline'}
                className={`h-12 ${tradeDirection === 'buy' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                onClick={() => setTradeDirection('buy')}
              >
                <TrendingUp className="h-4 w-4 mr-2" /> Buy
              </Button>
              <Button
                variant={tradeDirection === 'sell' ? 'default' : 'outline'}
                className={`h-12 ${tradeDirection === 'sell' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                onClick={() => setTradeDirection('sell')}
              >
                <TrendingDown className="h-4 w-4 mr-2" /> Sell
              </Button>
            </div>
          </div>

          {/* Margin/Lot Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{accountMode === 'live' ? 'Margin (tUSD)' : 'Lot Size'}</Label>
              <Button variant="ghost" size="sm" onClick={calculateLotSize}>
                <Calculator className="h-4 w-4 mr-1" /> Calc
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
              <Slider value={[leverage]} onValueChange={(value) => setLeverage(value[0])} min={1} max={maxLeverage} step={1} className="w-full" />
              {leverage >= 20 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  <AlertTriangle className="h-3 w-3" /> High leverage risk
                </div>
              )}
            </div>
          )}

          {/* Stop Loss & Take Profit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Stop Loss</Label>
              <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="SL" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Take Profit</Label>
              <Input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="TP" step="0.01" />
            </div>
          </div>

          {/* Trade Summary */}
          {selectedPairData && (
            <div className="bg-muted rounded-lg p-3 space-y-2">
              <h4 className="font-semibold text-sm">Trade Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span>Pair:</span><span>{selectedPair}</span></div>
                <div className="flex justify-between"><span>Price:</span><span>{selectedPairData.price}</span></div>
                <div className="flex justify-between">
                  <span>Direction:</span>
                  <span className={tradeDirection === 'buy' ? 'text-green-500' : 'text-red-500'}>{tradeDirection.toUpperCase()}</span>
                </div>
                {accountMode === 'live' ? (
                  <>
                    <div className="flex justify-between"><span>Margin:</span><span>{lotSize} tUSD</span></div>
                    <div className="flex justify-between col-span-2 text-muted-foreground">
                      <span>Open Fee ({(FEE_CONFIG.openFeeBps / 100).toFixed(2)}%):</span>
                      <span>-{calculateOpenFee(parseFloat(lotSize || '0')).toFixed(4)} tUSD</span>
                    </div>
                    <div className="flex justify-between col-span-2 font-medium text-primary">
                      <span>Net Margin:</span>
                      <span>{(parseFloat(lotSize || '0') - calculateOpenFee(parseFloat(lotSize || '0'))).toFixed(4)} tUSD</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span>Position:</span>
                      <span>${((parseFloat(lotSize || '0') - calculateOpenFee(parseFloat(lotSize || '0'))) * leverage).toLocaleString()} @ {leverage}x</span>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground pt-1 border-t">
                      Close fee: {(FEE_CONFIG.closeFeeBps / 100).toFixed(2)}% on profits only
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between"><span>Lot:</span><span>{lotSize}</span></div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo positions notice */}
      {accountMode === 'demo' && (
        <CollapsibleCard title="Open Positions">
          <div className="text-center text-sm text-muted-foreground py-4">Demo positions are shown in Trade History</div>
        </CollapsibleCard>
      )}

      {/* Live Mode Warnings */}
      {accountMode === 'live' && !isCorrectNetwork && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Switch to {requiredNetworkName} to trade</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={switchToRequiredNetwork}>Switch</Button>
        </div>
      )}

      {accountMode === 'live' && isCorrectNetwork && !oracleHealthy && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Oracle offline for {selectedPair} — trading paused</span>
        </div>
      )}

      {accountMode === 'live' && isCorrectNetwork && maticLow && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Low gas token balance</span>
        </div>
      )}

      {/* Sticky Submit Button */}
      <div className="fixed bottom-4 left-4 right-4 lg:hidden">
        <Button 
          className="w-full h-12 text-lg font-semibold" 
          size="lg"
          onClick={handleSubmitTrade}
          disabled={isSubmitting || onChainLoading || approvalPending || (accountMode === 'live' && (!isCorrectNetwork || !oracleHealthy))}
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

      <div className="h-20"></div>
    </main>
  );
};

export default MobileTradingInterface;
