import React, { useState } from 'react';
import { ChatRoom } from '@/components/chat/ChatRoom';
import MobileCommunity from '@/components/chat/MobileCommunity';
import { useChat } from '@/hooks/useChat';
import MobileHeader from '@/components/layout/MobileHeader';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

const Community = () => {
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
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Community Chat</h1>
                <p className="text-muted-foreground">Connect with fellow traders, share insights, and stay updated on market signals.</p>
              </div>
              <ChatRoom />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileCommunity />
      </div>
    </div>
  );
};

export default Community;