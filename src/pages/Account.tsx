import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Wallet, Shield, Bell, RefreshCw, History } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import TradeHistory from "@/components/trading/TradeHistory";
import CollapsibleCard from "@/components/ui/collapsible-card";

const Account = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

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
          <DesktopAccount accountMode={accountMode} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileAccount accountMode={accountMode} />
      </div>
    </div>
  );
};

const DesktopAccount = ({ accountMode }: { accountMode: 'demo' | 'live' }) => (
  <main className="flex-1 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account</h1>
        <p className="text-gray-600">Manage your profile, security, and preferences</p>
      </div>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input type="text" id="username" defaultValue="johndoe" disabled />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input type="email" id="email" defaultValue="john.doe@example.com" disabled />
            </div>
          </div>
          <div className="mt-4">
            <Button>
              <RefreshCw className="h-4 w-4 mr-2" />
              Update Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-none">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Switch id="2fa" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-none">Password Reset</p>
              <p className="text-sm text-muted-foreground">
                Update your password regularly to keep your account safe
              </p>
            </div>
            <Button variant="outline" size="sm">
              Reset Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-none">Market Updates</p>
              <p className="text-sm text-muted-foreground">
                Receive updates on market trends and trading opportunities
              </p>
            </div>
            <Switch id="market-updates" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-none">Account Activity</p>
              <p className="text-sm text-muted-foreground">
                Get notified about logins and other account changes
              </p>
            </div>
            <Switch id="account-activity" defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Trade History */}
      <TradeHistory accountMode={accountMode} />
    </div>
  </main>
);

const MobileAccount = ({ accountMode }: { accountMode: 'demo' | 'live' }) => (
  <main className="p-4 space-y-4">
    {/* Profile Section */}
    <CollapsibleCard title="Profile">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <User className="h-10 w-10 rounded-full bg-gray-200 p-2" />
          <div>
            <h4 className="font-semibold">John Doe</h4>
            <p className="text-sm text-gray-500">john.doe@example.com</p>
          </div>
        </div>
        <Button className="w-full">Update Profile</Button>
      </div>
    </CollapsibleCard>

    {/* Security Section */}
    <CollapsibleCard title="Security">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Two-Factor Authentication</span>
          <Switch id="2fa-mobile" />
        </div>
        <Button variant="outline" className="w-full">Reset Password</Button>
      </div>
    </CollapsibleCard>

    {/* Notification Settings */}
    <CollapsibleCard title="Notifications">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Market Updates</span>
          <Switch id="market-updates-mobile" />
        </div>
        <div className="flex items-center justify-between">
          <span>Account Activity</span>
          <Switch id="account-activity-mobile" defaultChecked />
        </div>
      </div>
    </CollapsibleCard>

    {/* Trade History */}
    <CollapsibleCard title="Trade History">
      <TradeHistory accountMode={accountMode} />
    </CollapsibleCard>

    {/* Bottom padding */}
    <div className="h-4"></div>
  </main>
);

export default Account;
