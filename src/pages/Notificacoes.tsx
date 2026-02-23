import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bell, MessageSquare, Heart, AtSign, Newspaper, FileText, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  content: string | null;
  notification_type: string;
  is_read: boolean;
  related_id: string | null;
  related_type: string | null;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  mention: { icon: AtSign, color: 'text-blue-500', label: 'Menção' },
  new_post: { icon: MessageSquare, color: 'text-green-500', label: 'Post' },
  new_announcement: { icon: Newspaper, color: 'text-orange-500', label: 'Comunicado' },
  new_document: { icon: FileText, color: 'text-purple-500', label: 'Documento' },
  chat_message: { icon: MessageSquare, color: 'text-primary', label: 'Chat' },
  like: { icon: Heart, color: 'text-red-500', label: 'Curtida' },
  comment: { icon: MessageSquare, color: 'text-teal-500', label: 'Comentário' },
};

export default function Notificacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Realtime subscription
      const channel = supabase
        .channel('notifications-page')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) setNotifications(data);
    setIsLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClick = (n: Notification) => {
    markAsRead(n.id);
    if (n.related_type === 'post' || n.notification_type === 'new_post' || n.notification_type === 'like' || n.notification_type === 'comment') {
      navigate('/social');
    } else if (n.notification_type === 'chat_message') {
      navigate('/chat');
    } else if (n.notification_type === 'new_announcement') {
      navigate('/comunicados');
    } else if (n.notification_type === 'new_document') {
      navigate('/documentos');
    } else if (n.notification_type === 'mention') {
      if (n.related_type === 'chat') navigate('/chat');
      else navigate('/social');
    }
  };

  const filtered = activeTab === 'all' ? notifications
    : activeTab === 'unread' ? notifications.filter(n => !n.is_read)
    : notifications.filter(n => n.notification_type === activeTab);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Faça login para ver suas notificações.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="unread">
            Não lidas
            {unreadCount > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="mention">Menções</TabsTrigger>
          <TabsTrigger value="chat_message">Chat</TabsTrigger>
          <TabsTrigger value="like">Curtidas</TabsTrigger>
          <TabsTrigger value="comment">Comentários</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma notificação encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => {
                const config = typeConfig[n.notification_type] || { icon: Bell, color: 'text-muted-foreground', label: n.notification_type };
                const Icon = config.icon;
                return (
                  <Card
                    key={n.id}
                    className={`cursor-pointer transition-colors hover:bg-accent/50 ${!n.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
                    onClick={() => handleClick(n)}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className={`mt-0.5 ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{n.title}</span>
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        {n.content && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.is_read && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
