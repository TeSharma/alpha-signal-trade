import React from 'react';
import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatSidebar } from './ChatSidebar';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const ChatRoom = () => {
  const { currentRoom, loading } = useChat();

  if (loading) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center">
        <div className="text-muted-foreground">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[600px] w-full overflow-hidden rounded-lg border">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30">
        <ChatSidebar />
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {currentRoom ? (
          <>
            {/* Chat Header */}
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">{currentRoom.display_name}</h2>
              {currentRoom.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {currentRoom.description}
                </p>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <MessageList />
            </div>

            <Separator />

            {/* Message Input */}
            <div className="p-4">
              <MessageInput />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Welcome to ShTrader Chat</h3>
              <p className="text-muted-foreground">
                Select a channel from the sidebar to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};