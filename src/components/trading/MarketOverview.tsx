import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, BarChart3, Wifi, WifiOff, RefreshCw, Zap, Info } from "lucide-react"
import { useMarketData } from '@/hooks/useMarketData'
import { V1_TRADING_MARKETS, MARKET_METADATA, formatPrice, isMainnetOnly } from '@/config/markets'

const MarketOverview = () => {
  const { prices, isConnected, oracleAvailable, updatePrices, isLoading } = useMarketData()
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m')

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']

  return (
    <div className="space-y-6">
      {/* TradingView Chart Placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Live Chart
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                  {isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={updatePrices}
                disabled={isLoading}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {oracleAvailable && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  Chainlink
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {timeframes.map((tf) => (
              <Button
                key={tf}
                variant={selectedTimeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTimeframe(tf)}
                className="h-6 text-xs"
              >
                {tf}
              </Button>
            ))}
          </div>
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
          <div className="flex items-center justify-between">
            <CardTitle>Market Overview</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live Prices
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Mainnet-only pairs shown as disabled */}
            {V1_TRADING_MARKETS.filter(p => isMainnetOnly(p)).map((pairName) => {
              const meta = MARKET_METADATA[pairName]
              return (
                <div key={pairName} className="flex items-center justify-between p-3 border rounded-lg opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{meta?.icon} {pairName}</p>
                      <Badge variant="outline" className="text-[10px]">Mainnet only</Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">—</div>
                </div>
              )
            })}

            {/* Active pairs with live data */}
            {prices
              .filter(item => (V1_TRADING_MARKETS as readonly string[]).includes(item.pair) && !isMainnetOnly(item.pair))
              .map((item) => {
              const meta = MARKET_METADATA[item.pair]
              return (
                <div key={item.pair} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      item.changePercent >= 0 ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {item.changePercent >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{meta?.icon} {item.pair}</p>
                      <p className="text-sm text-gray-600">Vol: {item.volume}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <p className="font-semibold">{formatPrice(item.pair, item.price)}</p>
                      {item.isOraclePrice && (
                        <span title="Chainlink Oracle">
                          <Zap className="h-3 w-3 text-yellow-500" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.changePercent >= 0 ? 'default' : 'destructive'}>
                        {item.changePercent >= 0 ? '+' : ''}{item.changePercent}%
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Spread: {item.spread}
                    </div>
                  </div>
                </div>
              )
            })}
            {prices.filter(item => (V1_TRADING_MARKETS as readonly string[]).includes(item.pair) && !isMainnetOnly(item.pair)).length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <p>Waiting for oracle data...</p>
                <p className="text-xs mt-1">POL/USD will appear once Chainlink feed is active</p>
              </div>
            )}
          </div>
          
          {/* Forex v2 Notice */}
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
            <Info className="h-4 w-4 shrink-0" />
            <span>Forex markets (EUR/USD, GBP/USD, USD/JPY) coming in v2 with dedicated oracle integration</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketOverview;
