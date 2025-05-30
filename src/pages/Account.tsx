import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { User, Wallet, RotateCcw, History, Settings, Shield } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import CollapsibleCard from "@/components/ui/collapsible-card";

const Account = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const [emailNotifications, setEmailNotifications] = useState(true);

  const tradeHistory = [
    { id: 1, pair: 'EUR/USD', type: 'Buy', lot: '0.1', pnl: '+$45.20', date: '2024-01-15', status: 'Closed' },
    { id: 2, pair: 'GBP/JPY', type: 'Sell', lot: '0.05', pnl: '-$12.50', date: '2024-01-14', status: 'Closed' },
    { id: 3, pair: 'USD/JPY', type: 'Buy', lot: '0.2', pnl: '+$78.90', date: '2024-01-13', status: 'Closed' },
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
          <DesktopAccount tradeHistory={tradeHistory} emailNotifications={emailNotifications} setEmailNotifications={setEmailNotifications} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileAccount tradeHistory={tradeHistory} emailNotifications={emailNotifications} setEmailNotifications={setEmailNotifications} />
      </div>
    </div>
  );
};

const DesktopAccount = ({ tradeHistory, emailNotifications, setEmailNotifications }: any) => (
  <main className="flex-1 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600">Manage your profile, security, and trading preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-gray-600">trader@example.com</p>
            </div>
            <div>
              <label className="text-sm font-medium">Username</label>
              <p className="text-gray-600">@cryptotrader123</p>
            </div>
            <div>
              <label className="text-sm font-medium">Member Since</label>
              <p className="text-gray-600">January 2024</p>
            </div>
            <Button variant="outline" className="w-full">
              Edit Profile
            </Button>
          </CardContent>
        </Card>

        {/* Wallet Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Connected Wallet</label>
              <p className="text-gray-600 text-xs font-mono">0x1234...5678</p>
              <Badge variant="outline" className="mt-1">Connected</Badge>
            </div>
            <div>
              <label className="text-sm font-medium">Network</label>
              <p className="text-gray-600">Arbitrum One</p>
            </div>
            <Button variant="outline" className="w-full">
              Disconnect Wallet
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Password</label>
              <p className="text-gray-600">••••••••</p>
            </div>
            <div>
              <label className="text-sm font-medium">Two-Factor Auth</label>
              <Badge variant="secondary">Not Enabled</Badge>
            </div>
            <Button variant="outline" className="w-full">
              Change Password
            </Button>
            <Button variant="outline" className="w-full">
              Enable 2FA
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Demo Account Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Demo Account Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Reset Demo Balance</p>
              <p className="text-sm text-gray-600">Reset your demo account balance back to $1,000 USDC</p>
            </div>
            <Button variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Demo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Complete Trade History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TradeHistory accountMode={accountMode} />
        </CardContent>
      </Card>
    </div>
  </main>
);

const MobileAccount = ({ tradeHistory, emailNotifications, setEmailNotifications }: any) => (
  <main className="p-4 space-y-4">
    {/* User Profile */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value="trader@example.com" disabled />
        </div>
        <div className="space-y-2">
          <Label>Username</Label>
          <Input value="trader_123" />
        </div>
        <div className="space-y-2">
          <Label>Region</Label>
          <Input value="United States" />
        </div>
        <Button className="w-full">Update Profile</Button>
      </CardContent>
    </Card>

    {/* Demo Account Controls */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Demo Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800 mb-2">
            Demo Balance: <span className="font-bold">$1,000.00</span>
          </p>
          <p className="text-xs text-yellow-700">
            Reset your demo account to start fresh with $1,000
          </p>
        </div>
        <Button variant="outline" className="w-full h-12">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Demo Account
        </Button>
      </CardContent>
    </Card>

    {/* Preferences */}
    <CollapsibleCard title="Preferences">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Email Notifications</Label>
            <p className="text-xs text-gray-500">Receive trade alerts and updates</p>
          </div>
          <Switch 
            checked={emailNotifications} 
            onCheckedChange={setEmailNotifications}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Signal Notifications</Label>
            <p className="text-xs text-gray-500">Get notified of new trading signals</p>
          </div>
          <Switch defaultChecked />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Newsletter</Label>
            <p className="text-xs text-gray-500">Weekly market analysis and tips</p>
          </div>
          <Switch defaultChecked />
        </div>
      </div>
    </CollapsibleCard>

    {/* Wallet Info */}
    <CollapsibleCard title="Wallet Information">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Wallet Status</span>
            <Badge variant="outline">Not Connected</Badge>
          </div>
          <p className="text-xs text-gray-600">Connect your wallet to start live trading</p>
        </div>
        
        <Button className="w-full h-12">
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Network</p>
            <p className="font-semibold">Arbitrum</p>
          </div>
          <div>
            <p className="text-gray-600">USDC Balance</p>
            <p className="font-semibold">$0.00</p>
          </div>
        </div>
      </div>
    </CollapsibleCard>

    {/* Trade History */}
    <CollapsibleCard title="Trade History">
      <div className="space-y-3">
        {tradeHistory.map((trade: any) => (
          <div key={trade.id} className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold">{trade.pair}</p>
                <p className="text-sm text-gray-600">{trade.type} • {trade.lot} lot</p>
                <p className="text-xs text-gray-500">{trade.date}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${trade.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {trade.pnl}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {trade.status}
                </Badge>
              </div>
            </div>
          </div>
        ))}
        
        <Button variant="outline" className="w-full mt-3">
          <History className="h-4 w-4 mr-2" />
          View Full History
        </Button>
      </div>
    </CollapsibleCard>

    {/* Security Settings */}
    <CollapsibleCard title="Security Settings">
      <div className="space-y-4">
        <Button variant="outline" className="w-full justify-start">
          <Shield className="h-4 w-4 mr-2" />
          Change Password
        </Button>
        
        <Button variant="outline" className="w-full justify-start">
          <Settings className="h-4 w-4 mr-2" />
          Session Management
        </Button>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 Enable 2FA for enhanced security (coming soon)
          </p>
        </div>
      </div>
    </CollapsibleCard>

    {/* Bottom padding */}
    <div className="h-4"></div>
  </main>
);

export default Account;
