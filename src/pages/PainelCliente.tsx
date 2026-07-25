import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Hash, CheckCircle2, XCircle, Loader2, FileText, ExternalLink, ClipboardList, FileCheck2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CompanySelector } from '@/components/shared/CompanySelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { statusOSColors } from '@/types/os';

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

          <ContratosCard companyId={company.id} navigate={navigate} />

          <OrdensServicoCard companyId={company.id} navigate={navigate} />

          {[
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

function ContratosCard({ companyId, navigate }: { companyId: string; navigate: (to: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['painel-cliente-contratos', companyId],
    queryFn: async () => {
      const { data: clientes, error: cErr } = await supabase
        .from('contract_clientes')
        .select('id')
        .eq('company_id', companyId);
      if (cErr) throw cErr;
      const clienteIds = (clientes ?? []).map((c) => c.id);
      if (clienteIds.length === 0) return [] as Contrato[];
      const { data: contratos, error } = await supabase
        .from('contract_contratos')
        .select('id, numero_contrato, status, data_inicio, data_fim, valor_mensal')
        .in('cliente_id', clienteIds)
        .order('data_inicio', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (contratos ?? []) as Contrato[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Contratos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum contrato encontrado para esta empresa.
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((c) => {
              const vencido = c.data_fim && c.data_fim < today;
              const vigente = !c.data_fim || c.data_fim >= today;
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {c.numero_contrato || 'Sem número'}
                      </span>
                      {c.status && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {c.status}
                        </Badge>
                      )}
                      {vencido ? (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 text-xs">
                          Vencido
                        </Badge>
                      ) : c.data_fim ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-xs">
                          Vigente
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Sem data de fim
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Vigência: {formatDate(c.data_inicio)} → {formatDate(c.data_fim)} • Mensal:{' '}
                      <span className="font-medium text-foreground">{formatBRL(c.valor_mensal)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/gestao-contratual?contrato=${c.id}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface OrdemServico {
  id: string;
  numero_os: string;
  status_os: string;
  data_registro: string | null;
  data_emissao: string | null;
  prazo_acordado: string | null;
  tipo_servico_resumo: string | null;
}

function OrdensServicoCard({ companyId, navigate }: { companyId: string; navigate: (to: string) => void }) {
  const MAX = 20;
  const { data, isLoading } = useQuery({
    queryKey: ['painel-cliente-os', companyId],
    queryFn: async () => {
      const { data: rows, error, count } = await supabase
        .from('ordens_servico')
        .select('id, numero_os, status_os, data_registro, data_emissao, prazo_acordado, tipo_servico_resumo', { count: 'exact' })
        .eq('company_id', companyId)
        .order('data_emissao', { ascending: false, nullsFirst: false })
        .order('data_registro', { ascending: false })
        .limit(MAX);
      if (error) throw error;
      return { rows: (rows ?? []) as OrdemServico[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const emAndamento = rows.filter((r) => r.status_os === 'Em andamento').length;
  const encerradas = rows.filter((r) => r.status_os === 'Encerrado').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> Ordens de Serviço
          </CardTitle>
          {!isLoading && total > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">Total: {total}</Badge>
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Em andamento: {emAndamento}</Badge>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Encerradas: {encerradas}</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma ordem de serviço encontrada para esta empresa.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{o.numero_os}</span>
                    <Badge className={`text-xs ${statusOSColors[o.status_os] ?? 'bg-muted text-muted-foreground'}`}>
                      {o.status_os}
                    </Badge>
                    {o.tipo_servico_resumo && (
                      <Badge variant="outline" className="text-xs">{o.tipo_servico_resumo}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Emissão: {formatDate(o.data_emissao ?? o.data_registro)}
                    {o.prazo_acordado && <> • Prazo: {formatDate(o.prazo_acordado)}</>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/gestao-os?os=${o.id}`)}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                </Button>
              </div>
            ))}
            {total > rows.length && (
              <div className="pt-2 text-center">
                <Button variant="link" size="sm" onClick={() => navigate('/gestao-os')}>
                  Ver todas ({total})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
