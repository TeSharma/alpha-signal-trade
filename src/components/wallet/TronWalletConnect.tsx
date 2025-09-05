import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTronWallet } from '@/hooks/useTronWallet';
import { Wallet, RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TronWalletConnect = () => {
  const { 
    isConnected, 
    address, 
    trxBalance, 
    usdtBalance, 
    isConnecting, 
    error, 
    connectWallet, 
    disconnectWallet, 
    refreshBalances 
  } = useTronWallet();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalances();
    setIsRefreshing(false);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Tron Wallet
          </CardTitle>
          <CardDescription>
            Connect your TronLink wallet to deposit and withdraw USDT
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}
          
          <Button 
            onClick={connectWallet} 
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect TronLink
              </>
            )}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don't have TronLink installed?
            </p>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://www.tronlink.org/', '_blank')}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Get TronLink
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Tron Wallet
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Connected
          </Badge>
        </div>
        <CardDescription>
          {formatAddress(address!)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">TRX Balance</p>
            <p className="text-lg font-semibold">{trxBalance.toFixed(2)} TRX</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">USDT Balance</p>
            <p className="text-lg font-semibold">{usdtBalance.toFixed(2)} USDT</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button 
            variant="destructive" 
            onClick={disconnectWallet}
            className="flex-1"
          >
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};