import React from 'react';
import { useChat } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Hash, Lock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ChatSidebar = () => {
  const { rooms, currentRoom, joinRoom } = useChat();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h3 className="font-semibold">Chat Rooms</h3>
      </div>

      {/* Rooms List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {rooms.map((room) => {
            const isActive = currentRoom?.id === room.id;
            
            return (
              <Button
                key={room.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start text-left h-auto p-3',
                  isActive && 'bg-primary/10 text-primary'
                )}
                onClick={() => joinRoom(room)}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="shrink-0">
                    {room.is_private ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Hash className="h-4 w-4" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {room.display_name}
                      </span>
                      {room.requires_verification && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Verified
                        </Badge>
                      )}
                    </div>
                    {room.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {room.description}
                      </p>
                    )}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Online Users Count */}
      <div className="border-t p-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Online: 1</span>
        </div>
      </div>
    </div>
  );
};