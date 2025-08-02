import React, { useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { MessageItem } from './MessageItem';
import { ScrollArea } from '@/components/ui/scroll-area';

export const MessageList = () => {
  const { messages, isTyping } = useChat();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showAvatar = !prevMessage || 
            prevMessage.user_id !== message.user_id || 
            new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000; // 5 minutes

          return (
            <MessageItem
              key={message.id}
              message={message}
              showAvatar={showAvatar}
            />
          );
        })}

        {/* Typing indicators */}
        {Object.keys(isTyping).length > 0 && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-200" />
            </div>
            <span>Someone is typing...</span>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};