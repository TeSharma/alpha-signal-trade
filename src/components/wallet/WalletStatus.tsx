import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useNetworkEnforcement } from "@/hooks/useNetworkEnforcement";

const WalletStatus = () => {
  const { 
    isConnected, 
    account, 
    balance, 
    chainId, 
    isConnecting, 
    error,
    connectWallet, 
    disconnectWallet, 
    refreshBalance 
  } = useWallet();
  const { isCorrectNetwork, networkName, switchToAmoy } = useNetworkEnforcement();

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 1: return 'Ethereum Mainnet';
      case 5: return 'Goerli Testnet';
      case 11155111: return 'Sepolia Testnet';
      case 137: return 'Polygon Mainnet';
      case 80001: return 'Polygon Mumbai';
      case 80002: return 'Polygon Amoy';
      default: return `Chain ID: ${chainId}`;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
              {error.includes('install') && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-2">Popular Web3 Wallets:</p>
                  <div className="space-y-1">
                    <a 
                      href="https://metamask.io/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-blue-600 hover:text-blue-800"
                    >
                      • MetaMask (Browser Extension)
                    </a>
                    <a 
                      href="https://www.coinbase.com/wallet" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-blue-600 hover:text-blue-800"
                    >
                      • Coinbase Wallet
                    </a>
                    <a 
                      href="https://walletconnect.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-blue-600 hover:text-blue-800"
                    >
                      • WalletConnect
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Connect your wallet to start trading with real funds.
          </p>
          <Button 
            onClick={connectWallet} 
            disabled={isConnecting}
            className="w-full"
          >
            <Wallet className="h-4 w-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Wallet Connected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Address:</span>
            <span className="text-sm font-mono">{formatAddress(account!)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Balance:</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{balance} ETH</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refreshBalance}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Network:</span>
            <Badge variant={isCorrectNetwork ? "outline" : "destructive"} className="text-xs">
              {getNetworkName(chainId)}
            </Badge>
          </div>

          {!isCorrectNetwork && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Wrong network</span>
              <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={switchToAmoy}>
                Switch to Amoy
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={disconnectWallet}
            className="flex-1"
          >
            Disconnect
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshBalance}
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletStatus;