import React from 'react';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileHeader from "@/components/layout/MobileHeader";
import { StorageCenter } from "@/components/storage/StorageCenter";

const Storage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <MobileHeader 
        accountMode="demo" 
        onAccountModeChange={() => {}}
      />
      
      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar accountMode="demo" />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <StorageCenter />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <main className="p-4">
          <StorageCenter />
          {/* Bottom padding for mobile navigation */}
          <div className="h-16"></div>
        </main>
      </div>
    </div>
  );
};

export default Storage;