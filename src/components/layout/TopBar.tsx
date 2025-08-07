
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, User } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface TopBarProps {
  accountMode: 'demo' | 'live';
}

const TopBar = ({ accountMode }: TopBarProps) => {
  const { state } = useApp();

  return (
    <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      {/* Left side - Page title will be handled by individual pages */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={accountMode === 'demo' ? 'default' : 'secondary'}>
            {accountMode === 'demo' ? 'Demo Account' : 'Live Account'}
          </Badge>
          
          {/* Dynamic wallet connection status */}
          {accountMode === 'live' && (
            <>
              <div className={`w-2 h-2 rounded-full ${
                state.isWalletConnected 
                  ? 'bg-green-500 animate-pulse' 
                  : 'bg-red-500'
              }`}></div>
              <span className={`text-sm ${
                state.isWalletConnected 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {state.isWalletConnected ? 'Wallet Connected' : 'Wallet Disconnected'}
              </span>
            </>
          )}
          
          {/* For demo mode, always show as connected */}
          {accountMode === 'demo' && (
            <>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-blue-600">Demo Mode</span>
            </>
          )}
        </div>
      </div>

      {/* Right side - User actions */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default TopBar;
