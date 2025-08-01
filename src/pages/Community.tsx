import React from 'react';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { useChat } from '@/hooks/useChat';

const Community = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Community Chat</h1>
        <p className="text-muted-foreground mt-2">
          Connect with fellow traders, share insights, and stay updated on market signals.
        </p>
      </div>

      {/* Chat Interface */}
      <ChatRoom />
    </div>
  );
};

export default Community;