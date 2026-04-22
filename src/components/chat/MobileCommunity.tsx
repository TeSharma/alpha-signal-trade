  import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Hash, ArrowLeft } from 'lucide-react';
import { ChatSidebar } from './ChatSidebar';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChat } from '@/hooks/useChat';

const MobileCommunity = () => {
const { currentRoom, joinRoom, rooms, loading } = useChat();
  const [activeTab, setActiveTab] = useState<'channels' | 'chat'>('channels');

  if (loading) {
    return (
      <div className="flex h-[70vh] w-full items-center justify-center">
        <div className="text-muted-foreground">Loading chat...</div>
      </div>
    );
  }

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        {activeTab === 'chat' && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-0 h-8 w-8"
            onClick={() => setActiveTab('channels')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-bold">Community</h1>
          <p className="text-sm text-muted-foreground">Connect with traders</p>
        </div>
      </div>

      {activeTab === 'channels' && (
        <div className="space-y-4">
          <Card>
            <div className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Channels</h2>
              {rooms.map((room) => (
                <Button
                  key={room.id}
                  variant={currentRoom?.id === room.id ? "default" : "ghost"}
                  className="w-full justify-start h-12"
onClick={() => {
                  joinRoom(room);
                  setActiveTab('chat');
                }}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  {room.display_name}
                </Button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Online Users</h2>
              <div className="flex items-center gap-3 p-2">
                <Users className="h-5 w-5 text-green-500" />
                <span className="text-sm">124 traders online</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'chat' && currentRoom && (
        <div className="h-[70vh] flex flex-col">
          <Card className="flex-1 flex flex-col">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{currentRoom.display_name}</h2>
                  <p className="text-xs text-muted-foreground">{currentRoom.description}</p>
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <MessageList />
            </div>
            
            <div className="p-3 border-t">
              <MessageInput />
            </div>
          </Card>
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-16"></div>
    </main>
  );
};

export default MobileCommunity;