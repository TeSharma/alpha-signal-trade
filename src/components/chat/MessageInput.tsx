import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const MessageInput = () => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendMessage, currentRoom } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentRoom || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await sendMessage(message);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Send typing indicator
  useEffect(() => {
    if (!currentRoom || !message.trim()) return;

    const channel = supabase.channel(`presence:${currentRoom.id}`);
    
    const sendTypingStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await channel.track({
          user_id: user.id,
          typing: true,
        });
      }
    };

    sendTypingStatus();

    const timeout = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await channel.track({
          user_id: user.id,
          typing: false,
        });
      }
    }, 1000);

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [message, currentRoom]);

  if (!currentRoom) return null;

  return (
    <form onSubmit={handleSubmit} className="flex items-end space-x-2">
      <div className="flex-1">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${currentRoom.display_name}...`}
          className="min-h-[40px] max-h-[120px] resize-none"
          disabled={isSubmitting}
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!message.trim() || isSubmitting}
        className="shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};