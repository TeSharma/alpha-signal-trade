import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { TrendingUp, TrendingDown, Calculator, Activity, Zap, Link, AlertTriangle } from "lucide-react"
import { useTrades } from '@/hooks/useTrades'
import { useMarketData } from '@/hooks/useMarketData'
import { useOnChainTradingV2 } from '@/hooks/useOnChainTradingV2'
import { useToast } from '@/components/ui/use-toast'
import { useNetworkEnforcement } from '@/hooks/useNetworkEnforcement'
import { getMinimums, isMainnet, FEE_CONFIG, calculateOpenFee, getNetworkName } from '@/config/contracts'
import { getMarketsForMode, MARKET_METADATA, formatPrice } from '@/config/markets'

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
  const availableMarkets = getMarketsForMode(accountMode)
  const [selectedPair, setSelectedPair] = useState(availableMarkets[0] || 'POL/USD')
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy')
  const [lotSize, setLotSize] = useState('10')
  const [leverage, setLeverage] = useState(5)
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [signalResponse, setSignalResponse] = useState<AISignalResponse | null>(null)
  const [isLoadingSignal, setIsLoadingSignal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { createTrade, accountBalance } = useTrades()
  const { prices, getCurrentPrice, getBidPrice, getAskPrice, oracleAvailable } = useMarketData(accountMode)
  const { openPosition: openOnChainPositionV2, isLoading: onChainLoading, approvalPending, getCollateralBalance, getMaticBalance, getPlatformConfig } = useOnChainTradingV2(accountMode)
  const { toast } = useToast()
  const { isCorrectNetwork, currentChainId, switchToRequiredNetwork, requiredNetworkName } = useNetworkEnforcement(accountMode)
  const [collateralBalance, setCollateralBalance] = useState('0')
  const [maticBalance, setMaticBalance] = useState('0')
  const [maxLeverage, setMaxLeverage] = useState(50)

  // Reset selected pair when mode changes
  useEffect(() => {
    const markets = getMarketsForMode(accountMode)
    if (!markets.includes(selectedPair)) {
      setSelectedPair(markets[0] || 'POL/USD')
    }
  }, [accountMode, selectedPair])

  // Fetch collateral balance, MATIC balance, and platform config for live mode
  useEffect(() => {
    if (accountMode === 'live') {
      getCollateralBalance().then(setCollateralBalance);
      getMaticBalance().then(setMaticBalance);
      getPlatformConfig().then(config => {
        if (config) setMaxLeverage(config.maxLeverage);
      });
    }
  }, [accountMode, getCollateralBalance, getMaticBalance, getPlatformConfig]);

  // Get minimums based on current network
  const networkMinimums = getMinimums(currentChainId);
  const minMargin = networkMinimums.minMargin;

  const selectedPairData = prices.find(p => p.pair === selectedPair)
  const currentPrice = getCurrentPrice(selectedPair)
  const bidPrice = getBidPrice(selectedPair)
  const askPrice = getAskPrice(selectedPair)

  // Oracle health: in live mode, require oracle price for selected pair
  const oracleHealthy = accountMode === 'demo' || selectedPairData?.isOraclePrice === true
  const maticLow = accountMode === 'live' && parseFloat(maticBalance) < 0.001

  const handleSubmitTrade = async () => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    setIsLoadingSignal(true)
    
    try {
      const marginAmount = parseFloat(lotSize);
      if (!lotSize || marginAmount <= 0) {
        toast({ title: 'Invalid lot size', description: 'Please enter a valid lot size', variant: 'destructive' })
        return
      }

      if (accountMode === 'live' && isMainnet(currentChainId) && marginAmount < minMargin) {
        toast({ title: 'Minimum Margin Required', description: `Mainnet requires a minimum margin of ${minMargin} tUSD`, variant: 'destructive' })
        return
      }

      if (accountMode === 'live') {
        const balance = parseFloat(collateralBalance);
        if (balance < marginAmount) {
          toast({ title: 'Insufficient tUSD Balance', description: `You need ${marginAmount} tUSD but only have ${balance.toFixed(2)} tUSD.`, variant: 'destructive' })
          return
        }

        if (typeof window.ethereum === 'undefined') {
          toast({ title: 'Wallet Not Connected', description: 'Please install and connect MetaMask to trade in live mode.', variant: 'destructive' })
          return
        }

        if (!isCorrectNetwork) {
          toast({ title: 'Wrong Network', description: `Please switch to ${requiredNetworkName} to trade.`, variant: 'destructive' })
          return
        }

        if (!oracleHealthy) {
          toast({ title: 'Oracle Unavailable', description: `Price feed for ${selectedPair} is offline or stale.`, variant: 'destructive' })
          return
        }

        if (maticLow) {
          toast({ title: 'Insufficient Gas Token', description: 'You need native tokens to pay gas fees.', variant: 'destructive' })
          return
        }
      }

      let executionPrice = currentPrice
      if (orderType === 'market') {
        executionPrice = tradeDirection === 'buy' ? askPrice : bidPrice
      } else if (orderType === 'limit' && limitPrice) {
        executionPrice = parseFloat(limitPrice)
      }

      const response = await checkAISignal(selectedPair, tradeDirection)
      setSignalResponse(response)

      const tradeResult = await createTrade({
        pair: selectedPair,
        direction: tradeDirection,
        lot_size: parseFloat(lotSize),
        entry_price: executionPrice,
        stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
        take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
        account_mode: accountMode
      })

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
        setLotSize('0.1')
        setStopLoss('')
        setTakeProfit('')
        setLimitPrice('')
      }
    } catch (error: any) {
      console.error('Error submitting trade:', error)
      const errorMessage = error?.message || 'Transaction failed';
      
      if (error?.code === 4001 || errorMessage.includes('User denied') || errorMessage.includes('rejected')) {
        toast({ title: 'Transaction Cancelled', description: 'You cancelled the transaction in MetaMask.', variant: 'default' })
        return
      }
      
      if (errorMessage.includes('insufficient') || errorMessage.includes('Insufficient')) {
        toast({ title: 'Insufficient Balance', description: 'Not enough tUSD.', variant: 'destructive' })
        return
      }
      
      if (errorMessage.includes('oracle') || errorMessage.includes('price') || errorMessage.includes('stale')) {
        toast({ title: 'Price Feed Unavailable', description: 'Oracle price is unavailable or stale.', variant: 'destructive' })
        return
      }
      
      toast({
        title: 'Trade Failed',
        description: errorMessage.length > 100 ? 'An unexpected error occurred.' : errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoadingSignal(false)
      setIsSubmitting(false)
    }
  }

  const calculateLotSize = () => {
    const balance = accountMode === 'demo' 
      ? (accountBalance?.demo_balance || 10000) 
      : (accountBalance?.live_balance || 0);
    const riskPercent = 2;
    const suggestedLot = (balance * (riskPercent / 100) / 10000).toFixed(2);
    setLotSize(suggestedLot);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Place Trade</span>
          <div className="flex items-center gap-2">
            {accountMode === 'live' && parseFloat(collateralBalance) > 0 && (
              <Badge variant="outline" className="text-xs">
                <Link className="h-3 w-3 mr-1" />
                {collateralBalance} tUSD
              </Badge>
            )}
            <Badge variant={accountMode === 'demo' ? 'default' : 'destructive'}>
              {accountMode}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Pair Selection — only valid markets for current mode */}
        <div className="space-y-2">
          <Label>Market</Label>
          <div className="grid grid-cols-3 gap-2">
            {availableMarkets.map((pairName) => {
              const pairData = prices.find(p => p.pair === pairName)
              const meta = MARKET_METADATA[pairName]
              return (
                <Button
                  key={pairName}
                  variant={selectedPair === pairName ? 'default' : 'outline'}
                  className="h-auto p-3 flex flex-col items-start"
                  onClick={() => setSelectedPair(pairName)}
                >
                  <span className="font-semibold">{meta?.icon} {meta?.symbol}</span>
                  <span className="text-xs">{pairData ? formatPrice(pairName, pairData.price) : '—'}</span>
                  {pairData && (
                    <span className={`text-xs ${pairData.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pairData.changePercent >= 0 ? '+' : ''}{pairData.changePercent}%
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Forex markets (EUR/USD, GBP/USD, USD/JPY) — signals live, execution coming in v2
          </p>
          
          {/* Current Price Display */}
          {selectedPairData && (
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Current Price</span>
                <div className="flex items-center gap-2">
                  {selectedPairData.isOraclePrice && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      Oracle
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-blue-500" />
                    <span className="text-xs text-blue-500">Live</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Bid</div>
                  <div className="font-mono font-semibold text-red-600">{formatPrice(selectedPair, bidPrice)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Price</div>
                  <div className="font-mono font-semibold">{formatPrice(selectedPair, currentPrice)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Ask</div>
                  <div className="font-mono font-semibold text-green-600">{formatPrice(selectedPair, askPrice)}</div>
                </div>
              </div>
            </div>
          )}
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

        {/* Order Type */}
        <div className="space-y-2">
          <Label>Order Type</Label>
          <Tabs value={orderType} onValueChange={(value) => setOrderType(value as 'market' | 'limit')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market</TabsTrigger>
              <TabsTrigger value="limit">Limit</TabsTrigger>
            </TabsList>
            <TabsContent value="market" className="space-y-2">
              <div className="text-sm text-gray-600">
                Execute immediately at current market price
              </div>
            </TabsContent>
            <TabsContent value="limit" className="space-y-2">
              <div className="text-sm text-gray-600 mb-2">
                Execute when price reaches your specified level
              </div>
              <Input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="Enter limit price"
                step="0.00001"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Margin Amount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{accountMode === 'live' ? 'Margin (tUSD)' : 'Lot Size'}</Label>
            <Button variant="ghost" size="sm" onClick={calculateLotSize}>
              <Calculator className="h-4 w-4 mr-1" />
              Calculate
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
          <div className="text-xs text-muted-foreground">
            {accountMode === 'live' 
              ? `Position size: $${(parseFloat(lotSize || '0') * leverage).toLocaleString()}`
              : `Position value: $${(parseFloat(lotSize || '0') * currentPrice * 100000).toLocaleString()}`
            }
          </div>
        </div>

        {/* Leverage Selector (Live mode only) */}
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1x</span>
              <span className="text-center">Lower risk ← → Higher risk</span>
              <span>{maxLeverage}x</span>
            </div>
            {leverage >= 20 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                <AlertTriangle className="h-3 w-3" />
                High leverage increases liquidation risk
              </div>
            )}
          </div>
        )}

        {/* Stop Loss */}
        <div className="space-y-2">
          <Label>Stop Loss (Optional)</Label>
          <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="Enter stop loss price" step="0.01" />
        </div>

        {/* Take Profit */}
        <div className="space-y-2">
          <Label>Take Profit (Optional)</Label>
          <Input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="Enter take profit price" step="0.01" />
        </div>

        {/* Trade Summary */}
        {selectedPairData && (
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <h4 className="font-semibold text-sm">Trade Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Pair:</span><span>{selectedPair}</span></div>
              <div className="flex justify-between">
                <span>Direction:</span>
                <span className={tradeDirection === 'buy' ? 'text-green-500' : 'text-red-500'}>{tradeDirection.toUpperCase()}</span>
              </div>
              {accountMode === 'live' ? (
                <>
                  <div className="flex justify-between"><span>Margin:</span><span>{lotSize} tUSD</span></div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Open Fee ({(FEE_CONFIG.openFeeBps / 100).toFixed(2)}%):</span>
                    <span>-{calculateOpenFee(parseFloat(lotSize || '0')).toFixed(4)} tUSD</span>
                  </div>
                  <div className="flex justify-between font-medium text-primary">
                    <span>Net Margin:</span>
                    <span>{(parseFloat(lotSize || '0') - calculateOpenFee(parseFloat(lotSize || '0'))).toFixed(4)} tUSD</span>
                  </div>
                  <div className="flex justify-between"><span>Leverage:</span><span>{leverage}x</span></div>
                  <div className="flex justify-between">
                    <span>Position Size:</span>
                    <span>${((parseFloat(lotSize || '0') - calculateOpenFee(parseFloat(lotSize || '0'))) * leverage).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    Close fee: {(FEE_CONFIG.closeFeeBps / 100).toFixed(2)}% on profits only
                  </div>
                </>
              ) : (
                <div className="flex justify-between"><span>Lot Size:</span><span>{lotSize}</span></div>
              )}
              <div className="flex justify-between"><span>Entry Price:</span><span>{selectedPairData.price}</span></div>
            </div>
          </div>
        )}

        {/* AI Signal */}
        {signalResponse && (
          <div className={`p-3 rounded-lg ${signalResponse.confidence > 70 ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <div className="flex justify-between items-center">
              <span className="font-medium">AI Signal:</span>
              <span className={`font-bold ${signalResponse.confidence > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                {signalResponse.confidence}% Confidence
              </span>
            </div>
            <div className="text-sm mt-1">Recommendation: {signalResponse.recommendation}</div>
          </div>
        )}

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

        {accountMode === 'live' && maticLow && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Low gas token balance</span>
          </div>
        )}

        <Button 
          className="w-full" 
          size="lg"
          onClick={handleSubmitTrade}
          disabled={isLoadingSignal || isSubmitting || onChainLoading || approvalPending || (accountMode === 'live' && (!isCorrectNetwork || !oracleHealthy))}
        >
          {approvalPending ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Approving Token...
            </span>
          ) : isLoadingSignal || onChainLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {accountMode === 'live' ? 'Executing On-Chain...' : 'Executing...'}
            </span>
          ) : (
            <span className="flex items-center">
              {accountMode === 'live' && <Link className="h-4 w-4 mr-2" />}
              {orderType === 'market' ? <Zap className="h-4 w-4 mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
              {orderType === 'market' 
                ? `${tradeDirection.toUpperCase()} ${selectedPair}` 
                : `Place ${tradeDirection.toUpperCase()} Limit`
              }
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

// AI Signal Check (mock implementation)
const checkAISignal = async (pair: string, direction: string): Promise<AISignalResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        pair,
        direction,
        confidence: Math.floor(Math.random() * 100),
        recommendation: Math.random() > 0.5 ? 'strong_buy' : 'hold'
      });
    }, 500);
  });
};

export default TradingForm;
