
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { DollarSign, TrendingUp, TrendingDown, Eye, EyeOff, Wallet } from "lucide-react"
import { useTrades } from '@/hooks/useTrades'
import { useApp } from '@/contexts/AppContext'

interface AccountBalanceProps {
  accountMode: 'demo' | 'live'
  onModeChange: (mode: 'demo' | 'live') => void
}

const AccountBalance = ({ accountMode, onModeChange }: AccountBalanceProps) => {
  const { accountBalance } = useTrades()
  const { state } = useApp()
  const [showBalance, setShowBalance] = useState(true)

  const currentBalance = accountMode === 'demo' 
    ? (accountBalance?.demo_balance || 10000)
    : (accountBalance?.live_balance || 0)

  const totalPnL = accountBalance?.total_pnl || 0
  const todayPnL = accountBalance?.today_pnl || 0
  const isProfitable = totalPnL >= 0
  const isTodayProfitable = todayPnL >= 0

  // Calculate risk percentage (used balance vs total balance)
  const initialBalance = accountMode === 'demo' ? 10000 : 0
  const riskPercentage = initialBalance > 0 ? Math.max(0, (initialBalance - currentBalance) / initialBalance * 100) : 0

  const formatCurrency = (amount: number) => {
    if (!showBalance) return '****'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatPnL = (amount: number) => {
    if (!showBalance) return '****'
    const formatted = Math.abs(amount).toFixed(2)
    return amount >= 0 ? `+$${formatted}` : `-$${formatted}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balance
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBalance(!showBalance)}
          >
            {showBalance ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Mode Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Demo Account</span>
            <Badge variant="outline" className="text-xs">
              Risk-free
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${accountMode === 'live' ? 'font-semibold' : 'text-gray-500'}`}>
              Live
            </span>
            <Switch
              checked={accountMode === 'demo'}
              onCheckedChange={(checked) => onModeChange(checked ? 'demo' : 'live')}
            />
            <span className={`text-sm ${accountMode === 'demo' ? 'font-semibold' : 'text-gray-500'}`}>
              Demo
            </span>
          </div>
        </div>

        {/* Current Balance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Balance</span>
            <Badge variant={accountMode === 'demo' ? 'default' : 'destructive'}>
              {accountMode.toUpperCase()}
            </Badge>
          </div>
          <div className="text-3xl font-bold">
            {formatCurrency(currentBalance)}
          </div>
          
          {/* Wallet Connection Status */}
          {accountMode === 'live' && (
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${state.isWalletConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={state.isWalletConnected ? 'text-green-600' : 'text-red-600'}>
                {state.isWalletConnected ? 'Wallet Connected' : 'Wallet Not Connected'}
              </span>
            </div>
          )}
        </div>

        {/* P&L Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              {isTodayProfitable ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm text-gray-600">Today's P&L</span>
            </div>
            <div className={`font-semibold ${isTodayProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatPnL(todayPnL)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              {isProfitable ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm text-gray-600">Total P&L</span>
            </div>
            <div className={`font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatPnL(totalPnL)}
            </div>
          </div>
        </div>

        {/* Risk Meter */}
        {accountMode === 'demo' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Risk Level</span>
              <span className={`font-medium ${
                riskPercentage < 20 ? 'text-green-600' : 
                riskPercentage < 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {riskPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={riskPercentage} 
              className="h-2"
            />
            <div className="text-xs text-gray-500">
              {riskPercentage < 20 ? 'Low Risk' : 
               riskPercentage < 50 ? 'Moderate Risk' : 'High Risk'}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="pt-4 border-t space-y-2">
          <div className="text-sm font-medium text-gray-700">Quick Stats</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Initial Balance</span>
              <div className="font-medium">
                {formatCurrency(accountMode === 'demo' ? 10000 : 0)}
              </div>
            </div>
            <div>
              <span className="text-gray-500">ROI</span>
              <div className={`font-medium ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                {showBalance ? (
                  accountMode === 'demo' ? 
                    `${((totalPnL / 10000) * 100).toFixed(2)}%` : 
                    'N/A'
                ) : '****'}
              </div>
            </div>
          </div>
        </div>

        {/* Live Account Warning */}
        {accountMode === 'live' && !state.isWalletConnected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Connect Wallet</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Connect your wallet to start live trading with real funds
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AccountBalance
