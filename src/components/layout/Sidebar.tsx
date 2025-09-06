
import React from 'react';
import ResponsiveNav from "./ResponsiveNav";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";

const Sidebar = () => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center justify-center">
          <img 
            src="/lovable-uploads/de844a80-a7e2-4449-b7ea-cecb59ff1b0d.png" 
            alt="ShTrader Logo" 
            className="h-16 w-auto object-contain"
          />
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
