import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AnnouncementCard } from '@/components/home/AnnouncementCard';
import { BirthdayCard } from '@/components/home/BirthdayCard';
import { DocumentList } from '@/components/home/DocumentList';
import { UsefulLinks } from '@/components/home/UsefulLinks';
import { OrgChartSimple } from '@/components/home/OrgChartSimple';
import { UnitsCard } from '@/components/home/UnitsCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Megaphone, 
  ArrowRight, 
  Users, 
  FileText,
  MessageSquare 
} from 'lucide-react';
import type { Announcement, Birthday, Document, UsefulLink, OrgChartNode } from '@/types/portal';

// Announcements are now fetched from database

const mockBirthdaysToday: Birthday[] = [
  {
    id: '1',
    user_id: '1',
    full_name: 'Maria Silva',
    nickname: 'Mari',
    birth_date: new Date().toISOString(),
    department_name: 'RH',
  },
];

const mockBirthdaysMonth: Birthday[] = [
  {
    id: '1',
    user_id: '1',
    full_name: 'Maria Silva',
    nickname: 'Mari',
    birth_date: new Date().toISOString(),
    department_name: 'RH',
  },
  {
    id: '2',
    user_id: '2',
    full_name: 'João Santos',
    birth_date: new Date(Date.now() + 5 * 86400000).toISOString(),
    department_name: 'Engenharia',
  },
  {
    id: '3',
    user_id: '3',
    full_name: 'Ana Costa',
    nickname: 'Aninha',
    birth_date: new Date(Date.now() + 10 * 86400000).toISOString(),
    department_name: 'Comercial',
  },
];

const mockDocuments: Document[] = [
  {
    id: '1',
    title: 'Manual do Colaborador 2025',
    description: 'Versão atualizada',
    file_url: '#',
    file_type: 'application/pdf',
    category: 'RH',
    uploader_id: '1',
    download_count: 45,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Política de Home Office',
    file_url: '#',
    file_type: 'application/pdf',
    category: 'Políticas',
    uploader_id: '1',
    download_count: 32,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: '3',
    title: 'Calendário de Feriados 2025',
    file_url: '#',
    file_type: 'application/pdf',
    category: 'RH',
    uploader_id: '1',
    download_count: 78,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

// Links are now fetched from database

const mockOrgChart: OrgChartNode[] = [
  {
    id: '1',
    user_id: '1',
    full_name: 'Dr. Carlos Eduardo',
    position: 'Diretor Geral',
    hierarchy_position: 'diretor',
    department_name: 'Diretoria',
    children: [
      {
        id: '2',
        user_id: '2',
        full_name: 'Ana Paula Souza',
        position: 'Gerente de RH',
        hierarchy_position: 'gerente',
        department_name: 'RH',
        children: [
          {
            id: '3',
            user_id: '3',
            full_name: 'Maria Silva',
            position: 'Analista de RH',
            hierarchy_position: 'liderado',
            department_name: 'RH',
          },
        ],
      },
      {
        id: '4',
        user_id: '4',
        full_name: 'Roberto Lima',
        position: 'Gerente Comercial',
        hierarchy_position: 'gerente',
        department_name: 'Comercial',
      },
    ],
  },
];

export default function Index() {
  const navigate = useNavigate();
  const [usefulLinks, setUsefulLinks] = useState<UsefulLink[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch useful links
      const { data: linksData } = await supabase
        .from('useful_links')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (linksData) {
        setUsefulLinks(linksData.map(link => ({
          id: link.id,
          title: link.title,
          url: link.url,
          description: link.description,
          icon: link.icon,
          order: link.sort_order ?? 0,
          is_active: link.is_active ?? true,
        })));
      }

      // Fetch announcements (pinned first, then by date)
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_public', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      if (announcementsData) {
        setAnnouncements(announcementsData.map(ann => ({
          id: ann.id,
          title: ann.title,
          content: ann.content,
          author_id: ann.created_by || '',
          author_name: 'Administração',
          author_role: 'adm_master' as const,
          is_pinned: ann.is_pinned ?? false,
          image_url: ann.image_url,
          published_at: ann.published_at || ann.created_at,
          created_at: ann.created_at,
        })));
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="page-header">
        <h1 className="page-title">Portal PreverMed</h1>
        <p className="page-subtitle">
          Bem-vindo ao portal interno. Confira as últimas atualizações.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="stat-value text-lg">{announcements.length}</p>
                <p className="stat-label text-xs">Comunicados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="stat-value text-lg">{mockBirthdaysToday.length}</p>
                <p className="stat-label text-xs">Aniversariantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <FileText className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="stat-value text-lg">{mockDocuments.length}</p>
                <p className="stat-label text-xs">Documentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-elevated">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <MessageSquare className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="stat-value text-lg">0</p>
                <p className="stat-label text-xs">Mensagens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Announcements */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Comunicados
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/comunicados')}>
              Ver todos <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-4">
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))
            ) : (
              <Card className="card-elevated p-6 text-center text-muted-foreground">
                Nenhum comunicado publicado.
              </Card>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar Content */}
        <div className="space-y-6">
          <BirthdayCard 
            birthdays={mockBirthdaysToday} 
            title="Aniversariantes do Dia" 
            variant="today"
          />
          
          <BirthdayCard 
            birthdays={mockBirthdaysMonth} 
            title="Aniversários do Mês" 
            variant="month"
          />
          
          <DocumentList 
            documents={mockDocuments}
            onViewAll={() => navigate('/documentos')}
          />
          
          <UsefulLinks links={usefulLinks} />
        </div>
      </div>

      {/* Org Chart Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        <OrgChartSimple data={mockOrgChart} />
        
        <UnitsCard />
      </div>
    </div>
  );
}
