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
import { CONTRACT_ADDRESSES } from '@/config/contracts'

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
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
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
  const { prices, getCurrentPrice, getBidPrice, getAskPrice, oracleAvailable } = useMarketData()
  const { openPosition: openOnChainPositionV2, isLoading: onChainLoading, approvalPending, getCollateralBalance, getPlatformConfig } = useOnChainTradingV2()
  const { toast } = useToast()
  const [collateralBalance, setCollateralBalance] = useState('0')
  const [maxLeverage, setMaxLeverage] = useState(50)

  // Fetch collateral balance and platform config for live mode
  useEffect(() => {
    if (accountMode === 'live') {
      getCollateralBalance().then(setCollateralBalance);
      getPlatformConfig().then(config => {
        if (config) setMaxLeverage(config.maxLeverage);
      });
    }
  }, [accountMode, getCollateralBalance, getPlatformConfig]);

  const selectedPairData = prices.find(p => p.pair === selectedPair)
  const currentPrice = getCurrentPrice(selectedPair)
  const bidPrice = getBidPrice(selectedPair)
  const askPrice = getAskPrice(selectedPair)

  const handleSubmitTrade = async () => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    setIsLoadingSignal(true)
    
    try {
      // Validate inputs
      if (!lotSize || parseFloat(lotSize) <= 0) {
        toast({
          title: 'Invalid lot size',
          description: 'Please enter a valid lot size',
          variant: 'destructive'
        })
        return
      }

      // Pre-trade validation for live mode
      if (accountMode === 'live') {
        // Check collateral balance
        const balance = parseFloat(collateralBalance);
        const requiredMargin = parseFloat(lotSize);
        
        if (balance < requiredMargin) {
          toast({
            title: 'Insufficient tUSD Balance',
            description: `You need ${requiredMargin} tUSD but only have ${balance.toFixed(2)} tUSD. Visit the Wallet page to get test tokens from the faucet.`,
            variant: 'destructive'
          })
          return
        }

        // Check if MetaMask is connected
        if (typeof window.ethereum === 'undefined') {
          toast({
            title: 'Wallet Not Connected',
            description: 'Please install and connect MetaMask to trade in live mode.',
            variant: 'destructive'
          })
          return
        }

        // Check network (Polygon Amoy chainId: 80002)
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          if (chainId !== '0x13882') { // 80002 in hex
            toast({
              title: 'Wrong Network',
              description: 'Please switch to Polygon Amoy testnet in MetaMask to trade.',
              variant: 'destructive'
            })
            return
          }
        } catch (networkError) {
          console.error('Network check error:', networkError);
        }
      }

      // Get execution price based on order type and direction
      let executionPrice = currentPrice
      if (orderType === 'market') {
        executionPrice = tradeDirection === 'buy' ? askPrice : bidPrice
      } else if (orderType === 'limit' && limitPrice) {
        executionPrice = parseFloat(limitPrice)
      }

      // Check AI signal first
      const response = await checkAISignal(selectedPair, tradeDirection)
      setSignalResponse(response)

      // Create trade in database
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
        // Execute on-chain using the V2 hook
        const txHash = await openOnChainPositionV2({
          pair: selectedPair,
          direction: tradeDirection,
          margin: lotSize,
          leverage: leverage
        });

        if (txHash) {
          // Update collateral balance after trade
          getCollateralBalance().then(setCollateralBalance);
        }
      }

      // Reset form on success
      if (tradeResult) {
        setLotSize('0.1')
        setStopLoss('')
        setTakeProfit('')
        setLimitPrice('')
      }
    } catch (error: any) {
      console.error('Error submitting trade:', error)
      
      // Parse error message for specific handling
      const errorMessage = error?.message || 'Transaction failed';
      
      // User rejected transaction
      if (error?.code === 4001 || errorMessage.includes('User denied') || errorMessage.includes('rejected')) {
        toast({
          title: 'Transaction Cancelled',
          description: 'You cancelled the transaction in MetaMask.',
          variant: 'default'
        })
        return
      }
      
      // Insufficient balance
      if (errorMessage.includes('insufficient') || errorMessage.includes('Insufficient')) {
        toast({
          title: 'Insufficient Balance',
          description: 'Not enough tUSD. Get test tokens from the faucet on the Wallet page.',
          variant: 'destructive'
        })
        return
      }
      
      // Oracle/price feed errors
      if (errorMessage.includes('oracle') || errorMessage.includes('price') || errorMessage.includes('stale')) {
        toast({
          title: 'Price Feed Unavailable',
          description: 'Oracle price is unavailable or stale. Please try again in a moment.',
          variant: 'destructive'
        })
        return
      }
      
      // Network errors
      if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
        toast({
          title: 'Network Error',
          description: 'Check your internet connection and try again.',
          variant: 'destructive'
        })
        return
      }
      
      // Gas estimation failed (often means contract will revert)
      if (errorMessage.includes('gas') || errorMessage.includes('execution reverted')) {
        toast({
          title: 'Transaction Failed',
          description: 'The transaction would fail. Check your balance and try a smaller position.',
          variant: 'destructive'
        })
        return
      }
      
      // Generic fallback
      toast({
        title: 'Trade Failed',
        description: errorMessage.length > 100 ? 'An unexpected error occurred. Please try again.' : errorMessage,
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
    const riskPercent = 2; // 2% risk
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
        {/* Currency Pair Selection */}
        <div className="space-y-2">
          <Label>Currency Pair</Label>
          <div className="grid grid-cols-2 gap-2">
            {prices.slice(0, 4).map((pair) => (
              <Button
                key={pair.pair}
                variant={selectedPair === pair.pair ? 'default' : 'outline'}
                className="h-auto p-3 flex flex-col items-start"
                onClick={() => setSelectedPair(pair.pair)}
              >
                <span className="font-semibold">{pair.pair}</span>
                <span className="text-xs">{pair.price}</span>
                <span className={`text-xs ${pair.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {pair.changePercent >= 0 ? '+' : ''}{pair.changePercent}%
                </span>
              </Button>
            ))}
          </div>
          
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
                  <div className="font-mono font-semibold text-red-600">{bidPrice.toFixed(5)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Price</div>
                  <div className="font-mono font-semibold">{currentPrice.toFixed(5)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Ask</div>
                  <div className="font-mono font-semibold text-green-600">{askPrice.toFixed(5)}</div>
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
          <div className="bg-muted rounded-lg p-3 space-y-2">
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
              {accountMode === 'live' ? (
                <>
                  <div className="flex justify-between">
                    <span>Margin:</span>
                    <span>{lotSize} tUSD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leverage:</span>
                    <span>{leverage}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Position Size:</span>
                    <span>${(parseFloat(lotSize || '0') * leverage).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span>Lot Size:</span>
                  <span>{lotSize}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Entry Price:</span>
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
          disabled={isLoadingSignal || isSubmitting || onChainLoading || approvalPending}
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
              {orderType === 'market' ? (
                <Zap className="h-4 w-4 mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
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
