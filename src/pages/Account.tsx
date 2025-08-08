import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Settings, Shield, Palette, Bell } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import { UserProfile } from "@/components/settings/UserProfile";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import WalletStatus from "@/components/wallet/WalletStatus";

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
      <WalletStatus />

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
