
import React from 'react';
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import ResponsiveNav from "./ResponsiveNav";

const Sidebar = () => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center justify-center">
          <img 
            src="/lovable-uploads/2c29a237-d9d6-435f-ae2a-5deb44689d82.png" 
            alt="Logo" 
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="p-4 border-b border-gray-200">
        <Button variant="outline" className="w-full" size="sm">
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </div>

      {/* Navigation Menu */}
      <ResponsiveNav />
    </div>
  );
};

export default Sidebar;
