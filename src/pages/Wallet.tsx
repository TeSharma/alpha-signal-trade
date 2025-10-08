import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TronWalletConnect } from '@/components/wallet/TronWalletConnect';
import WalletStatus from '@/components/wallet/WalletStatus';
import { DepositInterface } from '@/components/wallet/DepositInterface';
import { WithdrawalInterface } from '@/components/wallet/WithdrawalInterface';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { HederaWalletConnect } from '@/components/wallet/HederaWalletConnect';
import Sidebar from '@/components/layout/Sidebar';
import ResponsiveNav from '@/components/layout/ResponsiveNav';

export default function Wallet() {
  return (
    <div className="min-h-screen bg-background">
      <ResponsiveNav />
      
      <div className="flex">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        
        <main className="flex-1 lg:ml-64">
          <div className="container mx-auto p-6 max-w-4xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Wallet Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage your wallets, deposits, and withdrawals across multiple blockchains
              </p>
            </div>

            <Tabs defaultValue="wallets" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="wallets">Wallets</TabsTrigger>
                <TabsTrigger value="deposit">Deposit</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
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

              <TabsContent value="deposit" className="space-y-6">
                <DepositInterface />
              </TabsContent>

              <TabsContent value="withdraw" className="space-y-6">
                <WithdrawalInterface />
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                <TransactionHistory />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}