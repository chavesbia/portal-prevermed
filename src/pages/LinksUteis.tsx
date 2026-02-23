import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Link as LinkIcon, ExternalLink, Search, Globe, BookOpen, FileText,
  Calculator, Briefcase, Heart, GraduationCap, Wrench, Phone, Mail
} from 'lucide-react';

interface UsefulLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  category: string | null;
}

const iconMap: Record<string, React.ElementType> = {
  globe: Globe, book: BookOpen, file: FileText, calculator: Calculator,
  briefcase: Briefcase, heart: Heart, graduation: GraduationCap,
  wrench: Wrench, phone: Phone, mail: Mail, link: LinkIcon,
};

const getIcon = (iconName: string | null) => {
  if (!iconName) return LinkIcon;
  return iconMap[iconName.toLowerCase()] || LinkIcon;
};

export default function LinksUteis() {
  const [links, setLinks] = useState<UsefulLink[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLinks = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('useful_links')
        .select('id, title, url, description, icon, category')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setLinks(data);
      setIsLoading(false);
    };
    fetchLinks();
  }, []);

  const filtered = links.filter(l => {
    const q = search.toLowerCase();
    return l.title.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.category?.toLowerCase().includes(q);
  });

  const categories = [...new Set(filtered.map(l => l.category).filter(Boolean))] as string[];
  const uncategorized = filtered.filter(l => !l.category);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <LinkIcon className="h-6 w-6" />
          Links Úteis
        </h1>
        <p className="page-subtitle">Acesse rapidamente os links e ferramentas disponíveis.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar links..."
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
          <LinkIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum link encontrado</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.filter(l => l.category === cat).map(link => {
                  const Icon = getIcon(link.icon);
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Card className="card-elevated hover:shadow-md transition-all group h-full">
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm flex items-center gap-1">
                              {link.title}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                            </p>
                            {link.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{link.description}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div>
              {categories.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Outros</h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uncategorized.map(link => {
                  const Icon = getIcon(link.icon);
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Card className="card-elevated hover:shadow-md transition-all group h-full">
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm flex items-center gap-1">
                              {link.title}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                            </p>
                            {link.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{link.description}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
