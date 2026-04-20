import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Settings, Shield, Palette, Bell, RotateCcw } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import { UserProfile } from "@/components/settings/UserProfile";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import WalletStatus from "@/components/wallet/WalletStatus";
import { TronWalletConnect } from "@/components/wallet/TronWalletConnect";
import { useTrades } from "@/hooks/useTrades";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ResetDemoCard = () => {
  const { resetDemoBalance, accountBalance } = useTrades();
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    await resetDemoBalance();
    setResetting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Demo Account
        </CardTitle>
        <CardDescription>
          Current demo balance:{" "}
          <span className="font-semibold text-foreground">
            ${(accountBalance?.demo_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={resetting}>
              {resetting ? "Resetting..." : "Reset Demo Account"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset demo account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel all open demo trades, restore your demo balance to $10,000, and zero out total &amp; today PnL. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

const Account = () => {
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
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account, security, and preferences</p>
      </div>

      {/* Wallet Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WalletStatus />
        <TronWalletConnect />
      </div>

      <ResetDemoCard />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <UserProfile />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  </main>
);

const MobileAccount = ({ accountMode }: { accountMode: 'demo' | 'live' }) => (
  <main className="p-4 space-y-4">
    <ResetDemoCard />
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="profile" className="text-xs">
          <User className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="security" className="text-xs">
          <Shield className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="notifications" className="text-xs">
          <Bell className="h-4 w-4" />
        </TabsTrigger>
        <TabsTrigger value="appearance" className="text-xs">
          <Palette className="h-4 w-4" />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <UserProfile />
      </TabsContent>

      <TabsContent value="security">
        <SecuritySettings />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationPreferences />
      </TabsContent>

      <TabsContent value="appearance">
        <AppearanceSettings />
      </TabsContent>
    </Tabs>

    {/* Bottom padding for mobile navigation */}
    <div className="h-16"></div>
  </main>
);

export default Account;
