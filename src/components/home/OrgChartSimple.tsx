import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Network, Users, ChevronsDown, ChevronsUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { OrgChartNode } from '@/types/portal';

interface OrgChartSimpleProps {
  data: OrgChartNode[];
  compact?: boolean;
}

interface OrgNodeProps {
  node: OrgChartNode;
  level?: number;
}

function OrgNode({ node, level = 0 }: OrgNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

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
          {node.children!.map((child) => (
            <OrgNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChartSimple({ data, compact = false }: OrgChartSimpleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-primary" />
            Organograma
          </CardTitle>
          {data.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="gap-1"
            >
              {isOpen ? (
                <>
                  <ChevronsUp className="h-4 w-4" /> Recolher
                </>
              ) : (
                <>
                  <ChevronsDown className="h-4 w-4" /> Expandir hierarquia
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Organograma não configurado
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[600px] overflow-auto">
              {data.map((node) => (
                <OrgNode key={node.id} node={node} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
