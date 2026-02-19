import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Network, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrgNode {
  id: string;
  user_id: string;
  full_name: string;
  position: string;
  hierarchy_position: string;
  photo_url?: string;
  department_name: string;
  children?: OrgNode[];
}

const hierarchyLabels: Record<string, string> = {
  director: 'Diretor',
  manager: 'Gerente',
  coordinator: 'Coordenador',
  leader: 'Líder',
  team_member: '',
};

const hierarchyColors: Record<string, string> = {
  director: 'bg-primary text-primary-foreground',
  manager: 'bg-primary/80 text-primary-foreground',
  coordinator: 'bg-accent text-accent-foreground',
  leader: 'bg-muted text-muted-foreground',
  team_member: 'bg-muted/50 text-muted-foreground',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function OrgNodeCard({ node, isRoot = false }: { node: OrgNode; isRoot?: boolean }) {
  const hasChildren = node.children && node.children.length > 0;
  const label = hierarchyLabels[node.hierarchy_position] || '';
  const showCard = node.hierarchy_position !== 'team_member';

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div className={cn(
        'flex flex-col items-center p-3 rounded-xl border shadow-sm bg-card min-w-[160px] max-w-[200px] text-center transition-all hover:shadow-md',
        isRoot && 'ring-2 ring-primary/30 shadow-lg'
      )}>
        <Avatar className={cn('mb-2', isRoot ? 'h-14 w-14' : 'h-10 w-10')}>
          <AvatarImage src={node.photo_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getInitials(node.full_name)}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm leading-tight">{node.full_name}</p>
        {node.position && node.position !== node.hierarchy_position && (
          <p className="text-xs text-muted-foreground mt-0.5">{node.position}</p>
        )}
        <p className="text-xs text-muted-foreground">{node.department_name}</p>
        {label && (
          <Badge variant="outline" className={cn('mt-1 text-[10px] px-1.5 py-0', hierarchyColors[node.hierarchy_position])}>
            {label}
          </Badge>
        )}
      </div>

      {/* Connector line down */}
      {hasChildren && (
        <>
          <div className="w-px h-6 bg-border" />
          {/* Horizontal connector for multiple children */}
          {node.children!.length > 1 && (
            <div className="relative w-full flex justify-center">
              <div className="absolute top-0 h-px bg-border"
                style={{
                  left: `${100 / (node.children!.length * 2)}%`,
                  right: `${100 / (node.children!.length * 2)}%`,
                }}
              />
            </div>
          )}
          <div className="flex gap-4 flex-wrap justify-center">
            {node.children!.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-border" />
                <OrgNodeCard node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Organograma() {
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrgChart();
  }, []);

  const fetchOrgChart = async () => {
    setIsLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, position, hierarchy_position, profile_photo_url')
      .eq('status', 'active')
      .not('hierarchy_position', 'is', null);

    if (!profiles || profiles.length === 0) {
      setIsLoading(false);
      return;
    }

    const userIds = profiles.map(p => p.user_id);

    const { data: userDepts } = await supabase
      .from('user_departments')
      .select('user_id, department_id, is_primary')
      .in('user_id', userIds);

    const { data: depts } = await supabase
      .from('departments')
      .select('id, name');

    const deptMap = new Map((depts || []).map(d => [d.id, d.name]));

    const userDeptMap = new Map<string, string>();
    (userDepts || []).forEach(ud => {
      const deptName = deptMap.get(ud.department_id) || '';
      if (ud.is_primary || !userDeptMap.has(ud.user_id)) {
        userDeptMap.set(ud.user_id, deptName);
      }
    });

    // Build user -> departments map for grouping
    const userDeptGroupMap = new Map<string, string[]>();
    (userDepts || []).forEach(ud => {
      const deptName = deptMap.get(ud.department_id) || '';
      if (!userDeptGroupMap.has(ud.user_id)) userDeptGroupMap.set(ud.user_id, []);
      userDeptGroupMap.get(ud.user_id)!.push(deptName);
    });

    const hierarchyOrder: Record<string, number> = {
      director: 0, manager: 1, coordinator: 2, leader: 3, team_member: 4,
    };

    const nodes: OrgNode[] = profiles
      .sort((a, b) => (hierarchyOrder[a.hierarchy_position || 'team_member'] || 4) - (hierarchyOrder[b.hierarchy_position || 'team_member'] || 4))
      .map(p => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        position: p.position || '',
        hierarchy_position: p.hierarchy_position || 'team_member',
        photo_url: p.profile_photo_url || undefined,
        department_name: userDeptMap.get(p.user_id) || '',
      }));

    const directors = nodes.filter(n => n.hierarchy_position === 'director');
    const managers = nodes.filter(n => n.hierarchy_position === 'manager');
    const coordinators = nodes.filter(n => n.hierarchy_position === 'coordinator');
    const leaders = nodes.filter(n => n.hierarchy_position === 'leader');
    const teamMembers = nodes.filter(n => n.hierarchy_position === 'team_member');

    // Group by department for assignment
    const deptGroups = new Map<string, OrgNode[]>();
    [...teamMembers, ...leaders, ...coordinators].forEach(n => {
      const dept = n.department_name || 'Sem departamento';
      if (!deptGroups.has(dept)) deptGroups.set(dept, []);
      deptGroups.get(dept)!.push(n);
    });

    // Assign children to managers based on department
    managers.forEach(m => {
      m.children = deptGroups.get(m.department_name) || [];
    });

    if (directors.length > 0) {
      directors[0].children = managers.length > 0 ? managers : [...coordinators, ...leaders, ...teamMembers];
      setOrgTree(directors);
    } else if (managers.length > 0) {
      setOrgTree(managers);
    } else {
      setOrgTree(nodes.slice(0, 20));
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Network className="h-6 w-6" />
          Organograma
        </h1>
        <p className="page-subtitle">
          Visualize a estrutura hierárquica da organização.
        </p>
      </div>

      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-primary" />
            Estrutura Organizacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : orgTree.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Organograma não configurado. Configure as posições hierárquicas dos colaboradores.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex flex-col items-center gap-2 min-w-max px-8 py-4">
                {orgTree.map(node => (
                  <OrgNodeCard key={node.id} node={node} isRoot />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}