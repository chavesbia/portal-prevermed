import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnnouncementCard } from '@/components/home/AnnouncementCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Megaphone, Search, Filter } from 'lucide-react';
import type { Announcement } from '@/types/portal';

export default function Comunicados() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPinned, setFilterPinned] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_public', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (data) {
        const mapped = data.map(ann => ({
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
        }));
        setAnnouncements(mapped);
        setFilteredAnnouncements(mapped);
      }
      setIsLoading(false);
    };
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    let filtered = [...announcements];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(ann => 
        ann.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ann.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by pinned status
    if (filterPinned === 'pinned') {
      filtered = filtered.filter(ann => ann.is_pinned);
    } else if (filterPinned === 'not_pinned') {
      filtered = filtered.filter(ann => !ann.is_pinned);
    }

    setFilteredAnnouncements(filtered);
  }, [searchTerm, filterPinned, announcements]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Comunicados
        </h1>
        <p className="page-subtitle">
          Todos os comunicados e avisos importantes da empresa.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar comunicados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterPinned} onValueChange={setFilterPinned}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pinned">Apenas Fixados</SelectItem>
                <SelectItem value="not_pinned">Não Fixados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Announcements List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="p-6 text-center text-muted-foreground">
            Carregando comunicados...
          </Card>
        ) : filteredAnnouncements.length > 0 ? (
          filteredAnnouncements.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))
        ) : (
          <Card className="p-6 text-center text-muted-foreground">
            {searchTerm || filterPinned !== 'all' 
              ? 'Nenhum comunicado encontrado com os filtros aplicados.'
              : 'Nenhum comunicado publicado.'}
          </Card>
        )}
      </div>

      {/* Results count */}
      {!isLoading && filteredAnnouncements.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Exibindo {filteredAnnouncements.length} de {announcements.length} comunicado(s)
        </p>
      )}
    </div>
  );
}
