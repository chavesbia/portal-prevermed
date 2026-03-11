import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
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
  Calculator,
  Briefcase,
  Stethoscope,
  DollarSign,
  HeadphonesIcon,
  FileCode,
  Megaphone,
  Scale,
  Truck,
  Wrench,
  GraduationCap,
  Heart,
  LucideIcon,
  LayoutDashboard,
  Cog,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';

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
  subItems?: MenuItem[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// Map department names to icons
const departmentIconMap: Record<string, LucideIcon> = {
  'Comercial': DollarSign,
  'Financeiro': DollarSign,
  'Faturamento': DollarSign,
  'RH': Users,
  'Recursos Humanos': Users,
  'TI': FileCode,
  'Tecnologia': FileCode,
  'Atendimento': HeadphonesIcon,
  'Marketing': Megaphone,
  'Jurídico': Scale,
  'Logística': Truck,
  'Operacional': Wrench,
  'Manutenção': Wrench,
  'Treinamento': GraduationCap,
  'Saúde': Heart,
  'Médico': Stethoscope,
  'Administrativo': Briefcase,
  'Credenciamento': ClipboardList,
  'Engenharia': Cog,
  'Agendamento': CalendarDays,
  'Relacionamento': Users,
  'Liberação de Exames': FileText,
  'e-Social': FileCode,
  'Laboratório': Stethoscope,
  'Enfermagem': Heart,
};

// Map module icon strings (from DB) to lucide components
const moduleIconMap: Record<string, LucideIcon> = {
  'Calculator': Calculator,
  'ClipboardList': ClipboardList,
  'DollarSign': DollarSign,
  'LayoutDashboard': LayoutDashboard,
  'FileText': FileText,
  'Users': Users,
  'Cog': Cog,
  'Settings': Settings,
  'Package': Package,
  'Stethoscope': Stethoscope,
  'CalendarDays': CalendarDays,
  'Heart': Heart,
  'Wrench': Wrench,
  'HeadphonesIcon': HeadphonesIcon,
  'Megaphone': Megaphone,
  'Scale': Scale,
  'Truck': Truck,
  'GraduationCap': GraduationCap,
  'FileCode': FileCode,
  'Building2': Building2,
};

const getDepartmentIcon = (name: string): LucideIcon => {
  if (departmentIconMap[name]) return departmentIconMap[name];
  for (const [key, icon] of Object.entries(departmentIconMap)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return Building2;
};

const getModuleIcon = (iconName: string | null): LucideIcon => {
  if (iconName && moduleIconMap[iconName]) return moduleIconMap[iconName];
  return Package;
};

// Static sections
const staticMenuSections: MenuSection[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Início', icon: Home, path: '/' },
      { label: 'Comunicados', icon: Newspaper, path: '/comunicados' },
      { label: 'Documentos', icon: FolderOpen, path: '/documentos' },
      { label: 'Links Úteis', icon: LinkIcon, path: '/links' },
      { label: 'Diretório de Contatos', icon: Users, path: '/diretorio' },
      { label: 'Organograma', icon: Network, path: '/organograma' },
      { label: 'Calendário', icon: CalendarDays, path: '/calendario' },
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
];

const adminSection: MenuSection = {
  title: 'Administração',
  items: [
    { label: 'Usuários', icon: Users, path: '/admin/usuarios', adminOnly: true },
    { label: 'Departamentos', icon: Building2, path: '/admin/departamentos', adminOnly: true },
    { label: 'Documentos', icon: FolderOpen, path: '/admin/documentos', adminOnly: true },
    { label: 'Permissões', icon: Shield, path: '/admin/permissoes', adminOnly: true },
    { label: 'Auditoria', icon: ClipboardList, path: '/admin/auditoria', adminOnly: true },
    { label: 'Configurações', icon: Settings, path: '/admin/configuracoes', adminOnly: true },
  ],
};

export function PortalSidebar({ isOpen, onClose }: PortalSidebarProps) {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { departmentsWithModules } = useModulePermissions();

  // Build dynamic departments section from permissions
  const departmentsSection: MenuSection | null = departmentsWithModules.length > 0
    ? {
        title: 'Departamentos',
        items: departmentsWithModules.map(dept => ({
          label: dept.name,
          icon: getDepartmentIcon(dept.name),
          path: `/departamentos/${dept.name.toLowerCase().replace(/\s+/g, '-')}`,
          requiresAuth: true,
          subItems: dept.modules
            .filter(m => m.module_route)
            .map(m => ({
              label: m.module_name,
              icon: getModuleIcon(m.module_icon),
              path: m.module_route,
              requiresAuth: true,
            })),
        })),
      }
    : null;

  const menuSections: MenuSection[] = [
    ...staticMenuSections,
    ...(departmentsSection ? [departmentsSection] : []),
    adminSection,
  ];

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
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

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
                          {item.subItems && item.subItems.length > 0 && (
                            <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                              {item.subItems.map((subItem) => (
                                shouldShowItem(subItem) && (
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
