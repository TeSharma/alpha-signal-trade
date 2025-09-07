
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { TrendingUp, TrendingDown, X, DollarSign, Clock, Activity } from "lucide-react"
import { useTrades, Trade } from '@/hooks/useTrades'
import { useMarketData } from '@/hooks/useMarketData'
import { useToast } from '@/components/ui/use-toast'

interface TradeHistoryProps {
  accountMode: 'demo' | 'live'
}

const TradeHistory = ({ accountMode }: TradeHistoryProps) => {
  const { trades, closeTrade, updatePnL } = useTrades()
  const { getCurrentPrice } = useMarketData()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('open')

  const openTrades = trades.filter(trade => 
    trade.status === 'open' && trade.account_mode === accountMode
  )
  const closedTrades = trades.filter(trade => 
    trade.status === 'closed' && trade.account_mode === accountMode
  )

  // Update PnL for open trades
  useEffect(() => {
    const updateOpenTradesPnL = async () => {
      for (const trade of openTrades) {
        const currentPrice = getCurrentPrice(trade.pair)
        if (currentPrice > 0) {
          await updatePnL(trade.id, currentPrice)
        }
      }
    }

    const interval = setInterval(updateOpenTradesPnL, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [openTrades, getCurrentPrice, updatePnL])

  const handleCloseTrade = async (trade: Trade) => {
    const currentPrice = getCurrentPrice(trade.pair)
    if (currentPrice > 0) {
      await closeTrade(trade.id, currentPrice)
      toast({
        title: 'Trade Closed',
        description: `${trade.pair} ${trade.direction} position closed`,
      })
    }
  }

  const calculateCurrentPnL = (trade: Trade) => {
    const currentPrice = getCurrentPrice(trade.pair)
    if (currentPrice === 0) return trade.pnl || 0

    let pnl = 0
    if (trade.direction === 'buy') {
      pnl = (currentPrice - trade.entry_price) * trade.lot_size * 100000
    } else {
      pnl = (trade.entry_price - currentPrice) * trade.lot_size * 100000
    }
    return pnl
  }

  const formatPnL = (pnl: number) => {
    const formatted = Math.abs(pnl).toFixed(2)
    return pnl >= 0 ? `+$${formatted}` : `-$${formatted}`
  }

  const TradeCard = ({ trade, isOpen = false }: { trade: Trade, isOpen?: boolean }) => {
    const currentPrice = getCurrentPrice(trade.pair)
    const pnl = isOpen ? calculateCurrentPnL(trade) : (trade.pnl || 0)
    const isProfitable = pnl >= 0

    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant={trade.direction === 'buy' ? 'default' : 'destructive'}
              className={trade.direction === 'buy' ? 'bg-green-500' : 'bg-red-500'}
            >
              {trade.direction === 'buy' ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {trade.direction.toUpperCase()}
            </Badge>
            <span className="font-semibold">{trade.pair}</span>
            <Badge variant="outline">{trade.lot_size} lots</Badge>
          </div>
          {isOpen && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Close
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close Trade</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to close this {trade.pair} {trade.direction} position at current market price ({currentPrice.toFixed(5)})?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleCloseTrade(trade)}>
                    Close Trade
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Entry Price</p>
            <p className="font-mono font-semibold">{trade.entry_price.toFixed(5)}</p>
          </div>
          {isOpen && (
            <div>
              <p className="text-gray-500">Current Price</p>
              <p className="font-mono font-semibold">{currentPrice.toFixed(5)}</p>
            </div>
          )}
          {!isOpen && trade.exit_price && (
            <div>
              <p className="text-gray-500">Exit Price</p>
              <p className="font-mono font-semibold">{trade.exit_price.toFixed(5)}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">P&L</p>
            <p className={`font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatPnL(pnl)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">{isOpen ? 'Duration' : 'Closed'}</p>
            <p className="font-medium">
              {isOpen 
                ? formatDuration(new Date(trade.created_at))
                : new Date(trade.closed_at || trade.updated_at).toLocaleDateString()
              }
            </p>
          </div>
        </div>

        {(trade.stop_loss || trade.take_profit) && (
          <div className="flex gap-4 text-xs">
            {trade.stop_loss && (
              <div className="flex items-center gap-1">
                <span className="text-red-600">SL:</span>
                <span className="font-mono">{trade.stop_loss.toFixed(5)}</span>
              </div>
            )}
            {trade.take_profit && (
              <div className="flex items-center gap-1">
                <span className="text-green-600">TP:</span>
                <span className="font-mono">{trade.take_profit.toFixed(5)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const formatDuration = (startDate: Date) => {
    const now = new Date()
    const diff = now.getTime() - startDate.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const totalOpenPnL = openTrades.reduce((sum, trade) => sum + calculateCurrentPnL(trade), 0)
  const totalClosedPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Trade History</span>
          <Badge variant="outline">
            {accountMode === 'demo' ? '💰 Demo' : '🔴 Live'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="open" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Open ({openTrades.length})
            </TabsTrigger>
            <TabsTrigger value="closed" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Closed ({closedTrades.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            {totalOpenPnL !== 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Unrealized P&L</span>
                  <span className={`font-bold ${totalOpenPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPnL(totalOpenPnL)}
                  </span>
                </div>
              </div>
            )}
            
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {openTrades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No open trades</p>
                    <p className="text-sm">Your active positions will appear here</p>
                  </div>
                ) : (
                  openTrades.map((trade) => (
                    <TradeCard key={trade.id} trade={trade} isOpen />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {totalClosedPnL !== 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Realized P&L</span>
                  <span className={`font-bold ${totalClosedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPnL(totalClosedPnL)}
                  </span>
                </div>
              </div>
            )}

            <ScrollArea className="h-96">
              <div className="space-y-3">
                {closedTrades.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No trade history</p>
                    <p className="text-sm">Your closed trades will appear here</p>
                  </div>
                ) : (
                  closedTrades.map((trade) => (
                    <TradeCard key={trade.id} trade={trade} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default TradeHistory
