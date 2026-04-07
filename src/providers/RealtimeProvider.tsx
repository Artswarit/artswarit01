import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

interface RealtimeContextType {
  onlineUsers: Set<string>;
  typingUsers: Set<string>;
  broadcastTyping: (conversationId: string, isTyping: boolean) => void;
  channel: RealtimeChannel | null;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set()); // Custom string format: `${conversationId}:${userId}`
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user?.id) {
      if (channel) {
        supabase.removeChannel(channel);
        setChannel(null);
      }
      return;
    }

    // Initialize global presence and broadcast channel
    const systemChannel = supabase.channel('global_system', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    systemChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = systemChannel.presenceState();
        const onlineIds = new Set(Object.keys(newState));
        setOnlineUsers(onlineIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, conversationId, isTyping } = payload.payload;
        if (userId === user.id) return; // Ignore self

        setTypingUsers((prev) => {
          const next = new Set(prev);
          const typingKey = `${conversationId}:${userId}`;
          if (isTyping) {
            next.add(typingKey);
          } else {
            next.delete(typingKey);
          }
          return next;
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const newNotif = payload.new as { title: string; message: string };
        toast({
          title: newNotif.title,
          description: newNotif.message,
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await systemChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    setChannel(systemChannel);

    return () => {
      systemChannel.unsubscribe();
      supabase.removeChannel(systemChannel);
    };
  }, [user?.id]);

  const broadcastTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      if (!channel || !user?.id) return;
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, conversationId, isTyping },
      });
    },
    [channel, user?.id]
  );

  return (
    <RealtimeContext.Provider value={{ onlineUsers, typingUsers, broadcastTyping, channel }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};
