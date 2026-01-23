import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Megaphone, Pin, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Announcement } from '@/types/portal';

interface AnnouncementCardProps {
  announcement: Announcement & { image_url?: string };
  compact?: boolean;
}

export function AnnouncementCard({ announcement, compact = false }: AnnouncementCardProps) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  
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
    <>
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
        <CardContent className="space-y-4">
          <p className="text-foreground/90 whitespace-pre-wrap">{announcement.content}</p>
          
          {announcement.image_url && (
            <img 
              src={announcement.image_url} 
              alt="Imagem do comunicado" 
              className="rounded-lg max-h-80 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setIsImageOpen(true)}
            />
          )}
        </CardContent>
      </Card>

      {/* Image Lightbox Dialog */}
      <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
          <button
            onClick={() => setIsImageOpen(false)}
            className="absolute top-2 right-2 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {announcement.image_url && (
            <img 
              src={announcement.image_url} 
              alt="Imagem do comunicado ampliada" 
              className="rounded-lg w-full max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}