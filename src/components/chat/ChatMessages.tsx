import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender?: {
    full_name: string;
    nickname: string | null;
    profile_photo_url: string | null;
  };
}

interface ChatMessagesProps {
  chatId: string;
  chatName: string;
  participants: {
    user_id: string;
    full_name: string;
    nickname: string | null;
    profile_photo_url: string | null;
  }[];
  currentUserId: string;
  onMessageSent: () => void;
}

export function ChatMessages({
  chatId,
  chatName,
  participants,
  currentUserId,
  onMessageSent,
}: ChatMessagesProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const participantsMap = participants.reduce((acc, p) => {
    acc[p.user_id] = p;
    return acc;
  }, {} as Record<string, typeof participants[0]>);

  useEffect(() => {
    fetchMessages();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, {
              ...newMsg,
              sender: participantsMap[newMsg.sender_id],
            }];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithSenders = (data || []).map(msg => ({
        ...msg,
        sender: participantsMap[msg.sender_id],
      }));

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          content: newMessage.trim(),
          sender_id: currentUserId,
        });

      if (error) throw error;

      setNewMessage('');
      onMessageSent();
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return format(date, "d 'de' MMMM", { locale: ptBR });
  };

  const formatMessageTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach(msg => {
      const msgDate = formatMessageDate(msg.created_at);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const isGroup = participants.length > 2;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {isGroup ? (
            <AvatarFallback><Users className="h-5 w-5" /></AvatarFallback>
          ) : (
            <>
              <AvatarImage 
                src={participants.find(p => p.user_id !== currentUserId)?.profile_photo_url || undefined} 
              />
              <AvatarFallback>{getInitials(chatName)}</AvatarFallback>
            </>
          )}
        </Avatar>
        <div>
          <h2 className="font-semibold">{chatName}</h2>
          <p className="text-xs text-muted-foreground">
            {participants.length} participante{participants.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn('flex gap-2', i % 2 === 0 ? 'justify-end' : '')}>
                <Skeleton className="h-10 w-48 rounded-lg" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full text-muted-foreground">
            <p>Nenhuma mensagem ainda. Comece a conversa!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupMessagesByDate(messages).map(group => (
              <div key={group.date}>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {group.date}
                  </span>
                </div>
                <div className="space-y-3">
                  {group.messages.map((msg, idx) => {
                    const isOwn = msg.sender_id === currentUserId;
                    const showAvatar = !isOwn && (
                      idx === 0 || 
                      group.messages[idx - 1].sender_id !== msg.sender_id
                    );

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex gap-2',
                          isOwn ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {!isOwn && (
                          <div className="w-8">
                            {showAvatar && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={msg.sender?.profile_photo_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(msg.sender?.full_name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[70%] rounded-lg px-3 py-2',
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          {!isOwn && showAvatar && isGroup && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {msg.sender?.nickname || msg.sender?.full_name}
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          <p className={cn(
                            'text-xs mt-1',
                            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}>
                            {formatMessageTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={scrollRef} />
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={isSending}
            className="flex-1"
          />
          <Button type="submit" disabled={!newMessage.trim() || isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
