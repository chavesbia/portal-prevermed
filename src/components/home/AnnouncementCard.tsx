import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Megaphone, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Announcement } from '@/types/portal';

interface AnnouncementCardProps {
  announcement: Announcement;
  compact?: boolean;
}

export function AnnouncementCard({ announcement, compact = false }: AnnouncementCardProps) {
  const timeAgo = formatDistanceToNow(new Date(announcement.published_at), {
    addSuffix: true,
    locale: ptBR,
  });

  if (compact) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Megaphone className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{announcement.title}</h4>
            {announcement.is_pinned && (
              <Pin className="h-3 w-3 text-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="card-elevated animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {announcement.author_role === 'rh' ? 'RH' : 'ADM'}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{announcement.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {announcement.author_name || (announcement.author_role === 'rh' ? 'Recursos Humanos' : 'Administração')}
                <span className="mx-1">•</span>
                {timeAgo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {announcement.is_pinned && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Pin className="h-3 w-3" />
                Fixado
              </Badge>
            )}
            <Badge className="badge-department">
              {announcement.author_role === 'rh' ? 'RH' : 'ADM Master'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-foreground/90 whitespace-pre-wrap">{announcement.content}</p>
      </CardContent>
    </Card>
  );
}
