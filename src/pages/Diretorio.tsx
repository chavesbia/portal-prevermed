import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Contact, Search, Mail, Phone } from 'lucide-react';

interface DirectoryEntry {
  id: string;
  full_name: string;
  nickname: string | null;
  profile_photo_url: string | null;
  contact_email: string | null;
  email: string;
  phone_extension: string | null;
  position: string | null;
  department_name?: string;
}

export default function Diretorio() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDirectory = async () => {
      setIsLoading(true);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, nickname, profile_photo_url, contact_email, email, phone_extension, position')
        .eq('status', 'active')
        .order('full_name');

      if (profiles) {
        const userIds = profiles.map(p => p.user_id);
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

        setEntries(profiles.map(p => ({
          ...p,
          department_name: userDeptMap.get(p.user_id) || undefined,
        })));
      }
      setIsLoading(false);
    };
    fetchDirectory();
  }, []);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return e.full_name.toLowerCase().includes(q) ||
      (e.nickname && e.nickname.toLowerCase().includes(q)) ||
      (e.position && e.position.toLowerCase().includes(q)) ||
      (e.department_name && e.department_name.toLowerCase().includes(q));
  });

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Contact className="h-6 w-6" />
          Diretório de Contatos
        </h1>
        <p className="page-subtitle">Encontre informações de contato dos colaboradores.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cargo ou departamento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="card-elevated p-12 text-center">
          <Contact className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum contato encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((entry) => (
            <Card key={entry.id} className="card-elevated hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={entry.profile_photo_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(entry.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    <span className="font-medium">{entry.full_name}</span>
                    {entry.nickname && (
                      <span className="text-muted-foreground font-normal"> ({entry.nickname})</span>
                    )}
                  </p>
                  {entry.position && (
                    <p className="text-xs text-muted-foreground truncate">{entry.position}</p>
                  )}
                  {entry.department_name && (
                    <p className="text-xs text-muted-foreground truncate">{entry.department_name}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {entry.phone_extension && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Phone className="h-3 w-3" />
                        {entry.phone_extension}
                      </span>
                    )}
                    {(entry.contact_email || entry.email) && (
                      <a
                        href={`mailto:${entry.contact_email || entry.email}`}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
                        title={entry.contact_email || entry.email}
                      >
                        <Mail className="h-3 w-3" />
                        E-mail
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
