import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChatList } from '@/components/chat/ChatList';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePresence } from '@/hooks/use-presence';
export interface ChatItem {
  id: string;
  name: string | null;
  chat_type: 'direct' | 'department';
  created_at: string;
  updated_at: string;
  participants: {
    user_id: string;
    full_name: string;
    nickname: string | null;
    profile_photo_url: string | null;
  }[];
  lastMessage?: {
    content: string;
    created_at: string;
    sender_name: string;
  };
  unreadCount?: number;
}

export interface Profile {
  user_id: string;
  full_name: string;
  nickname: string | null;
  profile_photo_url: string | null;
  position: string | null;
}

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const { onlineUsers, typingUsers, setTyping } = usePresence({ 
    userId: user?.id || '' 
  });

  useEffect(() => {
    if (user) {
      fetchChats();
      fetchProfiles();
    }
  }, [user]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, nickname, profile_photo_url, position')
      .eq('status', 'active');
    
    if (data) {
      setProfiles(data);
    }
  };

  const fetchChats = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch chats where user is a participant
      const { data: participantChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);

      const chatIds = participantChats?.map(p => p.chat_id) || [];

      if (chatIds.length === 0) {
        setChats([]);
        setIsLoading(false);
        return;
      }

      // Fetch chat details
      const { data: chatsData, error } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch all participants for these chats
      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('chat_id, user_id')
        .in('chat_id', chatIds);

      // Fetch profiles for participants
      const participantUserIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, nickname, profile_photo_url')
        .in('user_id', participantUserIds);

      const profilesMap: Record<string, Profile> = {};
      profilesData?.forEach(p => {
        profilesMap[p.user_id] = p as Profile;
      });

      // Fetch last message for each chat
      const chatItems: ChatItem[] = await Promise.all(
        (chatsData || []).map(async (chat) => {
          const { data: lastMessageData } = await supabase
            .from('chat_messages')
            .select('content, created_at, sender_id')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const chatParticipants = allParticipants
            ?.filter(p => p.chat_id === chat.id)
            .map(p => ({
              user_id: p.user_id,
              full_name: profilesMap[p.user_id]?.full_name || 'Usuário',
              nickname: profilesMap[p.user_id]?.nickname || null,
              profile_photo_url: profilesMap[p.user_id]?.profile_photo_url || null,
            })) || [];

          return {
            id: chat.id,
            name: chat.name,
            chat_type: chat.chat_type as 'direct' | 'department',
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            participants: chatParticipants,
            lastMessage: lastMessageData ? {
              content: lastMessageData.content,
              created_at: lastMessageData.created_at,
              sender_name: profilesMap[lastMessageData.sender_id]?.full_name || 'Usuário',
            } : undefined,
          };
        })
      );

      setChats(chatItems);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({
        title: 'Erro ao carregar conversas',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChat = async (participantIds: string[], name?: string, isGroup?: boolean) => {
    if (!user) return;

    try {
      // For direct chats, check if chat already exists
      if (!isGroup && participantIds.length === 1) {
        const existingChat = chats.find(
          chat => 
            chat.chat_type === 'direct' && 
            chat.participants.some(p => p.user_id === participantIds[0])
        );

        if (existingChat) {
          setSelectedChatId(existingChat.id);
          setIsNewChatOpen(false);
          return;
        }
      }

      // Create new chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name: isGroup ? name : null,
          chat_type: isGroup ? 'direct' : 'direct', // We'll use 'direct' for both since 'group' isn't in enum
          created_by: user.id,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants (including current user)
      const allParticipants = [...new Set([user.id, ...participantIds])];
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert(
          allParticipants.map(userId => ({
            chat_id: newChat.id,
            user_id: userId,
          }))
        );

      if (participantsError) throw participantsError;

      await fetchChats();
      setSelectedChatId(newChat.id);
      setIsNewChatOpen(false);

      toast({
        title: 'Conversa criada',
        description: 'Nova conversa iniciada com sucesso.',
      });
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: 'Erro ao criar conversa',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    }
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);

  const getChatDisplayName = (chat: ChatItem) => {
    if (chat.name) return chat.name;
    
    // For direct chats, show the other participant's name
    const otherParticipants = chat.participants.filter(p => p.user_id !== user?.id);
    if (otherParticipants.length === 1) {
      return otherParticipants[0].nickname || otherParticipants[0].full_name;
    }
    return otherParticipants.map(p => p.nickname || p.full_name).join(', ');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <p className="text-muted-foreground">Faça login para acessar o chat.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Chat</h1>
        <Button onClick={() => setIsNewChatOpen(true)}>
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          Nova Conversa
        </Button>
      </div>

      <div className="flex-1 flex border rounded-lg overflow-hidden bg-card">
        {/* Chat List */}
        <div className="w-80 border-r flex flex-col">
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
            isLoading={isLoading}
            currentUserId={user.id}
            getChatDisplayName={getChatDisplayName}
            onlineUsers={onlineUsers}
          />
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <ChatMessages
              chatId={selectedChat.id}
              chatName={getChatDisplayName(selectedChat)}
              participants={selectedChat.participants}
              currentUserId={user.id}
              onMessageSent={fetchChats}
              onlineUsers={onlineUsers}
              typingUsers={typingUsers}
              setTyping={setTyping}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma conversa ou inicie uma nova</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewChatDialog
        open={isNewChatOpen}
        onOpenChange={setIsNewChatOpen}
        profiles={profiles.filter(p => p.user_id !== user.id)}
        onCreateChat={handleCreateChat}
      />
    </div>
  );
}
