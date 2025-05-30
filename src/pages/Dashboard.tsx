import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, RotateCcw, Zap, Eye } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import CollapsibleCard from "@/components/ui/collapsible-card";

const Dashboard = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  const mockTrades = [
    { id: 1, pair: 'GBP/JPY', type: 'Buy', pnl: '+$45.20', status: 'Open', time: '2h ago' },
    { id: 2, pair: 'EUR/USD', type: 'Sell', pnl: '-$12.50', status: 'Closed', time: '5h ago' },
    { id: 3, pair: 'USD/JPY', type: 'Buy', pnl: '+$78.90', status: 'Closed', time: '1d ago' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
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
          <DesktopDashboard accountMode={accountMode} mockTrades={mockTrades} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileDashboard accountMode={accountMode} mockTrades={mockTrades} />
      </div>
    </div>
  );
};

const DesktopDashboard = ({ accountMode, mockTrades }: any) => (
  <main className="flex-1 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your trading activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${accountMode === 'demo' ? '1,000.00' : '2,547.83'}
            </div>
            <p className="text-sm text-gray-500">Current balance in your {accountMode} account</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-sm text-gray-500">Number of currently open trades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">$2,680.45</div>
            <p className="text-sm text-gray-500">Total value of your account</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Floating P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">$132.62</div>
            <p className="text-sm text-gray-500">Unrealized profit or loss from open trades</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Trades</CardTitle>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pair
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P&L
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mockTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{trade.pair}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{trade.type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${trade.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.pnl}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={trade.status === 'Open' ? 'default' : 'secondary'}>
                          {trade.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Start Trade
            </Button>
            <Button variant="secondary">
              <Zap className="h-4 w-4 mr-2" />
              View Signals
            </Button>
            {accountMode === 'demo' && (
              <Button variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Demo
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Stay up-to-date with the latest market news and platform updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  </main>
);

const MobileDashboard = ({ accountMode, mockTrades }: any) => (
  <main className="p-4 space-y-4">
    {/* Account Summary Card */}
    <CollapsibleCard title="Account Summary" defaultOpen={true}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">
              ${accountMode === 'demo' ? '1,000.00' : '2,547.83'}
            </p>
            <p className="text-sm text-gray-600">Balance</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">3</p>
            <p className="text-sm text-gray-600">Open Positions</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-500">$2,680.45</p>
            <p className="text-xs text-gray-600">Equity</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-orange-500">$132.62</p>
            <p className="text-xs text-gray-600">Floating P&L</p>
          </div>
        </div>
      </div>
    </CollapsibleCard>

    {/* Quick Actions */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-12 flex flex-col gap-1" size="lg">
            <Plus className="h-5 w-5" />
            <span className="text-sm">Start Trade</span>
          </Button>
          <Button variant="outline" className="h-12 flex flex-col gap-1" size="lg">
            <Zap className="h-5 w-5" />
            <span className="text-sm">View Signals</span>
          </Button>
          {accountMode === 'demo' && (
            <>
              <Button variant="secondary" className="h-12 flex flex-col gap-1" size="lg">
                <RotateCcw className="h-5 w-5" />
                <span className="text-sm">Reset Demo</span>
              </Button>
              <Button variant="outline" className="h-12 flex flex-col gap-1" size="lg">
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
      <div className="space-y-3">
        {mockTrades.map((trade: any) => (
          <div key={trade.id} className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold">{trade.pair}</p>
                <p className="text-sm text-gray-600">{trade.type} • {trade.time}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${trade.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {trade.pnl}
                </p>
                <Badge variant={trade.status === 'Open' ? 'default' : 'secondary'} className="text-xs">
                  {trade.status}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>

    {/* Announcements */}
    <CollapsibleCard title="Announcements">
      <div className="space-y-2">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
          <p className="text-sm text-blue-800">📈 New GBP/JPY signals available with 85% accuracy rate</p>
        </div>
        <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
          <p className="text-sm text-green-800">🎓 Weekly mentorship session starts tomorrow at 3 PM UTC</p>
        </div>
      </div>
    </CollapsibleCard>
  </main>
);

export default Dashboard;
