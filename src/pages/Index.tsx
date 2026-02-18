import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AnnouncementCard } from '@/components/home/AnnouncementCard';
import { BirthdayCard } from '@/components/home/BirthdayCard';
import { DocumentList } from '@/components/home/DocumentList';
import { UsefulLinks } from '@/components/home/UsefulLinks';
import { OrgChartSimple } from '@/components/home/OrgChartSimple';
import { UnitsCard } from '@/components/home/UnitsCard';
import { CalendarPreviewCard } from '@/components/home/CalendarPreviewCard';
import { DirectoryCard } from '@/components/home/DirectoryCard';
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

export default function Index() {
  const navigate = useNavigate();
  const [usefulLinks, setUsefulLinks] = useState<UsefulLink[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [allBirthdays, setAllBirthdays] = useState<Birthday[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [orgChart, setOrgChart] = useState<OrgChartNode[]>([]);

  useEffect(() => {
    fetchLinks();
    fetchAnnouncements();
    fetchBirthdays();
    fetchDocuments();
    fetchOrgChart();
  }, []);

  const fetchLinks = async () => {
    const { data } = await supabase
      .from('useful_links')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (data) {
      setUsefulLinks(data.map(link => ({
        id: link.id,
        title: link.title,
        url: link.url,
        description: link.description,
        icon: link.icon,
        order: link.sort_order ?? 0,
        is_active: link.is_active ?? true,
      })));
    }
  };

  const fetchAnnouncements = async () => {
    const { data: announcementsData } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_public', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (announcementsData) {
      // Get author profiles
      const authorIds = [...new Set(announcementsData.map(a => a.created_by).filter(Boolean))];
      let authorMap = new Map<string, { full_name: string; profile_photo_url: string | null }>();

      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, profile_photo_url')
          .in('user_id', authorIds);

        if (profiles) {
          profiles.forEach(p => authorMap.set(p.user_id, p));
        }
      }

      setAnnouncements(announcementsData.map(ann => {
        const author = ann.created_by ? authorMap.get(ann.created_by) : null;
        return {
          id: ann.id,
          title: ann.title,
          content: ann.content,
          author_id: ann.created_by || '',
          author_name: author?.full_name || 'Administração',
          author_photo: author?.profile_photo_url || undefined,
          author_role: 'adm_master' as const,
          is_pinned: ann.is_pinned ?? false,
          image_url: ann.image_url,
          published_at: ann.published_at || ann.created_at,
          created_at: ann.created_at,
        };
      }));
    }
  };

  const fetchBirthdays = async () => {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, nickname, profile_photo_url, birth_date')
      .eq('status', 'active')
      .not('birth_date', 'is', null);

    if (profilesData) {
      const userIds = profilesData.map(p => p.user_id);
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('user_id, department_id')
        .in('user_id', userIds)
        .eq('is_primary', true);

      const { data: depts } = await supabase
        .from('departments')
        .select('id, name');

      const deptMap = new Map((depts || []).map(d => [d.id, d.name]));
      const userDeptMap = new Map((userDepts || []).map(ud => [ud.user_id, deptMap.get(ud.department_id) || '']));

      const birthdays: Birthday[] = profilesData
        .filter(p => p.birth_date)
        .map(p => ({
          id: p.id,
          user_id: p.user_id,
          full_name: p.full_name,
          nickname: p.nickname || undefined,
          photo_url: p.profile_photo_url || undefined,
          birth_date: p.birth_date!,
          department_name: userDeptMap.get(p.user_id) || undefined,
        }));

      setAllBirthdays(birthdays);
    }
  };

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setDocuments(data.map(doc => ({
        id: doc.id,
        title: doc.name,
        description: doc.description || undefined,
        file_url: doc.file_url,
        file_type: doc.file_type || 'application/pdf',
        category: 'Documento',
        uploader_id: doc.uploaded_by || '',
        download_count: 0,
        created_at: doc.created_at,
      })));
    }
  };

  const fetchOrgChart = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, position, hierarchy_position, profile_photo_url')
      .eq('status', 'active')
      .not('hierarchy_position', 'is', null);

    if (!profiles || profiles.length === 0) return;

    const userIds = profiles.map(p => p.user_id);
    
    // Fetch ALL user departments (not just primary) so we can fallback
    const { data: userDepts } = await supabase
      .from('user_departments')
      .select('user_id, department_id, is_primary')
      .in('user_id', userIds);

    const { data: depts } = await supabase
      .from('departments')
      .select('id, name');

    const deptMap = new Map((depts || []).map(d => [d.id, d.name]));
    
    // Build user->department map: prefer primary, fallback to first department
    const userDeptMap = new Map<string, string>();
    (userDepts || []).forEach(ud => {
      const deptName = deptMap.get(ud.department_id) || '';
      if (ud.is_primary || !userDeptMap.has(ud.user_id)) {
        userDeptMap.set(ud.user_id, deptName);
      }
    });

    const hierarchyOrder: Record<string, number> = {
      director: 0, manager: 1, coordinator: 2, leader: 3, team_member: 4,
    };

    const nodes: OrgChartNode[] = profiles
      .sort((a, b) => (hierarchyOrder[a.hierarchy_position || 'team_member'] || 4) - (hierarchyOrder[b.hierarchy_position || 'team_member'] || 4))
      .map(p => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        position: p.position || p.hierarchy_position || '',
        hierarchy_position: (p.hierarchy_position as any) || 'liderado',
        photo_url: p.profile_photo_url || undefined,
        department_name: userDeptMap.get(p.user_id) || '',
      }));

    // Build tree: directors at top, managers as children, etc.
    const directors = nodes.filter(n => ['director', 'diretor'].includes(n.hierarchy_position));
    const managers = nodes.filter(n => ['manager', 'gerente'].includes(n.hierarchy_position));
    const coordinators = nodes.filter(n => ['coordinator', 'coordenador'].includes(n.hierarchy_position));
    const leaders = nodes.filter(n => ['leader', 'lider', 'líder'].includes(n.hierarchy_position));
    const teamMembers = nodes.filter(n => ['team_member', 'liderado'].includes(n.hierarchy_position));

    // Group team members by department
    const deptGroups = new Map<string, OrgChartNode[]>();
    [...teamMembers, ...leaders, ...coordinators].forEach(n => {
      const dept = n.department_name || 'Sem departamento';
      if (!deptGroups.has(dept)) deptGroups.set(dept, []);
      deptGroups.get(dept)!.push(n);
    });

    // Assign children to managers based on department
    managers.forEach(m => {
      m.children = deptGroups.get(m.department_name) || [];
    });

    // Managers without children get all ungrouped members
    if (directors.length > 0) {
      directors[0].children = managers.length > 0 ? managers : [...coordinators, ...leaders, ...teamMembers];
      setOrgChart(directors);
    } else if (managers.length > 0) {
      setOrgChart(managers);
    } else {
      setOrgChart(nodes.slice(0, 20));
    }
  };

  const todayCount = allBirthdays.filter(b => {
    const now = new Date();
    const bd = new Date(b.birth_date + 'T00:00:00');
    return bd.getDate() === now.getDate() && bd.getMonth() === now.getMonth();
  }).length;

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
                <p className="stat-value text-lg">{todayCount}</p>
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
                <p className="stat-value text-lg">{documents.length}</p>
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
          <BirthdayCard allBirthdays={allBirthdays} />
          
          <CalendarPreviewCard />
          
          <DocumentList 
            documents={documents}
            onViewAll={() => navigate('/documentos')}
          />
          
          <UsefulLinks links={usefulLinks} />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        <OrgChartSimple data={orgChart} />
        <DirectoryCard />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <UnitsCard />
      </div>
    </div>
  );
}
