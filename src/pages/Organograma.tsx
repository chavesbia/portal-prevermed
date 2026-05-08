import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, ChevronRight, Network, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrgNode {
  id: string;
  user_id: string;
  full_name: string;
  position: string;
  hierarchy_position: string;
  photo_url?: string;
  department_name: string;
  children: OrgNode[];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function OrgNodeRow({ node, level = 0 }: { node: OrgNode; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="animate-fade-in">
      <div
        className={cn(
          'flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors',
          hasChildren && 'cursor-pointer'
        )}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}

        <Avatar className="h-8 w-8">
          <AvatarImage src={node.photo_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {getInitials(node.full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{node.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {node.position || ''}{node.position && node.department_name ? ' • ' : ''}{node.department_name}
          </p>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l border-border ml-6">
          {node.children.map((child) => (
            <OrgNodeRow key={child.id} node={child} level={level + 1} />
          ))}
        </div>
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
      .select('user_id, department_id, is_lotacao')
      .in('user_id', userIds);

    const { data: depts } = await supabase
      .from('departments')
      .select('id, name');

    const deptMap = new Map((depts || []).map(d => [d.id, d.name]));

    const userDeptMap = new Map<string, string>();
    (userDepts || []).forEach(ud => {
      const deptName = deptMap.get(ud.department_id) || '';
      if (ud.is_lotacao || !userDeptMap.has(ud.user_id)) {
        userDeptMap.set(ud.user_id, deptName);
      }
    });

    const nodeMap = new Map<string, OrgNode>();
    profiles.forEach(p => {
      nodeMap.set(p.user_id, {
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        position: p.position || '',
        hierarchy_position: p.hierarchy_position || 'team_member',
        photo_url: p.profile_photo_url || undefined,
        department_name: userDeptMap.get(p.user_id) || '',
        children: [],
      });
    });

    const assignedIds = new Set<string>();
    nodeMap.forEach(node => {
      const parentId = profiles.find(p => p.user_id === node.user_id)?.direct_leader_id
        || profiles.find(p => p.user_id === node.user_id)?.direct_manager_id;
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.children.push(node);
        assignedIds.add(node.user_id);
      }
    });

    const hierarchyOrder: Record<string, number> = {
      director: 0, manager: 1, coordinator: 2, leader: 3, team_member: 4,
    };

    const sortChildren = (node: OrgNode) => {
      node.children.sort((a, b) =>
        (hierarchyOrder[a.hierarchy_position] ?? 4) - (hierarchyOrder[b.hierarchy_position] ?? 4)
      );
      node.children.forEach(sortChildren);
    };

    const rootNodes: OrgNode[] = [];
    nodeMap.forEach(node => {
      if (!assignedIds.has(node.user_id)) {
        rootNodes.push(node);
      }
    });

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
            <div className="space-y-1">
              {orgTree.map(node => (
                <OrgNodeRow key={node.id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
