import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatRoom {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_private: boolean;
  requires_verification: boolean;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  reply_to?: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  is_online: boolean;
  last_seen: string;
}

export const useChat = () => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Fetch chat rooms
  const fetchRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('name');

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat rooms',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Fetch messages for current room
  const fetchMessages = useCallback(async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          room_id,
          user_id,
          content,
          message_type,
          reply_to,
          is_edited,
          is_deleted,
          created_at,
          updated_at,
          profiles:user_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      
      // Transform the data to match our Message interface
      const transformedMessages: Message[] = (data || []).map((item: any) => ({
        id: item.id,
        room_id: item.room_id,
        user_id: item.user_id,
        content: item.content,
        message_type: item.message_type as 'text' | 'image' | 'file',
        reply_to: item.reply_to,
        is_edited: item.is_edited,
        is_deleted: item.is_deleted,
        created_at: item.created_at,
        updated_at: item.updated_at,
        profiles: item.profiles ? {
          username: item.profiles.username,
          full_name: item.profiles.full_name,
          avatar_url: item.profiles.avatar_url,
        } : undefined,
      }));
      
      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Send a message
  const sendMessage = useCallback(async (content: string, roomId?: string) => {
    const targetRoomId = roomId || currentRoom?.id;
    if (!targetRoomId || !content.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('messages')
        .insert({
          room_id: targetRoomId,
          user_id: user.id,
          content: content.trim(),
          message_type: 'text',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  }, [currentRoom?.id, toast]);

  // Join a room
  const joinRoom = useCallback(async (room: ChatRoom) => {
    setCurrentRoom(room);
    setMessages([]);
    await fetchMessages(room.id);
  }, [fetchMessages]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentRoom) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`messages:${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Fetch user profile for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('user_id', newMessage.user_id)
            .single();

          setMessages((prev) => [
            ...prev,
            { ...newMessage, profiles: profile ? {
              username: profile.username,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
            } : undefined },
          ]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        (payload) => {
          const deletedMessage = payload.old as Message;
          setMessages((prev) => prev.filter((msg) => msg.id !== deletedMessage.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [currentRoom]);

  // Set up presence for typing indicators
  useEffect(() => {
    if (!currentRoom) return;

    const presenceChannel = supabase.channel(`presence:${currentRoom.id}`, {
      config: {
        presence: {
          key: 'typing',
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const typingUsers: Record<string, boolean> = {};
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.typing) {
              typingUsers[presence.user_id] = true;
            }
          });
        });
        
        setIsTyping(typingUsers);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [currentRoom]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      await fetchRooms();
      setLoading(false);
    };

    init();
  }, [fetchRooms]);

  return {
    rooms,
    currentRoom,
    messages,
    onlineUsers,
    loading,
    isTyping,
    sendMessage,
    joinRoom,
    fetchRooms,
  };
};