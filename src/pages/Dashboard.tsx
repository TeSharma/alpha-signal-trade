import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Plus, RotateCcw, Zap, Eye, RefreshCw, Trophy } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import CollapsibleCard from "@/components/ui/collapsible-card";
import { useTrades, Trade } from '@/hooks/useTrades';
import { useOnChainTradingV2 } from '@/hooks/useOnChainTradingV2';
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory';
import { EquityCurveChart } from '@/components/portfolio/EquityCurveChart';
import { PortfolioStats } from '@/components/portfolio/PortfolioStats';
import { formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const navigate = useNavigate();

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
          <DesktopDashboard accountMode={accountMode} navigate={navigate} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileDashboard accountMode={accountMode} navigate={navigate} />
      </div>
    </div>
  );
};

interface DashboardProps {
  accountMode: 'demo' | 'live';
  navigate: ReturnType<typeof useNavigate>;
}

const DesktopDashboard = ({ accountMode, navigate }: DashboardProps) => {
  const { trades, accountBalance, loading, resetDemoBalance } = useTrades();
  const { getUserOpenPositions } = useOnChainTradingV2();
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [floatingPnL, setFloatingPnL] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d' | 'all'>('7d');
  
  // Use portfolio history hook
  const portfolioMetrics = usePortfolioHistory(accountMode, timeRange);

  // Fetch on-chain positions for live mode
  useEffect(() => {
    const fetchPositions = async () => {
      if (accountMode === 'live') {
        try {
          const positions = await getUserOpenPositions();
          setOpenPositionsCount(positions.length);
          // Calculate floating PnL from positions
          const totalPnL = positions.reduce((sum, pos) => {
            return sum + parseFloat(pos.currentPnL || '0');
          }, 0);
          setFloatingPnL(totalPnL);
        } catch (error) {
          console.error('Error fetching positions:', error);
        }
      } else {
        // For demo mode, count open trades from Supabase
        const openTrades = trades.filter(t => t.status === 'open' && t.account_mode === 'demo');
        setOpenPositionsCount(openTrades.length);
        const totalPnL = openTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        setFloatingPnL(totalPnL);
      }
    };
    fetchPositions();
  }, [accountMode, trades]);

  // Calculate stats
  const balance = accountMode === 'demo' 
    ? accountBalance?.demo_balance || 10000 
    : accountBalance?.live_balance || 0;
  
  const equity = balance + floatingPnL;
  
  const closedTrades = trades.filter(t => t.status === 'closed' && t.account_mode === accountMode);
  const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
  const winRate = closedTrades.length > 0 
    ? Math.round((winningTrades.length / closedTrades.length) * 100) 
    : 0;

  const recentTrades = trades
    .filter(t => t.account_mode === accountMode)
    .slice(0, 5);

  const handleResetDemo = async () => {
    setIsResetting(true);
    await resetDemoBalance();
    setIsResetting(false);
  };

  const formatPnL = (pnl: number) => {
    const formatted = Math.abs(pnl).toFixed(2);
    return pnl >= 0 ? `+$${formatted}` : `-$${formatted}`;
  };

  return (
    <main className="flex-1 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your trading activity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Account Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-500">
                    ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {accountMode === 'demo' ? 'Demo' : 'Live'} account
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{openPositionsCount}</div>
                  <p className="text-sm text-muted-foreground mt-1">Currently active</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-blue-500">
                    ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Balance + floating P&L</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Floating P&L</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${floatingPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatPnL(floatingPnL)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Unrealized from open trades</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Recent Trades</CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate('/trade')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No trades yet</p>
                  <Button className="mt-4" onClick={() => navigate('/trade')}>
                    Start Trading
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Pair</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">P&L</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {recentTrades.map((trade) => (
                        <tr key={trade.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-foreground">{trade.pair}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={trade.direction === 'buy' ? 'default' : 'destructive'}>
                              {trade.direction.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {formatPnL(trade.pnl || 0)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={trade.status === 'open' ? 'outline' : 'secondary'}>
                              {trade.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Button onClick={() => navigate('/trade')}>
                <Plus className="h-4 w-4 mr-2" />
                Start Trade
              </Button>
              <Button variant="secondary" onClick={() => navigate('/signals')}>
                <Zap className="h-4 w-4 mr-2" />
                View Signals
              </Button>
              {accountMode === 'demo' && (
                <Button 
                  variant="outline" 
                  onClick={handleResetDemo}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Reset Demo
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Win Rate</span>
                    <div className="flex items-center gap-2">
                      <Trophy className={`h-4 w-4 ${winRate >= 50 ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span className="font-bold">{winRate}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Trades</span>
                    <span className="font-bold">{closedTrades.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Today's P&L</span>
                    <span className={`font-bold ${(accountBalance?.today_pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatPnL(accountBalance?.today_pnl || 0)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

const MobileDashboard = ({ accountMode, navigate }: DashboardProps) => {
  const { trades, accountBalance, loading, resetDemoBalance } = useTrades();
  const { getUserOpenPositions } = useOnChainTradingV2();
  const [openPositionsCount, setOpenPositionsCount] = useState(0);
  const [floatingPnL, setFloatingPnL] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const fetchPositions = async () => {
      if (accountMode === 'live') {
        try {
          const positions = await getUserOpenPositions();
          setOpenPositionsCount(positions.length);
          const totalPnL = positions.reduce((sum, pos) => {
            return sum + parseFloat(pos.currentPnL || '0');
          }, 0);
          setFloatingPnL(totalPnL);
        } catch (error) {
          console.error('Error fetching positions:', error);
        }
      } else {
        const openTrades = trades.filter(t => t.status === 'open' && t.account_mode === 'demo');
        setOpenPositionsCount(openTrades.length);
        const totalPnL = openTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        setFloatingPnL(totalPnL);
      }
    };
    fetchPositions();
  }, [accountMode, trades]);

  const balance = accountMode === 'demo' 
    ? accountBalance?.demo_balance || 10000 
    : accountBalance?.live_balance || 0;
  
  const equity = balance + floatingPnL;

  const recentTrades = trades
    .filter(t => t.account_mode === accountMode)
    .slice(0, 5);

  const handleResetDemo = async () => {
    setIsResetting(true);
    await resetDemoBalance();
    setIsResetting(false);
  };

  const formatPnL = (pnl: number) => {
    const formatted = Math.abs(pnl).toFixed(2);
    return pnl >= 0 ? `+$${formatted}` : `-$${formatted}`;
  };

  return (
    <main className="p-4 space-y-4">
      {/* Account Summary Card */}
      <CollapsibleCard title="Account Summary" defaultOpen={true}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">
                  ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">Balance</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">{openPositionsCount}</p>
                <p className="text-sm text-muted-foreground">Open Positions</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="text-center">
                <p className="text-lg font-semibold text-blue-500">
                  ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Equity</p>
              </div>
              <div className="text-center">
                <p className={`text-lg font-semibold ${floatingPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPnL(floatingPnL)}
                </p>
                <p className="text-xs text-muted-foreground">Floating P&L</p>
              </div>
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Button className="h-12 flex flex-col gap-1" size="lg" onClick={() => navigate('/trade')}>
              <Plus className="h-5 w-5" />
              <span className="text-sm">Start Trade</span>
            </Button>
            <Button variant="outline" className="h-12 flex flex-col gap-1" size="lg" onClick={() => navigate('/signals')}>
              <Zap className="h-5 w-5" />
              <span className="text-sm">View Signals</span>
            </Button>
            {accountMode === 'demo' && (
              <>
                <Button 
                  variant="secondary" 
                  className="h-12 flex flex-col gap-1" 
                  size="lg"
                  onClick={handleResetDemo}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-5 w-5" />
                  )}
                  <span className="text-sm">Reset Demo</span>
                </Button>
                <Button variant="outline" className="h-12 flex flex-col gap-1" size="lg" onClick={() => navigate('/trade')}>
                  <Eye className="h-5 w-5" />
                  <span className="text-sm">View History</span>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Trades */}
      <CollapsibleCard title="Recent Trades" defaultOpen={true}>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recentTrades.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No trades yet</p>
            <Button size="sm" className="mt-3" onClick={() => navigate('/trade')}>
              Start Trading
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentTrades.map((trade) => (
              <div key={trade.id} className="bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{trade.pair}</p>
                    <p className="text-sm text-muted-foreground">
                      {trade.direction.toUpperCase()} • {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatPnL(trade.pnl || 0)}
                    </p>
                    <Badge variant={trade.status === 'open' ? 'outline' : 'secondary'} className="text-xs">
                      {trade.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>

      {/* Announcements */}
      <CollapsibleCard title="Announcements">
        <div className="space-y-2">
          <div className="bg-blue-500/10 border-l-4 border-blue-500 p-3 rounded">
            <p className="text-sm text-blue-700 dark:text-blue-300">📈 V2 Trading Platform is now live on Polygon Amoy testnet!</p>
          </div>
          <div className="bg-green-500/10 border-l-4 border-green-500 p-3 rounded">
            <p className="text-sm text-green-700 dark:text-green-300">🎓 Get test tUSD from the Wallet page to start trading</p>
          </div>
        </div>
      </CollapsibleCard>
    </main>
  );
};

export default Dashboard;
