import React from 'react';
import { Message } from '@/hooks/useChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface MessageItemProps {
  message: Message;
  showAvatar: boolean;
}

export const MessageItem = ({ message, showAvatar }: MessageItemProps) => {
  const displayName = message.profiles?.display_name || message.profiles?.username || 'Anonymous';
  const username = message.profiles?.username || 'anonymous';
  const avatarUrl = message.profiles?.avatar_url;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  return (
    <div className={`flex items-start space-x-3 ${showAvatar ? '' : 'ml-12'}`}>
      {showAvatar && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline space-x-2 mb-1">
            <span className="font-medium text-sm">{displayName}</span>
            <span className="text-xs text-muted-foreground">
              @{username}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.created_at)}
            </span>
          </div>
        )}
        
        <div className={`${showAvatar ? '' : 'mt-1'}`}>
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {message.is_edited && (
            <span className="text-xs text-muted-foreground ml-1">(edited)</span>
          )}
        </div>
      </div>
    </div>
  );
};