import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil } from 'lucide-react';
import { formatCNPJ } from '@/lib/contractual/format';
import { ContratualClienteDialog } from './ContratualClienteDialog';

interface Props { canEdit: boolean }

export default function ContratualClientes({ canEdit }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['contract-clientes', search],
    queryFn: async () => {
      let q = supabase.from('contract_clientes').select('*').order('razao_social');
      if (search) {
        const term = `%${search.replace(/\D/g, '') || search}%`;
        q = q.or(`razao_social.ilike.%${search}%,cnpj.ilike.${term},nome_fantasia.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por CNPJ ou razão social…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* "Novo Cliente" desativado: novos clientes contratuais são criados automaticamente
            ao selecionar uma empresa da base mestre do SOC no assistente de Novo Contrato. */}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!isLoading && clientes.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum cliente cadastrado.</TableCell></TableRow>
                )}
                {clientes.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.razao_social}</div>
                      {c.nome_fantasia && <div className="text-xs text-muted-foreground">{c.nome_fantasia}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatCNPJ(c.cnpj)}</TableCell>
                    <TableCell>{[c.cidade, c.estado].filter(Boolean).join(' / ')}</TableCell>
                    <TableCell>
                      {c.situacao_cadastral && (
                        <Badge variant="secondary" className={
                          c.situacao_cadastral.toUpperCase() === 'ATIVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100'
                        }>{c.situacao_cadastral}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => { setEditing(c); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ContratualClienteDialog
        open={open}
        onOpenChange={setOpen}
        cliente={editing}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['contract-clientes'] }); setOpen(false); }}
      />
    </div>
  );
}
