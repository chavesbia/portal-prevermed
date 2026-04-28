import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Link as LinkIcon, Globe, BookOpen, Briefcase, HeartPulse } from 'lucide-react';
import type { UsefulLink } from '@/types/portal';

interface UsefulLinksProps {
  links: UsefulLink[];
}

const getLinkIcon = (iconName?: string) => {
  switch (iconName) {
    case 'globe': return Globe;
    case 'book': return BookOpen;
    case 'briefcase': return Briefcase;
    case 'health': return HeartPulse;
    default: return LinkIcon;
  }
};

export function UsefulLinks({ links }: UsefulLinksProps) {
  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LinkIcon className="h-5 w-5 text-primary" />
          Links Úteis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum link disponível
          </p>
        ) : (
          <div className="grid gap-2">
            {links.map((link) => {
              const Icon = getLinkIcon(link.icon);
              
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm break-words group-hover:text-primary transition-colors">
                      {link.title}
                    </p>
                    {link.description && (
                      <p className="text-xs text-muted-foreground break-words">
                        {link.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
