import { useState, useEffect } from 'react'

// Mock real-time price data
const INITIAL_PRICES = {
  'GBP/JPY': 188.25,
  'EUR/USD': 1.0842,
  'USD/JPY': 149.75,
  'GBP/USD': 1.2567,
  'AUD/USD': 0.6745,
  'USD/CAD': 1.3412,
  'EUR/GBP': 0.8632,
  'CHF/USD': 1.1025,
  'NZD/USD': 0.6234,
  'USD/CHF': 0.9068
}

export interface MarketPrice {
  pair: string
  price: number
  change: number
  changePercent: number
  volume: string
  bid: number
  ask: number
  spread: number
  high24h: number
  low24h: number
  lastUpdate: Date
}

export const useMarketData = () => {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({})
  const [isConnected, setIsConnected] = useState(false)

  const generateRandomPrice = (basePrice: number, volatility = 0.001) => {
    const change = (Math.random() - 0.5) * 2 * volatility * basePrice
    return Math.max(basePrice + change, basePrice * 0.95) // Prevent prices from going too low
  }

  const updatePrices = () => {
    setPrices(prev => {
      const newPrices = { ...prev }
      
      Object.keys(INITIAL_PRICES).forEach(pair => {
        const basePrice = INITIAL_PRICES[pair as keyof typeof INITIAL_PRICES]
        const currentPrice = prev[pair]?.price || basePrice
        
        // Generate new price with some volatility
        const newPrice = generateRandomPrice(currentPrice, 0.0005)
        const change = newPrice - basePrice
        const changePercent = (change / basePrice) * 100
        
        // Calculate bid/ask with spread
        const spread = newPrice * 0.0001 // 1 pip spread
        const bid = newPrice - spread / 2
        const ask = newPrice + spread / 2
        
        newPrices[pair] = {
          pair,
          price: Number(newPrice.toFixed(5)),
          change: Number(change.toFixed(5)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: `${(Math.random() * 5 + 1).toFixed(1)}B`,
          bid: Number(bid.toFixed(5)),
          ask: Number(ask.toFixed(5)),
          spread: Number((ask - bid).toFixed(5)),
          high24h: Number((newPrice * (1 + Math.random() * 0.02)).toFixed(5)),
          low24h: Number((newPrice * (1 - Math.random() * 0.02)).toFixed(5)),
          lastUpdate: new Date()
        }
      })
      
      return newPrices
    })
  }

  const getPrice = (pair: string): MarketPrice | null => {
    return prices[pair] || null
  }

  const getCurrentPrice = (pair: string): number => {
    return prices[pair]?.price || INITIAL_PRICES[pair as keyof typeof INITIAL_PRICES] || 0
  }

  const getBidPrice = (pair: string): number => {
    return prices[pair]?.bid || getCurrentPrice(pair)
  }

  const getAskPrice = (pair: string): number => {
    return prices[pair]?.ask || getCurrentPrice(pair)
  }

  useEffect(() => {
    // Initialize prices
    updatePrices()
    setIsConnected(true)

    // Update prices every 1-3 seconds (simulate real market)
    const interval = setInterval(() => {
      updatePrices()
    }, Math.random() * 2000 + 1000)

    return () => {
      clearInterval(interval)
      setIsConnected(false)
    }
  }, [])

  return {
    prices: Object.values(prices),
    pricesMap: prices,
    isConnected,
    getPrice,
    getCurrentPrice,
    getBidPrice,
    getAskPrice,
    updatePrices
  }
}