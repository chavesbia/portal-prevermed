import { useState, useEffect } from 'react';
import { Bell, Search, Menu, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate } from 'react-router-dom';
import logo from '@/assets/logo-prevermed.png';

interface PortalHeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function PortalHeader({ onMenuClick, showMenuButton = false }: PortalHeaderProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();
    const channel = supabase
      .channel('header-notif-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        
        <Link to="/" className="flex items-center gap-2">
          <img 
            src={logo} 
            alt="PreverMed" 
            className="h-9 w-auto"
          />
        </Link>
      </div>

      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar no portal..."
            className="pl-10 bg-muted/50 border-transparent focus:border-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notificacoes')}>
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.profile_photo_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(profile?.full_name || user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:inline text-sm font-medium">
                    {profile?.nickname || profile?.full_name?.split(' ')[0] || 'Usuário'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{profile?.full_name || 'Usuário'}</span>
                    <span className="font-normal text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/perfil">Meu Perfil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes">Configurações</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Button asChild variant="default" size="sm">
            <Link to="/auth" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              <span>Entrar</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
