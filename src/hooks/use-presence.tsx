import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  odataUserId: string;
  online_at: string;
  typing_in_chat?: string | null;
}

interface UsePresenceOptions {
  userId: string;
  channelName?: string;
}

interface PresenceData {
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>; // chatId -> userId
  setTyping: (chatId: string | null) => void;
}

export function usePresence({ userId, channelName = 'global-presence' }: UsePresenceOptions): PresenceData {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        const typing = new Map<string, string>();

        Object.entries(state).forEach(([key, presences]) => {
          if (Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as unknown as PresenceState;
            online.add(key);
            if (presence.typing_in_chat) {
              typing.set(presence.typing_in_chat, key);
            }
          }
        });

        setOnlineUsers(online);
        setTypingUsers(typing);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers(prev => new Set([...prev, key]));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setTypingUsers(prev => {
          const next = new Map(prev);
          // Remove any typing indicators for this user
          for (const [chatId, typingUserId] of next.entries()) {
            if (typingUserId === key) {
              next.delete(chatId);
            }
          }
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            odataUserId: userId,
            online_at: new Date().toISOString(),
            typing_in_chat: null,
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [userId, channelName]);

  const setTyping = useCallback(async (chatId: string | null) => {
    if (channel) {
      await channel.track({
        odataUserId: userId,
        online_at: new Date().toISOString(),
        typing_in_chat: chatId,
      });
    }
  }, [channel, userId]);

  return {
    onlineUsers,
    typingUsers,
    setTyping,
  };
}
