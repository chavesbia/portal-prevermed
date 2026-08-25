import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, FileX, Info } from 'lucide-react';
import { formatDateBR } from '@/lib/contractual/format';
import { ContratualRescisaoDetalhe } from './ContratualRescisaoDetalhe';

import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ContratualRescisoes() {
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);


  const { data: rescisoes, isLoading } = useQuery({
    queryKey: ['contract-rescisoes-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_rescisoes')
        .select(`
          *,
          companies (
            razao_social,
            soc_code
          ),
          contract_contratos (
            numero_contrato
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const filtered = rescisoes?.filter(r => {
    const term = search.toLowerCase();
    const razao = r.companies?.razao_social?.toLowerCase() || '';
    const soc = r.companies?.soc_code?.toLowerCase() || '';
    const num = r.contract_contratos?.numero_contrato?.toLowerCase() || '';
    const manual = r.numero_contrato_manual?.toLowerCase() || '';
    
    return razao.includes(term) || soc.includes(term) || num.includes(term) || manual.includes(term);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa ou contrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Previsão Inat.</TableHead>
              <TableHead>Data Real</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhuma rescisão encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div>{r.companies?.razao_social}</div>
                    <div className="text-[10px] text-muted-foreground">SOC: {r.companies?.soc_code}</div>
                  </TableCell>
                  <TableCell>
                    {r.contrato_id ? (
                      <Badge variant="outline">{r.contract_contratos?.numero_contrato || 'Sem número'}</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        {r.numero_contrato_manual || 'Legado'}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent>Contrato Manual/Legado</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{r.motivo?.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <div>{r.solicitante_nome || '—'}</div>
                    <div className="text-[10px] text-muted-foreground">{r.solicitante_cargo}</div>
                  </TableCell>
                  <TableCell>{formatDateBR(r.data_prevista_inativacao)}</TableCell>
                  <TableCell>{formatDateBR(r.data_real_inativacao)}</TableCell>
                  <TableCell>
                    {r.data_real_inativacao ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                        Confirmada
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                        Solicitada
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
