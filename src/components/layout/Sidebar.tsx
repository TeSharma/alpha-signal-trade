
import React from 'react';
import ResponsiveNav from "./ResponsiveNav";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { Logo } from "@/components/ui/Logo";

const Sidebar = () => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center justify-center">
          <Logo variant="full" on="light" alt="ShTrader logo" className="h-16 w-auto" />
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="p-4 border-b border-gray-200">
        <WalletConnectButton />
      </div>

      {/* Navigation Menu */}
      <ResponsiveNav />
    </div>
  );
};

export default Sidebar;
