import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
  Boxes,
  X,
  ExternalLink,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { launchExternalModule } from '@/lib/module-launcher';
import { toast } from '@/hooks/use-toast';

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
  isDynamic?: boolean;
}

interface Department {
  id: string;
  name: string;
}

// Map department names to specific icons
const departmentIconMap: Record<string, LucideIcon> = {
  'Comercial': DollarSign,
  'Financeiro': DollarSign,
  'RH': Users,
  'Recursos Humanos': Users,
  'TI': FileCode,
  'Tecnologia': FileCode,
  'Atendimento': HeadphonesIcon,
  'Marketing': Megaphone,
  'Jurídico': Scale,
  'Logística': Truck,
  'Operações': Wrench,
  'Manutenção': Wrench,
  'Treinamento': GraduationCap,
  'Saúde': Heart,
  'Médico': Stethoscope,
  'Administrativo': Briefcase,
};

const getDepartmentIcon = (deptName: string): LucideIcon => {
  // Check for exact match first
  if (departmentIconMap[deptName]) {
    return departmentIconMap[deptName];
  }
  // Check for partial match
  for (const [key, icon] of Object.entries(departmentIconMap)) {
    if (deptName.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }
  // Default icon
  return Building2;
};

// Static menu sections
const staticMenuSections: MenuSection[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Início', icon: Home, path: '/' },
      { label: 'Módulos', icon: Boxes, path: '/modulos', requiresAuth: true },
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
    { label: 'Módulos', icon: Boxes, path: '/admin/modulos', adminOnly: true },
    { label: 'Documentos', icon: FolderOpen, path: '/admin/documentos', adminOnly: true },
    { label: 'Permissões', icon: Shield, path: '/admin/permissoes', adminOnly: true },
    { label: 'Auditoria', icon: ClipboardList, path: '/admin/auditoria', adminOnly: true },
    { label: 'Configurações', icon: Settings, path: '/admin/configuracoes', adminOnly: true },
  ],
};

// Map of department names to external links with module IDs
const departmentExternalLinks: Record<string, { label: string; icon: React.ElementType; path: string; isExternal: boolean; moduleSlug: string }[]> = {
  'Comercial': [
    { 
      label: 'Precificação', 
      icon: Calculator, 
      path: 'https://precificacao-prevermed.lovable.app', 
      isExternal: true,
      moduleSlug: 'Precificação',
    },
  ],
  'Engenharia': [
    { 
      label: 'Gestão de O.S', 
      icon: ClipboardList, 
      path: 'https://os-prevermed.lovable.app', 
      isExternal: true,
      moduleSlug: 'Gestão de O.S',
    },
  ],
};

export function PortalSidebar({ isOpen, onClose }: PortalSidebarProps) {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [moduleMap, setModuleMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchDepartments();
    fetchModuleIds();
  }, []);

  const fetchModuleIds = async () => {
    const { data } = await supabase
      .from('modules')
      .select('id, name')
      .eq('is_active', true);
    if (data) {
      setModuleMap(new Map(data.map(m => [m.name, m.id])));
    }
  };

  const handleExternalClick = async (e: React.MouseEvent, path: string, moduleSlug: string) => {
    e.preventDefault();
    const moduleId = moduleMap.get(moduleSlug);
    if (!moduleId) {
      window.open(path, '_blank');
      return;
    }
    const result = await launchExternalModule(path, moduleId);
    if (!result.success) {
      toast({ title: 'Acesso negado', description: result.error, variant: 'destructive' });
    }
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      return;
    }

    setDepartments(data || []);
  };

  // Build dynamic departments section
  const departmentsSection: MenuSection = {
    title: 'Departamentos',
    items: departments.map(dept => {
      const externalLinks = departmentExternalLinks[dept.name];
      return {
        label: dept.name,
        icon: getDepartmentIcon(dept.name),
        path: `/departamentos/${dept.name.toLowerCase().replace(/\s+/g, '-')}`,
        requiresAuth: true,
        subItems: externalLinks?.map(link => ({
          ...link,
          requiresAuth: true,
        })),
      };
    }),
    isDynamic: true,
  };

  // Combine all sections
  const menuSections: MenuSection[] = [
    ...staticMenuSections,
    ...(departments.length > 0 ? [departmentsSection] : []),
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
                                      onClick={(e) => handleExternalClick(e, subItem.path, (subItem as any).moduleSlug || subItem.label)}
                                      className="menu-item flex items-center justify-between text-sm cursor-pointer"
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
