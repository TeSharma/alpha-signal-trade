
import React from 'react';
import { Button } from "@/components/ui/button";
import { Wallet, Check, AlertCircle } from "lucide-react";
import ResponsiveNav from "./ResponsiveNav";
import { useWallet } from "@/hooks/useWallet";

const Sidebar = () => {
  const { isConnected, account, balance, isConnecting, connectWallet, disconnectWallet } = useWallet();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
        {!isConnected ? (
          <Button 
            variant="outline" 
            className="w-full" 
            size="sm"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            <Wallet className="h-4 w-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Connected</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={disconnectWallet}
                className="h-6 px-2 text-xs"
              >
                Disconnect
              </Button>
            </div>
            <div className="text-xs text-gray-600">
              <div>{formatAddress(account!)}</div>
              <div className="font-medium">{balance} ETH</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <ResponsiveNav />
    </div>
  );
};

export default Sidebar;
