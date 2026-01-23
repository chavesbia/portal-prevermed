import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users } from 'lucide-react';
import type { ChatItem } from '@/pages/Chat';

interface ChatListProps {
  chats: ChatItem[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  isLoading: boolean;
  currentUserId: string;
  getChatDisplayName: (chat: ChatItem) => string;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  isLoading,
  currentUserId,
  getChatDisplayName,
}: ChatListProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: false,
      locale: ptBR,
    });
  };

  const getChatAvatar = (chat: ChatItem) => {
    const otherParticipants = chat.participants.filter(p => p.user_id !== currentUserId);
    if (otherParticipants.length === 1) {
      return otherParticipants[0].profile_photo_url;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center text-muted-foreground">
        <p>Nenhuma conversa ainda.<br />Clique em "Nova Conversa" para começar.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {chats.map((chat) => {
          const displayName = getChatDisplayName(chat);
          const avatarUrl = getChatAvatar(chat);
          const isGroup = chat.participants.length > 2 || chat.name;

          return (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                selectedChatId === chat.id
                  ? 'bg-accent'
                  : 'hover:bg-muted'
              )}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback>
                    {isGroup ? <Users className="h-5 w-5" /> : getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{displayName}</p>
                  {chat.lastMessage && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(chat.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                {chat.lastMessage && (
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.lastMessage.sender_name.split(' ')[0]}: {chat.lastMessage.content}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
