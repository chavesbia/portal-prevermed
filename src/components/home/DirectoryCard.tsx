import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Contact, Search, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DirectoryEntry {
  id: string;
  full_name: string;
  nickname: string | null;
  profile_photo_url: string | null;
  contact_email: string | null;
  email: string;
  phone_extension: string | null;
  position: string | null;
}

export function DirectoryCard() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchDirectory = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, profile_photo_url, contact_email, email, phone_extension, position')
        .eq('status', 'active')
        .order('full_name');

      if (data) setEntries(data);
    };
    fetchDirectory();
  }, []);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return e.full_name.toLowerCase().includes(q) ||
      (e.nickname && e.nickname.toLowerCase().includes(q)) ||
      (e.position && e.position.toLowerCase().includes(q));
  });

  const displayed = filtered.slice(0, 8);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Contact className="h-5 w-5 text-primary" />
          Diretório de Contatos
        </CardTitle>
        <div className="relative mt-2">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum contato encontrado
          </p>
        ) : (
          <div className="space-y-2">
            {displayed.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={entry.profile_photo_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(entry.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {entry.nickname || entry.full_name.split(' ')[0]} {entry.full_name.split(' ').slice(-1)[0]}
                  </p>
                  {entry.position && (
                    <p className="text-xs text-muted-foreground truncate">{entry.position}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {entry.phone_extension && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5" title="Ramal">
                      <Phone className="h-3 w-3" />
                      {entry.phone_extension}
                    </span>
                  )}
                  {(entry.contact_email || entry.email) && (
                    <a
                      href={`mailto:${entry.contact_email || entry.email}`}
                      className="text-primary hover:text-primary/80"
                      title={entry.contact_email || entry.email}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {filtered.length > 8 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{filtered.length - 8} contatos
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
