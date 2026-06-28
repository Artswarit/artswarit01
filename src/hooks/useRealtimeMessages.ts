import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Attachment } from '@/components/messages/MessageAttachments';
import { broadcastRefresh, useRealtimeSync } from '@/lib/realtime-sync';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  read: boolean;
  attachments?: Attachment[];
  status?: 'sending' | 'delivered' | 'read' | 'failed';
}

const parseAttachments = (data: unknown): Attachment[] => {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is Attachment =>
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      "url" in item &&
      "type" in item &&
      "size" in item
  );
};

interface Conversation {
  id: string;
  artistId: string | null;
  clientId: string | null;
  projectTitle: string | null;
  status: string | null;
  updatedAt: string;
  client_last_cleared_at: string | null;
  artist_last_cleared_at: string | null;
  otherUser: {
    id: string;
    name: string;
    avatar: string;
    role: string;
    isOnline?: boolean;
  } | null;
  lastMessage: string;
  lastMessageTime: Date | null;
  unreadCount: number;
}

const MESSAGES_PAGE_SIZE = 30;

export const useRealtimeMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Set up presence
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const onlineIds = new Set(Object.keys(newState));
        setOnlineUsers(onlineIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [user]);

  // Fetch all conversations for the current user
  const fetchConversations = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;

    try {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`client_id.eq.${user.id},artist_id.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .abortSignal(signal);

      if (convError) {
        if (convError.name === 'AbortError' || (convError as any).code === 'ABORT' || convError.message?.includes('signal is aborted')) return;
        throw convError;
      }

      // Fetch other user details and last message for each conversation
      const conversationsWithDetails = await Promise.all(
        (convData || []).map(async (conv) => {
          const otherUserId = conv.client_id === user.id ? conv.artist_id : conv.client_id;
          
          // Get other user's profile
          let otherUser = null;
          if (otherUserId) {
            const { data: profileData } = await (supabase
              .from('public_profiles')
              .select('id, full_name, avatar_url, role')
              .eq('id', otherUserId)
              .maybeSingle() as any)
              .abortSignal(signal);
            
            if (profileData) {
              otherUser = {
                id: profileData.id || '',
                name: profileData.full_name || 'Unknown User',
                avatar: profileData.avatar_url || '',
                role: profileData.role || 'client',
                isOnline: onlineUsers.has(profileData.id)
              };
            }
          }

          // Get last message
          const clearedAtForLastMsg = conv.client_id === user.id ? conv.client_last_cleared_at : conv.artist_last_cleared_at;
          let lastMsgQuery = supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id);
          
          if (clearedAtForLastMsg) {
            lastMsgQuery = lastMsgQuery.gt('created_at', clearedAtForLastMsg);
          }

          const { data: lastMsgData } = await lastMsgQuery
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const clearedAt = conv.client_id === user.id ? conv.client_last_cleared_at : conv.artist_last_cleared_at;
          let unreadQuery = supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);
          
          if (clearedAt) {
            unreadQuery = unreadQuery.gt('created_at', clearedAt);
          }

          const { count: unreadCount, error: unreadError } = await (unreadQuery as any).abortSignal(signal);
          
          if (unreadError && unreadError.name !== 'AbortError' && !unreadError.message?.includes('AbortError')) {
            console.error('Error fetching unread count:', unreadError);
          }

          return {
            id: conv.id,
            artistId: conv.artist_id,
            clientId: conv.client_id,
            projectTitle: conv.project_title,
            status: conv.status,
            updatedAt: conv.updated_at,
            client_last_cleared_at: conv.client_last_cleared_at,
            artist_last_cleared_at: conv.artist_last_cleared_at,
            otherUser,
            lastMessage: lastMsgData?.content || '',
            lastMessageTime: lastMsgData?.created_at ? new Date(lastMsgData.created_at) : null,
            unreadCount: unreadCount || 0
          };
        })
      );

      if (!signal?.aborted) {
        setConversations(conversationsWithDetails);
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('AbortError')) return;
      console.error('Error fetching conversations:', error);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [user, onlineUsers]);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (conversationId: string, signal?: AbortSignal) => {
    if (!user) return;

    try {
      const conv = conversations.find(c => c.id === conversationId);
      let clearedAt: string | null | undefined = null;
      if (conv) {
        clearedAt = conv.clientId === user.id ? conv.client_last_cleared_at : conv.artist_last_cleared_at;
      }

      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId);
      
      if (clearedAt) {
        query = query.gt('created_at', clearedAt);
      }
      
      // Fetch most recent page in descending order, then reverse for display (ascending)
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE_SIZE)
        .abortSignal(signal);

      if (error) {
        if (error.name === 'AbortError' || (error as any).code === 'ABORT' || error.message?.includes('signal is aborted')) return;
        throw error;
      }

      const rows = (data || []).slice().reverse();
      const formattedMessages: Message[] = rows.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id || '',
        text: msg.content,
        timestamp: new Date(msg.created_at),
        read: msg.is_read || false,
        attachments: parseAttachments(msg.attachments),
        status: msg.is_read ? 'read' : 'delivered'
      }));

      if (!signal?.aborted) {
        setMessages(formattedMessages);
        setHasMoreMessages((data || []).length === MESSAGES_PAGE_SIZE);
      }

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .abortSignal(signal);

      // Update local unread count
      if (!signal?.aborted) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
          )
        );
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || (error as any).code === 'ABORT' || error.message?.includes('signal is aborted')) return;
      console.error('Error fetching messages:', error);
    }
  }, [user, conversations]);

  // Send a new message
  const sendMessage = useCallback(async (conversationId: string, content: string, attachments?: Attachment[], signal?: AbortSignal) => {
    if (!user || (!content.trim() && (!attachments || attachments.length === 0))) return null;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      senderId: user.id,
      text: content.trim() || (attachments && attachments.length > 0 ? '📎 Attachment' : ''),
      timestamp: new Date(),
      read: false,
      attachments: attachments,
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim() || (attachments && attachments.length > 0 ? '📎 Attachment' : ''),
          is_read: false,
          attachments: attachments && attachments.length > 0 ? JSON.parse(JSON.stringify(attachments)) : []
        })
        .select()
        .single();

      if (error) {
        if (error.name === 'AbortError' || (error as any).code === 'ABORT' || error.message?.includes('signal is aborted')) return null;
        throw error;
      }

      setMessages(prev => prev.map(m => m.id === tempId ? {
        id: data.id,
        senderId: data.sender_id || '',
        text: data.content,
        timestamp: new Date(data.created_at),
        read: data.is_read || false,
        attachments: parseAttachments(data.attachments),
        status: 'delivered'
      } : m));

      // Update conversation's updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .abortSignal(signal);

      // Broadcast update
      broadcastRefresh('messages');

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError' || (error as any).code === 'ABORT' || error.message?.includes('signal is aborted')) return null;
      console.error('Error sending message:', error);
      
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
      return null;
    }
  }, [user, toast]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, []);

  // Update conversations when online users change
  useEffect(() => {
    setConversations(prev => prev.map(conv => {
      if (conv.otherUser) {
        return {
          ...conv,
          otherUser: {
            ...conv.otherUser,
            isOnline: onlineUsers.has(conv.otherUser.id)
          }
        };
      }
      return conv;
    }));
  }, [onlineUsers]);

  // Refs to avoid re-subscribing the realtime channel on every state change
  const activeConvIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const fetchConversationsRef = useRef(fetchConversations);
  const playSoundRef = useRef(playNotificationSound);

  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { fetchConversationsRef.current = fetchConversations; }, [fetchConversations]);
  useEffect(() => { playSoundRef.current = playNotificationSound; }, [playNotificationSound]);

  // Set up real-time subscriptions — keyed only on user.id to prevent reconnection loops
  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    fetchConversationsRef.current(controller.signal);

    const messagesChannel = supabase
      .channel(`realtime-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const activeId = activeConvIdRef.current;
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any;
            if (newMsg.conversation_id === activeId) {
              const conv = conversationsRef.current.find(c => c.id === activeId);
              const clearedAt = conv ? (conv.clientId === user.id ? conv.client_last_cleared_at : conv.artist_last_cleared_at) : null;
              if (clearedAt && new Date(newMsg.created_at) <= new Date(clearedAt)) return;

              const formattedMsg: Message = {
                id: newMsg.id,
                senderId: newMsg.sender_id || '',
                text: newMsg.content,
                timestamp: new Date(newMsg.created_at),
                read: newMsg.is_read || false,
                attachments: parseAttachments(newMsg.attachments),
                status: newMsg.is_read ? 'read' : 'delivered'
              };
              if (!controller.signal.aborted) {
                setMessages(prev => prev.some(m => m.id === formattedMsg.id) ? prev : [...prev, formattedMsg]);
              }
              if (newMsg.sender_id !== user.id) {
                supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id);
              }
            }
            if (newMsg.sender_id !== user.id) playSoundRef.current();
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as any;
            if (updatedMsg.conversation_id === activeId && !controller.signal.aborted) {
              setMessages(prev => prev.map(m =>
                m.id === updatedMsg.id ? { ...m, read: updatedMsg.is_read, status: updatedMsg.is_read ? 'read' : 'delivered' } : m
              ));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedMsg = payload.old as any;
            if (!controller.signal.aborted) {
              setMessages(prev => prev.filter(m => m.id !== deletedMsg.id));
            }
          }
          if (!controller.signal.aborted) {
            fetchConversationsRef.current(controller.signal);
          }
        }
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel(`realtime-conversations-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          if (!controller.signal.aborted) {
            fetchConversationsRef.current(controller.signal);
          }
        }
      )
      .subscribe();

    return () => {
      controller.abort();
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [user]);

  // Handle active conversation change
  useEffect(() => {
    if (activeConversationId) {
      const controller = new AbortController();
      fetchMessages(activeConversationId, controller.signal);
      return () => controller.abort();
    } else {
      setMessages([]);
    }
  }, [activeConversationId, fetchMessages]);

  // Realtime Sync for conversations
  useRealtimeSync('messages', () => {
    fetchConversations();
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  });

  return {
    conversations,
    messages,
    setMessages,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    loading,
    refetch: fetchConversations
  };
};
