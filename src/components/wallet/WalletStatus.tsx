import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";

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

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 1: return 'Ethereum Mainnet';
      case 5: return 'Goerli Testnet';
      case 11155111: return 'Sepolia Testnet';
      case 137: return 'Polygon Mainnet';
      case 80001: return 'Polygon Mumbai';
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
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
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
            <Badge variant="outline" className="text-xs">
              {getNetworkName(chainId)}
            </Badge>
          </div>
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