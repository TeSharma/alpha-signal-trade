
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";

interface AccountBalanceProps {
  accountMode: 'demo' | 'live';
  onModeChange: (mode: 'demo' | 'live') => void;
}

const AccountBalance = ({ accountMode, onModeChange }: AccountBalanceProps) => {
  const demoBalance = 1000.00;
  const liveBalance = 2547.83;
  const currentBalance = accountMode === 'demo' ? demoBalance : liveBalance;

  const handleModeToggle = () => {
    onModeChange(accountMode === 'demo' ? 'live' : 'demo');
  };

  const handleResetDemo = () => {
    if (accountMode === 'demo') {
      // Reset demo account logic would go here
      console.log('Demo account reset to $1000');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balance
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className={`text-sm ${accountMode === 'demo' ? 'font-semibold' : 'text-gray-500'}`}>
                Demo
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleModeToggle}
                className="p-1 h-auto"
              >
                {accountMode === 'demo' ? (
                  <ToggleLeft className="h-6 w-6 text-blue-500" />
                ) : (
                  <ToggleRight className="h-6 w-6 text-green-500" />
                )}
              </Button>
              <span className={`text-sm ${accountMode === 'live' ? 'font-semibold' : 'text-gray-500'}`}>
                Live
              </span>
            </div>

            {/* Reset Demo Button */}
            {accountMode === 'demo' && (
              <Button variant="outline" size="sm" onClick={handleResetDemo}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Demo
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">${currentBalance.toFixed(2)}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={accountMode === 'demo' ? 'default' : 'destructive'}>
                  {accountMode === 'demo' ? 'Demo Account' : 'Live Account'}
                </Badge>
                <span className="text-sm text-gray-500">USDC</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Today's P&L</p>
              <p className="text-lg font-semibold text-green-500">+$23.45</p>
            </div>
          </div>

          {accountMode === 'live' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Live Trading:</strong> Real funds at risk. Trade responsibly.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AccountBalance;
