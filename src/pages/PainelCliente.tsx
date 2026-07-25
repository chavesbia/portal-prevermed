import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Hash, CheckCircle2, XCircle, Loader2, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function formatDate(v: string | null | undefined) {
  if (!v) return '—';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Contrato {
  id: string;
  numero_contrato: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  valor_mensal: number | null;
}

function formatCnpj(v: string | null | undefined) {
  if (!v) return '—';
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

interface Company {
  id: string;
  soc_code: string;
  cnpj: string | null;
  razao_social: string;
  nome_abreviado: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_active: boolean;
}

function buildAddress(c: Company) {
  const parts = [
    [c.logradouro, c.numero].filter(Boolean).join(', '),
    c.complemento,
    c.bairro,
    [c.cidade, c.estado].filter(Boolean).join(' - '),
    c.cep,
  ].filter(Boolean);
  return parts.length ? parts.join(' • ') : '—';
}

export default function PainelCliente() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(companyId ?? null);

  useEffect(() => {
    setSelected(companyId ?? null);
  }, [companyId]);

  const { data: company, isLoading } = useQuery({
    queryKey: ['painel-cliente-company', selected],
    queryFn: async () => {
      if (!selected) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, soc_code, cnpj, razao_social, nome_abreviado, cep, logradouro, numero, complemento, bairro, cidade, estado, is_active')
        .eq('id', selected)
        .maybeSingle();
      if (error) throw error;
      return data as Company | null;
    },
    enabled: !!selected,
  });

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Painel do Cliente
        </h1>
        <p className="text-muted-foreground mt-1">
          Consulta gerencial consolidada por empresa cliente.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selecione uma empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanySelector
            value={selected}
            onChange={(id) => {
              setSelected(id);
              if (id) navigate(`/painel-cliente/${id}`);
              else navigate('/painel-cliente');
            }}
            placeholder="Buscar empresa por nome ou CNPJ…"
          />
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !selected && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione uma empresa acima para visualizar a ficha completa.
          </CardContent>
        </Card>
      )}

      {!isLoading && selected && !company && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Empresa não encontrada.
          </CardContent>
        </Card>
      )}

      {company && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-xl">{company.razao_social}</CardTitle>
                  {company.nome_abreviado && (
                    <p className="text-sm text-muted-foreground mt-1">{company.nome_abreviado}</p>
                  )}
                </div>
                {company.is_active ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Ativa
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Inativa
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">CNPJ</div>
                    <div className="font-medium">{formatCnpj(company.cnpj)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Código SOC</div>
                    <div className="font-medium">{company.soc_code || '—'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 md:col-span-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Endereço</div>
                    <div className="font-medium">{buildAddress(company)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {[
            { title: 'Contratos', desc: 'Contratos vigentes, encerrados e histórico.' },
            { title: 'Ordens de Serviço', desc: 'OS emitidas para esta empresa.' },
            { title: 'Guias', desc: 'Guias de atendimento e status operacional.' },
            { title: 'ASOs', desc: 'Atendimentos e liberações de ASO.' },
            { title: 'Ocorrências', desc: 'Tickets e ocorrências registradas.' },
          ].map((s) => (
            <Card key={s.title} className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
                <span>{s.desc}</span>
                <Badge variant="outline">Em breve</Badge>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
