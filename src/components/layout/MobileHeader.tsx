
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, Bell, Wallet, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./Sidebar";

interface MobileHeaderProps {
  accountMode: 'demo' | 'live';
  onAccountModeChange: (mode: 'demo' | 'live') => void;
}

const MobileHeader = ({ accountMode, onAccountModeChange }: MobileHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <div className="h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
        {/* Left - Hamburger Menu */}
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Center - Demo/Live Toggle */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={accountMode === 'demo' ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={() => onAccountModeChange(accountMode === 'demo' ? 'live' : 'demo')}
          >
            {accountMode === 'demo' ? 'Demo' : 'Live'}
          </Badge>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>

        {/* Right - Wallet & Notifications */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Wallet className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MobileHeader;
