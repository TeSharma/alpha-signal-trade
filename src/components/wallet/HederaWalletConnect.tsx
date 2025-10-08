import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHederaWallet } from '@/hooks/useHederaWallet';
import { Wallet, RefreshCw, ExternalLink, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidHederaAccountId } from '@/lib/hedera';

export const HederaWalletConnect = () => {
  const { 
    isConnected, 
    accountId, 
    hbarBalance, 
    tokens,
    isLoading, 
    error, 
    connectHederaAccount, 
    disconnectHederaAccount, 
    refreshHederaData 
  } = useHederaWallet();

  const [inputAccountId, setInputAccountId] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleConnect = () => {
    if (!isValidHederaAccountId(inputAccountId)) {
      setValidationError('Invalid Hedera account ID format (e.g., 0.0.9961361)');
      return;
    }
    setValidationError('');
    connectHederaAccount(inputAccountId);
  };

  const formatAddress = (addr: string) => {
    return addr.length > 15 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;
  };

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Hedera Account
          </CardTitle>
          <CardDescription>
            Enter your Hedera account ID to view balance and tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="accountId">Hedera Account ID</Label>
            <Input
              id="accountId"
              placeholder="0.0.9961361"
              value={inputAccountId}
              onChange={(e) => {
                setInputAccountId(e.target.value);
                setValidationError('');
              }}
              disabled={isLoading}
            />
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
          </div>
          
          <Button 
            onClick={handleConnect} 
            disabled={isLoading || !inputAccountId}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect Account
              </>
            )}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Need a Hedera account?
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://portal.hedera.com/', '_blank')}
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              Create Account
            </Button>
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
            <CheckCircle className="h-5 w-5 text-green-600" />
            Hedera Account
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Connected
          </Badge>
        </div>
        <CardDescription>
          {formatAddress(accountId!)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">HBAR Balance</span>
            <span className="text-lg font-semibold">{hbarBalance} ℏ</span>
          </div>

          {tokens.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Token Holdings</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {tokens.map((token) => (
                  <div 
                    key={token.token_id} 
                    className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded"
                  >
                    <span className="text-muted-foreground">{token.token_id}</span>
                    <span className="font-medium">{token.balance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshHederaData}
            disabled={isLoading}
            className="flex-1"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button 
            variant="destructive" 
            onClick={disconnectHederaAccount}
            className="flex-1"
          >
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
