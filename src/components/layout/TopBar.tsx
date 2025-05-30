
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Settings, User } from "lucide-react";

interface TopBarProps {
  accountMode: 'demo' | 'live';
}

const TopBar = ({ accountMode }: TopBarProps) => {
  return (
    <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      {/* Left side - Page title will be handled by individual pages */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={accountMode === 'demo' ? 'default' : 'secondary'}>
            {accountMode === 'demo' ? 'Demo Account' : 'Live Account'}
          </Badge>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Connected</span>
        </div>
      </div>

      {/* Right side - User actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          <Bell className="h-4 w-4" />
        </Button>
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
