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
  ExternalLink,
  Calculator,
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
  isExternal?: boolean;
  subItems?: MenuItem[];
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
      { 
        label: 'Comercial', 
        icon: FileText, 
        path: '/departamentos/comercial', 
        requiresAuth: true,
        subItems: [
          { 
            label: 'Precificação', 
            icon: Calculator, 
            path: 'https://precificacao-prevermed.lovable.app', 
            requiresAuth: true,
            isExternal: true 
          },
        ]
      },
    ],
  },
  {
    title: 'Administração',
    items: [
      { label: 'Usuários', icon: Users, path: '/admin/usuarios', adminOnly: true },
      { label: 'Departamentos', icon: Building2, path: '/admin/departamentos', adminOnly: true },
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
                        <div key={item.path}>
                          {item.isExternal ? (
                            <a
                              href={item.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="menu-item flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <item.icon className="h-5 w-5 flex-shrink-0" />
                                <span>{item.label}</span>
                              </div>
                              <ExternalLink className="h-4 w-4 opacity-50" />
                            </a>
                          ) : (
                            <NavLink
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
                          )}
                          {item.subItems && item.subItems.length > 0 && (
                            <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                              {item.subItems.map((subItem) => (
                                shouldShowItem(subItem) && (
                                  subItem.isExternal ? (
                                    <a
                                      key={subItem.path}
                                      href={subItem.path}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="menu-item flex items-center justify-between text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <subItem.icon className="h-4 w-4 flex-shrink-0" />
                                        <span>{subItem.label}</span>
                                      </div>
                                      <ExternalLink className="h-3 w-3 opacity-50" />
                                    </a>
                                  ) : (
                                    <NavLink
                                      key={subItem.path}
                                      to={subItem.path}
                                      onClick={onClose}
                                      className={cn(
                                        'menu-item text-sm',
                                        isActive(subItem.path) && 'menu-item-active'
                                      )}
                                    >
                                      <subItem.icon className="h-4 w-4 flex-shrink-0" />
                                      <span>{subItem.label}</span>
                                    </NavLink>
                                  )
                                )
                              ))}
                            </div>
                          )}
                        </div>
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
