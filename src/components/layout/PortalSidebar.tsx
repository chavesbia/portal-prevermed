import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  Building2,
  MessageSquare,
  FileText,
  Bell,
  Settings,
  Shield,
  Newspaper,
  FolderOpen,
  Link as LinkIcon,
  Network,
  ClipboardList,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';

interface PortalSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ElementType;
  path: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Início', icon: Home, path: '/' },
      { label: 'Comunicados', icon: Newspaper, path: '/comunicados' },
      { label: 'Documentos', icon: FolderOpen, path: '/documentos' },
      { label: 'Links Úteis', icon: LinkIcon, path: '/links' },
      { label: 'Organograma', icon: Network, path: '/organograma' },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { label: 'Rede Social', icon: Users, path: '/social', requiresAuth: true },
      { label: 'Chat', icon: MessageSquare, path: '/chat', requiresAuth: true },
      { label: 'Notificações', icon: Bell, path: '/notificacoes', requiresAuth: true },
    ],
  },
  {
    title: 'Departamentos',
    items: [
      { label: 'RH', icon: Users, path: '/departamentos/rh', requiresAuth: true },
      { label: 'Engenharia', icon: Building2, path: '/departamentos/engenharia', requiresAuth: true },
      { label: 'Comercial', icon: FileText, path: '/departamentos/comercial', requiresAuth: true },
    ],
  },
  {
    title: 'Administração',
    items: [
      { label: 'Usuários', icon: Users, path: '/admin/usuarios', adminOnly: true },
      { label: 'Permissões', icon: Shield, path: '/admin/permissoes', adminOnly: true },
      { label: 'Auditoria', icon: ClipboardList, path: '/admin/auditoria', adminOnly: true },
      { label: 'Configurações', icon: Settings, path: '/admin/configuracoes', adminOnly: true },
    ],
  },
];

export function PortalSidebar({ isOpen, onClose }: PortalSidebarProps) {
  const location = useLocation();
  const { user, isAdmin } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const shouldShowItem = (item: MenuItem) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.requiresAuth && !user) return false;
    return true;
  };

  const shouldShowSection = (section: MenuSection) => {
    return section.items.some(shouldShowItem);
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border lg:hidden">
          <span className="text-sidebar-foreground font-semibold">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-4rem)] lg:h-screen py-4 scrollbar-thin">
          <nav className="px-3 space-y-6">
            {menuSections.map((section) => (
              shouldShowSection(section) && (
                <div key={section.title}>
                  <h3 className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      shouldShowItem(item) && (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={onClose}
                          className={cn(
                            'menu-item',
                            isActive(item.path) && 'menu-item-active'
                          )}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    ))}
                  </div>
                </div>
              )
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}
