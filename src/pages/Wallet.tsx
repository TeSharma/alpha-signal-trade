import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TronWalletConnect } from '@/components/wallet/TronWalletConnect';
import WalletStatus from '@/components/wallet/WalletStatus';
import { DepositInterface } from '@/components/wallet/DepositInterface';
import { WithdrawalInterface } from '@/components/wallet/WithdrawalInterface';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { HederaWalletConnect } from '@/components/wallet/HederaWalletConnect';
import MobileWallet from '@/components/wallet/MobileWallet';
import { useApp } from '@/contexts/AppContext';
import MobileHeader from '@/components/layout/MobileHeader';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function Wallet() {
  const { state } = useApp();
  const isDemo = state.accountMode === 'demo';
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <MobileHeader 
        accountMode={accountMode} 
        onAccountModeChange={setAccountMode}
      />

      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar accountMode={accountMode} />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Wallet Management</h1>
                <p className="text-muted-foreground">Manage your wallets, deposits, and withdrawals across multiple blockchains</p>
              </div>

              <Tabs defaultValue="wallets" className="space-y-6">
                <TabsList className={`grid w-full ${isDemo ? 'grid-cols-5' : 'grid-cols-4'}`}>
                  <TabsTrigger value="wallets">Wallets</TabsTrigger>
                  <TabsTrigger value="tokens">Tokens</TabsTrigger>
                  <TabsTrigger value="deposit">Deposit</TabsTrigger>
                  <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                  {isDemo && <TabsTrigger value="history">History</TabsTrigger>}
                </TabsList>

                <TabsContent value="wallets" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Ethereum L2 (Polygon)</h2>
                      <WalletStatus />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Tron Network</h2>
                      <TronWalletConnect />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Hedera Network</h2>
                      <HederaWalletConnect />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tokens" className="space-y-6">
                  <TokenBalances />
                  {isDemo && <TUSDFaucet />}
                </TabsContent>

                <TabsContent value="deposit" className="space-y-6">
                  <DepositInterface />
                </TabsContent>

                <TabsContent value="withdraw" className="space-y-6">
                  <WithdrawalInterface />
                </TabsContent>

                {isDemo && (
                  <TabsContent value="history" className="space-y-6">
                    <TransactionHistory />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileWallet />
      </div>
    </div>
  );
}
