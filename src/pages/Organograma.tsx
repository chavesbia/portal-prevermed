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
  department_names: string[];
  direct_leader_id: string | null;
  direct_manager_id: string | null;
  children: OrgNode[];
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
  const hasChildren = node.children.length > 0;
  const label = hierarchyLabels[node.hierarchy_position] || '';

  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        'flex flex-col items-center p-3 rounded-xl border shadow-sm bg-card min-w-[160px] max-w-[220px] text-center transition-all hover:shadow-md',
        isRoot && 'ring-2 ring-primary/30 shadow-lg'
      )}>
        <Avatar className={cn('mb-2', isRoot ? 'h-14 w-14' : 'h-10 w-10')}>
          <AvatarImage src={node.photo_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getInitials(node.full_name)}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm leading-tight">{node.full_name}</p>
        {node.position && (
          <p className="text-xs text-muted-foreground mt-0.5">{node.position}</p>
        )}
        {node.department_names.length > 0 && (
          <p className="text-xs text-muted-foreground">{node.department_names.join(', ')}</p>
        )}
        {label && (
          <Badge variant="outline" className={cn('mt-1 text-[10px] px-1.5 py-0', hierarchyColors[node.hierarchy_position])}>
            {label}
          </Badge>
        )}
      </div>

      {hasChildren && (
        <>
          <div className="w-px h-6 bg-border" />
          {node.children.length > 1 && (
            <div className="relative w-full flex justify-center">
              <div className="absolute top-0 h-px bg-border"
                style={{
                  left: `${100 / (node.children.length * 2)}%`,
                  right: `${100 / (node.children.length * 2)}%`,
                }}
              />
            </div>
          )}
          <div className="flex gap-4 flex-wrap justify-center">
            {node.children.map(child => (
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
      .select('id, user_id, full_name, position, hierarchy_position, profile_photo_url, direct_leader_id, direct_manager_id')
      .eq('status', 'active');

    if (!profiles || profiles.length === 0) {
      setIsLoading(false);
      return;
    }

    const userIds = profiles.map(p => p.user_id);

    const { data: userDepts } = await supabase
      .from('user_departments')
      .select('user_id, department_id')
      .in('user_id', userIds);

    const { data: depts } = await supabase
      .from('departments')
      .select('id, name');

    const deptMap = new Map((depts || []).map(d => [d.id, d.name]));

    // Build user -> all department names
    const userDeptNames = new Map<string, string[]>();
    (userDepts || []).forEach(ud => {
      const name = deptMap.get(ud.department_id);
      if (name) {
        if (!userDeptNames.has(ud.user_id)) userDeptNames.set(ud.user_id, []);
        userDeptNames.get(ud.user_id)!.push(name);
      }
    });

    // Create node map
    const nodeMap = new Map<string, OrgNode>();
    profiles.forEach(p => {
      nodeMap.set(p.user_id, {
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        position: p.position || '',
        hierarchy_position: p.hierarchy_position || 'team_member',
        photo_url: p.profile_photo_url || undefined,
        department_names: userDeptNames.get(p.user_id) || [],
        direct_leader_id: p.direct_leader_id,
        direct_manager_id: p.direct_manager_id,
        children: [],
      });
    });

    // Build tree using direct relationships
    const rootNodes: OrgNode[] = [];
    const assignedIds = new Set<string>();

    nodeMap.forEach(node => {
      // Try to attach to direct_leader_id first, then direct_manager_id
      const parentId = node.direct_leader_id || node.direct_manager_id;
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.children.push(node);
        assignedIds.add(node.user_id);
      }
    });

    // Nodes not assigned to anyone are root candidates
    nodeMap.forEach(node => {
      if (!assignedIds.has(node.user_id)) {
        rootNodes.push(node);
      }
    });

    // Sort children by hierarchy
    const hierarchyOrder: Record<string, number> = {
      director: 0, manager: 1, coordinator: 2, leader: 3, team_member: 4,
    };

    const sortChildren = (node: OrgNode) => {
      node.children.sort((a, b) =>
        (hierarchyOrder[a.hierarchy_position] ?? 4) - (hierarchyOrder[b.hierarchy_position] ?? 4)
      );
      node.children.forEach(sortChildren);
    };

    rootNodes.sort((a, b) =>
      (hierarchyOrder[a.hierarchy_position] ?? 4) - (hierarchyOrder[b.hierarchy_position] ?? 4)
    );
    rootNodes.forEach(sortChildren);

    setOrgTree(rootNodes);
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
                Organograma não configurado. Configure os vínculos de líder/gestor direto nos cadastros dos colaboradores.
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
