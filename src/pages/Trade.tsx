
import React, { useState } from 'react';
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import TradingForm from "@/components/trading/TradingForm";
import MarketOverview from "@/components/trading/MarketOverview";

const Trade = () => {
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <TopBar accountMode={accountMode} />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Trade</h1>
              <p className="text-gray-600">Execute trades on synthetic forex pairs</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <TradingForm accountMode={accountMode} />
              </div>
              <div className="lg:col-span-2">
                <MarketOverview />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Trade;
