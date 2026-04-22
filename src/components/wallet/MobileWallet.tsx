import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Plus, ArrowLeft, TrendingUp, TrendingDown, Users } from 'lucide-react';
import WalletStatus from '@/components/wallet/WalletStatus';
import { TronWalletConnect } from '@/components/wallet/TronWalletConnect';
import { HederaWalletConnect } from '@/components/wallet/HederaWalletConnect';
import { TokenBalances } from '@/components/trading/TokenBalances';
import { DepositInterface } from '@/components/wallet/DepositInterface';
import { WithdrawalInterface } from '@/components/wallet/WithdrawalInterface';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import TUSDFaucet from '@/components/wallet/TUSDFaucet';
import { useApp } from '@/contexts/AppContext';

const MobileWallet = () => {
  const { state } = useApp();
  const isDemo = state.accountMode === 'demo';
  const [activeTab, setActiveTab] = useState<'wallets' | 'tokens' | 'deposit' | 'withdraw' | 'history'>('wallets');

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-0 h-8 w-8"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground">Manage your assets</p>
        </div>
      </div>

      <Tabs defaultValue="wallets" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 gap-2">
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          {isDemo && <TabsTrigger value="withdraw">Withdraw</TabsTrigger>}
          {isDemo && <TabsTrigger value="history">History</TabsTrigger>}
        </TabsList>

        <TabsContent value="wallets" className="space-y-4">
          <Card>
            <div className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Ethereum L2 (Polygon)</h2>
              <WalletStatus />
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Tron Network</h2>
              <TronWalletConnect />
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Hedera Network</h2>
              <HederaWalletConnect />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          <Card>
            <div className="p-4">
              <TokenBalances />
              {isDemo && <TUSDFaucet />}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="deposit" className="space-y-4">
          <Card>
            <div className="p-4">
              <DepositInterface />
            </div>
          </Card>
        </TabsContent>

        {isDemo && (
          <TabsContent value="withdraw" className="space-y-4">
            <Card>
              <div className="p-4">
                <WithdrawalInterface />
              </div>
            </Card>
          </TabsContent>
        )}

        {isDemo && (
          <TabsContent value="history" className="space-y-4">
            <Card>
              <div className="p-4">
                <TransactionHistory />
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Bottom padding */}
      <div className="h-16"></div>
    </main>
  );
};

export default MobileWallet;