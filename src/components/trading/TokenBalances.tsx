import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, RefreshCw } from 'lucide-react';
import { useTokenContracts } from '@/hooks/useTokenContracts';
import { Skeleton } from '@/components/ui/skeleton';

export const TokenBalances = () => {
  const { 
    account, 
    balances, 
    isLoading, 
    connectWallet, 
    getAllTokenBalances 
  } = useTokenContracts();

  useEffect(() => {
    if (account) {
      getAllTokenBalances();
    }
  }, [account]);

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  if (!account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Tokenized Currency Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Connect your wallet to view tokenized currency balances
            </p>
            <Button onClick={handleConnect}>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Tokenized Currency Balances
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={getAllTokenBalances}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </>
          ) : balances.length > 0 ? (
            balances.map((token) => (
              <div 
                key={token.symbol} 
                className="flex justify-between items-center py-2 border-b border-border last:border-0"
              >
                <span className="font-medium text-foreground">{token.symbol}</span>
                <span className="text-muted-foreground">
                  {parseFloat(token.balance).toFixed(2)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No token balances found
            </p>
          )}
          
          <div className="pt-4 mt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Connected: {account.slice(0, 6)}...{account.slice(-4)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
