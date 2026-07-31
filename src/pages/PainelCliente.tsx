import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Hash, CheckCircle2, XCircle, Loader2, FileText, ExternalLink, ClipboardList, FileCheck2, ChevronDown, Search, Copy, Phone, Mail, Contact, DollarSign, Info, Stethoscope, AlertTriangle, Plus } from 'lucide-react';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { NovoLaudoManualDialog } from '@/components/os/NovoLaudoManualDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { CompanySelector, useDuplicateCnpjCompanies } from '@/components/shared/CompanySelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { statusOSColors } from '@/types/os';
import { toast } from 'sonner';

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
            hideDuplicateWarning
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
          <DuplicateCnpjBanner
            company={company}
            onSwitch={(id) => { setSelected(id); navigate(`/painel-cliente/${id}`); }}
          />
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

          <ContatosCard companyId={company.id} />

          <PrecoCard companyId={company.id} />

          <ResponsaveisPcmsoCard companyId={company.id} />


          <ContratosCard companyId={company.id} navigate={navigate} />

          <OrdensServicoCard companyId={company.id} navigate={navigate} />

          <LaudosCard companyId={company.id} navigate={navigate} />


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

function DuplicateCnpjBanner({
  company,
  onSwitch,
}: {
  company: { id: string; cnpj: string | null };
  onSwitch: (id: string) => void;
}) {
  const { data: duplicates = [] } = useDuplicateCnpjCompanies(company);
  if (duplicates.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        Existe(m) outra(s) {duplicates.length} empresa(s) ativa(s) no SOC com este mesmo CNPJ
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">
          Confirme se você está visualizando o cadastro correto. Clique para trocar:
        </p>
        <div className="flex flex-wrap gap-2">
          {duplicates.map(d => (
            <Button
              key={d.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onSwitch(d.id)}
            >
              {d.razao_social} · SOC {d.soc_code}
            </Button>
          ))}
        </div>
      </AlertDescription>
    </Alert>
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

interface LaudoRow {
  id: string;
  ordem_id: string | null;
  unidade_id: string | null;
  tipo_laudo_nome: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  possui_vigencia: boolean | null;
  numero_os: string | null;
  responsavel_tecnico_nome: string | null;
}

type LaudoStatus = 'vencido' | 'a_vencer' | 'valido' | 'sem_vigencia';

function classifyLaudo(l: LaudoRow, todayISO: string): LaudoStatus {
  if (!l.possui_vigencia || !l.data_validade) return 'sem_vigencia';
  if (l.data_validade < todayISO) return 'vencido';
  const diff = (new Date(l.data_validade).getTime() - new Date(todayISO).getTime()) / 86400000;
  if (diff <= 30) return 'a_vencer';
  return 'valido';
}

interface UnitInfo {
  id: string;
  name: string | null;
  razao_social: string | null;
  soc_unit_code: string | null;
  cidade: string | null;
  estado: string | null;
}

interface UnitGroup {
  key: string;
  label: string;
  code: string | null;
  local: string | null;
  laudos: LaudoRow[];
  counts: Record<LaudoStatus, number>;
  priority: LaudoStatus;
}

const SECTIONS: { status: LaudoStatus; title: string }[] = [
  { status: 'vencido', title: '🔴 Vencidos' },
  { status: 'a_vencer', title: '🟡 Vencendo em breve' },
  { status: 'valido', title: '🟢 Válidos' },
];

const STATUS_BADGE: Record<LaudoStatus, { cls: string; label: string }> = {
  vencido: { cls: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200', label: 'Vencido' },
  a_vencer: { cls: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200', label: 'Vence em breve' },
  valido: { cls: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200', label: 'Válido' },
  sem_vigencia: { cls: 'bg-muted text-muted-foreground', label: 'Sem vigência' },
};

const PAGE_SIZE = 15;

function LaudoLine({ l, todayISO }: { l: LaudoRow; todayISO: string }) {
  const badge = STATUS_BADGE[classifyLaudo(l, todayISO)];
  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm">{l.tipo_laudo_nome || 'Laudo'}</span>
        <Badge className={`text-xs ${badge.cls}`}>{badge.label}</Badge>
        {l.numero_os && <Badge variant="outline" className="text-xs">OS {l.numero_os}</Badge>}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Emissão: {formatDate(l.data_emissao)} • Validade: {formatDate(l.data_validade)}
        {l.responsavel_tecnico_nome && <> • Resp. Técnico: {l.responsavel_tecnico_nome}</>}
      </div>
    </div>
  );
}

function UnitBlock({ g, todayISO }: { g: UnitGroup; todayISO: string }) {
  const [open, setOpen] = useState(false);
  const mixed = (['vencido', 'a_vencer', 'valido', 'sem_vigencia'] as LaudoStatus[])
    .filter((s) => g.counts[s] > 0).length > 1;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full rounded-md border p-3 text-left hover:bg-muted/40 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{g.label}</span>
              {g.code && <Badge variant="outline" className="text-xs">Cód. {g.code}</Badge>}
              {mixed && (
                <Badge variant="secondary" className="text-xs">Laudos em situações diferentes</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {g.local ? `${g.local} • ` : ''}{g.laudos.length} laudo(s)
              {g.counts.vencido > 0 && ` • ${g.counts.vencido} vencido(s)`}
              {g.counts.a_vencer > 0 && ` • ${g.counts.a_vencer} vencendo`}
              {g.counts.valido > 0 && ` • ${g.counts.valido} válido(s)`}
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-3 space-y-2">
        {g.laudos.map((l) => <LaudoLine key={l.id} l={l} todayISO={todayISO} />)}
      </CollapsibleContent>
    </Collapsible>
  );
}

function LaudosSection({
  title, groups, todayISO, defaultOpen, forceOpen,
}: { title: string; groups: UnitGroup[]; todayISO: string; defaultOpen: boolean; forceOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const isOpen = forceOpen || open;
  const visible = groups.slice(0, limit);

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 py-2 text-left">
        <span className="text-sm font-semibold">{title} ({groups.length})</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pb-2">
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhuma unidade nesta situação.</p>
        ) : (
          <>
            {visible.map((g) => <UnitBlock key={g.key} g={g} todayISO={todayISO} />)}
            {groups.length > visible.length && (
              <div className="text-center pt-1">
                <Button variant="link" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                  Ver mais ({groups.length - visible.length} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function LaudosCard({ companyId, navigate }: { companyId: string; navigate: (to: string) => void }) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['painel-cliente-laudos', companyId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('laudos')
        .select('id, ordem_id, unidade_id, tipo_laudo_nome, data_emissao, data_validade, possui_vigencia, numero_os, responsavel_tecnico_nome')
        .eq('company_id', companyId);
      if (error) throw error;
      return (rows ?? []) as LaudoRow[];
    },
  });

  const { data: units } = useQuery({
    queryKey: ['painel-cliente-units', companyId],
    queryFn: async () => {
      const all: UnitInfo[] = [];
      let from = 0;
      const step = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page, error } = await supabase
          .from('company_units')
          .select('id, name, razao_social, soc_unit_code, cidade, estado')
          .eq('company_id', companyId)
          .order('id', { ascending: true })
          .range(from, from + step - 1);
        if (error) throw error;
        all.push(...((page ?? []) as UnitInfo[]));
        if (!page || page.length < step) break;
        from += step;
      }
      return all;
    },
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const rows = data ?? [];

  const counts = rows.reduce(
    (acc, l) => {
      acc[classifyLaudo(l, todayISO)]++;
      return acc;
    },
    { vencido: 0, a_vencer: 0, valido: 0, sem_vigencia: 0 } as Record<LaudoStatus, number>,
  );

  const unitMap = new Map((units ?? []).map((u) => [u.id, u]));
  const order: Record<LaudoStatus, number> = { vencido: 0, a_vencer: 1, valido: 2, sem_vigencia: 3 };

  const groups: UnitGroup[] = [];
  const semUnidade: LaudoRow[] = [];
  const byUnit = new Map<string, LaudoRow[]>();
  for (const l of rows) {
    if (!l.unidade_id) semUnidade.push(l);
    else {
      const list = byUnit.get(l.unidade_id) ?? [];
      list.push(l);
      byUnit.set(l.unidade_id, list);
    }
  }
  for (const [unitId, laudos] of byUnit) {
    const u = unitMap.get(unitId);
    const c = { vencido: 0, a_vencer: 0, valido: 0, sem_vigencia: 0 } as Record<LaudoStatus, number>;
    laudos.forEach((l) => c[classifyLaudo(l, todayISO)]++);
    const priority = (['vencido', 'a_vencer', 'valido', 'sem_vigencia'] as LaudoStatus[]).find((s) => c[s] > 0)!;
    groups.push({
      key: unitId,
      label: u?.name || u?.razao_social || u?.soc_unit_code || 'Unidade não identificada',
      code: u?.soc_unit_code ?? null,
      local: u ? [u.cidade, u.estado].filter(Boolean).join('/') || null : null,
      laudos: [...laudos].sort((a, b) => {
        const d = order[classifyLaudo(a, todayISO)] - order[classifyLaudo(b, todayISO)];
        return d !== 0 ? d : (b.data_emissao ?? '').localeCompare(a.data_emissao ?? '');
      }),
      counts: c,
      priority,
    });
  }

  const term = search.trim().toLowerCase();
  const matches = (g: UnitGroup) =>
    !term || g.label.toLowerCase().includes(term) || (g.code ?? '').toLowerCase().includes(term);
  const filtered = groups.filter(matches);

  const sectionGroups = (status: LaudoStatus) =>
    filtered
      .filter((g) => g.priority === status)
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const semUnidadeSorted = [...semUnidade].sort((a, b) => {
    const d = order[classifyLaudo(a, todayISO)] - order[classifyLaudo(b, todayISO)];
    return d !== 0 ? d : (b.data_emissao ?? '').localeCompare(a.data_emissao ?? '');
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" /> Laudos
          </CardTitle>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {!isLoading && rows.length > 0 && (
              <>
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Vencidos: {counts.vencido}</Badge>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Vencendo em breve: {counts.a_vencer}</Badge>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Válidos: {counts.valido}</Badge>
                {counts.sem_vigencia > 0 && (
                  <Badge variant="outline">Sem vigência: {counts.sem_vigencia}</Badge>
                )}
              </>
            )}
            {canCreateLaudo && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => setNovoLaudoOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Laudo
              </Button>
            )}
          </div>
        </div>
        <NovoLaudoManualDialog
          open={novoLaudoOpen}
          onOpenChange={setNovoLaudoOpen}
          companyId={companyId}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['painel-cliente-laudos', companyId] })}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum laudo encontrado para esta empresa.
          </p>
        ) : (
          <div className="space-y-1">
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar unidade por nome ou código…"
                className="pl-8"
              />
            </div>

            {SECTIONS.map((s) => {
              const gs = sectionGroups(s.status);
              return (
                <LaudosSection
                  key={s.status}
                  title={s.title}
                  groups={gs}
                  todayISO={todayISO}
                  defaultOpen={s.status !== 'valido'}
                  forceOpen={!!term && gs.length > 0}
                />
              );
            })}

            {sectionGroups('sem_vigencia').length > 0 && (
              <LaudosSection
                title="⚪ Sem vigência"
                groups={sectionGroups('sem_vigencia')}
                todayISO={todayISO}
                defaultOpen={false}
                forceOpen={!!term && sectionGroups('sem_vigencia').length > 0}
              />
            )}

            {semUnidadeSorted.length > 0 && (
              <SemUnidadeSection laudos={semUnidadeSorted} todayISO={todayISO} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SemUnidadeSection({ laudos, todayISO }: { laudos: LaudoRow[]; todayISO: string }) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = laudos.slice(0, limit);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 py-2 text-left">
        <span className="text-sm font-semibold">Sem unidade vinculada ({laudos.length})</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pb-2">
        {visible.map((l) => <LaudoLine key={l.id} l={l} todayISO={todayISO} />)}
        {laudos.length > visible.length && (
          <div className="text-center pt-1">
            <Button variant="link" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              Ver mais ({laudos.length - visible.length} restantes)
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}


interface ContatoRow {
  id: string;
  nome: string | null;
  telefone_1: string | null;
  ramal_1: string | null;
  telefone_2: string | null;
  ramal_2: string | null;
  email_1: string | null;
  email_2: string | null;
}

function CopyableField({ label, value, icon }: { label: string; value: string; icon: 'phone' | 'mail' }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {icon === 'phone' ? (
        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate text-sm">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={copy}
        aria-label={`Copiar ${label}`}
        title={`Copiar ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

const CONTATOS_PAGE_SIZE = 3;

function ContatosCard({ companyId }: { companyId: string }) {
  const [limit, setLimit] = useState(CONTATOS_PAGE_SIZE);

  useEffect(() => setLimit(CONTATOS_PAGE_SIZE), [companyId]);

  const { data, isLoading } = useQuery({
    queryKey: ['painel-cliente-contatos', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_contacts')
        .select('id, nome, telefone_1, ramal_1, telefone_2, ramal_2, email_1, email_2')
        .eq('company_id', companyId)
        .order('nome', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as ContatoRow[];
    },
    enabled: !!companyId,
  });

  const contatos = data ?? [];
  const visible = contatos.slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Contact className="h-4 w-4" />
          Contatos
          {contatos.length > 0 && <Badge variant="secondary">{contatos.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando contatos...
          </div>
        ) : contatos.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum contato encontrado para esta empresa</div>
        ) : (
          <div className="space-y-2">
            {visible.map((c) => {
              const tel1 = c.telefone_1?.trim()
                ? `${c.telefone_1.trim()}${c.ramal_1?.trim() ? ` (ramal ${c.ramal_1.trim()})` : ''}`
                : null;
              const tel2 = c.telefone_2?.trim()
                ? `${c.telefone_2.trim()}${c.ramal_2?.trim() ? ` (ramal ${c.ramal_2.trim()})` : ''}`
                : null;
              const em1 = c.email_1?.trim() || null;
              const em2 = c.email_2?.trim() || null;
              return (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="font-medium text-sm">{c.nome?.trim() || 'Sem nome'}</div>
                  {!tel1 && !tel2 && !em1 && !em2 ? (
                    <div className="text-xs text-muted-foreground mt-1">Sem telefone ou e-mail cadastrado</div>
                  ) : (
                    <div className="grid gap-1 sm:grid-cols-2 mt-2">
                      {tel1 && <CopyableField label="Telefone 1" value={tel1} icon="phone" />}
                      {tel2 && <CopyableField label="Telefone 2" value={tel2} icon="phone" />}
                      {em1 && <CopyableField label="E-mail 1" value={em1} icon="mail" />}
                      {em2 && <CopyableField label="E-mail 2" value={em2} icon="mail" />}
                    </div>
                  )}
                </div>
              );
            })}
            {(contatos.length > visible.length || limit > CONTATOS_PAGE_SIZE) && (
              <div className="flex items-center justify-center gap-2 pt-1">
                {contatos.length > visible.length && (
                  <Button variant="link" size="sm" onClick={() => setLimit((n) => n + CONTATOS_PAGE_SIZE)}>
                    Ver mais ({contatos.length - visible.length} restantes)
                  </Button>
                )}
                {limit > CONTATOS_PAGE_SIZE && (
                  <Button variant="link" size="sm" onClick={() => setLimit(CONTATOS_PAGE_SIZE)}>
                    Ver menos
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PRECO_PAGE_SIZE = 10;

interface PrecoItemRow {
  id: string;
  product_name: string | null;
  product_group_name: string | null;
  valor_mensal: number | null;
  valor_produto_pontual: number | null;
  valor_vida_mes: number | null;
  valor_minimo: number | null;
  minimo_vidas: number | null;
  dia_cobranca: string | null;
}

function PrecoCard({ companyId }: { companyId: string }) {
  const [limit, setLimit] = useState(PRECO_PAGE_SIZE);

  useEffect(() => setLimit(PRECO_PAGE_SIZE), [companyId]);

  const { data, isLoading } = useQuery({
    queryKey: ['painel-cliente-preco', companyId],
    queryFn: async () => {
      const [companyRes, itemsRes] = await Promise.all([
        supabase
          .from('companies')
          .select('subgrupo, vidas_ativas, classificacao_cliente, cliente_inadimplente, data_assinatura_contrato, dia_contagem, tipo_contagem, tipo_relatorio_fatura, preco_synced_at')
          .eq('id', companyId)
          .maybeSingle(),
        supabase
          .from('company_pricing_items')
          .select('id, product_name, product_group_name, valor_mensal, valor_produto_pontual, valor_vida_mes, valor_minimo, minimo_vidas, dia_cobranca')
          .eq('company_id', companyId)
          .order('product_name', { ascending: true, nullsFirst: false }),
      ]);
      if (companyRes.error) throw companyRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return {
        info: companyRes.data as any,
        items: (itemsRes.data ?? []) as PrecoItemRow[],
      };
    },
    enabled: !!companyId,
  });

  const info = data?.info ?? null;
  const items = data?.items ?? [];
  const visible = items.slice(0, limit);


  const syncedAt = info?.preco_synced_at
    ? new Date(info.preco_synced_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Preço / Dados Comerciais
          </CardTitle>

          {syncedAt && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              Última sincronização: {syncedAt}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados comerciais...
          </div>
        ) : (
          <div className="space-y-4 pt-3">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  Subgrupo
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">Tipo de Cliente</TooltipContent>
                  </Tooltip>
                </div>
                <div className="font-medium">{info?.subgrupo || '—'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  Vidas Ativas
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Conforme data da última contagem - dia 1
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="font-medium">{info?.vidas_ativas ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Situação
                </div>
                <div className="mt-0.5">
                  {info?.cliente_inadimplente === true ? (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Inadimplente: Sim</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Inadimplente: Não</Badge>
                  )}
                </div>
              </div>


            </div>


            <Separator />


            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhuma informação de precificação encontrada para esta empresa
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Produtos Cadastrados ({items.length})
                </div>
                {visible.map((it) => {
                  const nome = it.product_name || 'Produto sem nome';
                  const isExames = nome.trim().toLowerCase() === 'exames';
                  const mensal = Number(it.valor_mensal ?? 0);
                  const pontual = Number(it.valor_produto_pontual ?? 0);
                  const vida = Number(it.valor_vida_mes ?? 0);
                  const minimo = Number(it.valor_minimo ?? 0);
                  const minVidas = Number(it.minimo_vidas ?? 0);

                  if (isExames) {
                    return (
                      <div key={it.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium text-sm">EXAMES</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            (cobrança conforme utilização)
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          *Consultar tabela de preços para detalhes de valores
                        </div>
                      </div>
                    );
                  }

                  const porVida = vida > 0;
                  const valor = mensal > 0 ? mensal : pontual > 0 ? pontual : porVida ? vida : null;
                  const rotulo = mensal > 0 ? null : porVida ? '(por vida/mês)' : '(cobrança pontual)';

                  return (
                    <div key={it.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{nome}</div>
                          {it.product_group_name && (
                            <div className="text-xs text-muted-foreground">{it.product_group_name}</div>
                          )}
                        </div>
                        <div className="text-right whitespace-nowrap">
                          {valor != null ? (
                            <div className="font-medium text-sm">{formatBRL(valor)}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground">Valor não informado</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex items-start justify-between gap-3 text-xs text-muted-foreground">
                        <span>Dia da cobrança: {it.dia_cobranca || '—'}</span>
                        <div className="text-right">
                          {rotulo && <div className="whitespace-nowrap">{rotulo}</div>}
                          {porVida && minVidas > 0 && (
                            <div className="whitespace-nowrap mt-0.5">
                              Valor Mínimo {formatBRL(minimo)} até {minVidas} Vidas
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}


                {items.length > visible.length && (
                  <div className="text-center pt-1">
                    <Button variant="link" size="sm" onClick={() => setLimit((n) => n + PRECO_PAGE_SIZE)}>
                      Ver mais ({items.length - visible.length} restantes)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ResponsavelPcmsoRow {
  id: string;
  unidade_id: string | null;
  unidade_nome_raw: string | null;
  nome_medico: string | null;
  nome_conselho: string | null;
  conselho: string | null;
  uf_conselho: string | null;
  email_responsavel: string | null;
  data_inicio: string | null;
  data_fim: string | null;
}

const PCMSO_PAGE_SIZE = 5;

function ResponsaveisPcmsoCard({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['painel-cliente-resp-pcmso', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_responsaveis_pcmso')
        .select('id, unidade_id, unidade_nome_raw, nome_medico, nome_conselho, conselho, uf_conselho, email_responsavel, data_inicio, data_fim')
        .eq('company_id', companyId)
        .order('data_inicio', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const rows = (data ?? []) as ResponsavelPcmsoRow[];
      const unitIds = Array.from(new Set(rows.map((r) => r.unidade_id).filter(Boolean))) as string[];
      let unitMap: Record<string, string> = {};
      if (unitIds.length > 0) {
        const { data: units } = await supabase
          .from('company_units')
          .select('id, name')
          .in('id', unitIds);
        unitMap = Object.fromEntries((units ?? []).map((u: any) => [u.id, u.name]));
      }
      return { rows, unitMap };
    },
    enabled: !!companyId,
  });

  const rows = data?.rows ?? [];
  const unitMap = data?.unitMap ?? {};
  const today = new Date().toISOString().slice(0, 10);

  const [statusFilter, setStatusFilter] = useState<'vigentes' | 'encerrados' | 'todos'>('vigentes');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PCMSO_PAGE_SIZE);

  useEffect(() => {
    setStatusFilter('vigentes');
    setSearch('');
    setLimit(PCMSO_PAGE_SIZE);
  }, [companyId]);

  useEffect(() => setLimit(PCMSO_PAGE_SIZE), [statusFilter, search]);

  const unitNameOf = (r: ResponsavelPcmsoRow) =>
    (r.unidade_id && unitMap[r.unidade_id]) || r.unidade_nome_raw?.trim() || 'Empresa toda';

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter((r) => {
      const vigente = !r.data_fim || r.data_fim >= today;
      if (statusFilter === 'vigentes' && !vigente) return false;
      if (statusFilter === 'encerrados' && vigente) return false;
      if (!q) return true;
      return (
        (r.nome_medico ?? '').toLowerCase().includes(q) ||
        unitNameOf(r).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.data_inicio ?? '').localeCompare(a.data_inicio ?? ''));

  const visible = filtered.slice(0, limit);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Responsáveis PCMSO ({filtered.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando responsáveis...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum responsável PCMSO encontrado para esta empresa</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex gap-1">
                {([
                  ['vigentes', 'Vigentes'],
                  ['encerrados', 'Encerrados'],
                  ['todos', 'Todos'],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={statusFilter === value ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por médico ou unidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum responsável encontrado com os filtros aplicados</div>
            ) : (
              <div className="space-y-2">
                {visible.map((r) => {
                  const vigente = !r.data_fim || r.data_fim >= today;
                  const conselho = [r.nome_conselho, r.conselho, r.uf_conselho].filter(Boolean).join(' • ');
                  return (
                    <div key={r.id} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">{r.nome_medico?.trim() || 'Sem nome'}</div>
                        <Badge variant="outline" className={vigente ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-muted bg-muted text-muted-foreground'}>
                          {vigente ? 'Vigente' : 'Encerrado'}
                        </Badge>
                      </div>
                      <div className="grid gap-1 sm:grid-cols-2 mt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Conselho: </span>
                          <span className="font-medium">{conselho || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vigência: </span>
                          <span className="font-medium">{formatDate(r.data_inicio)} até {r.data_fim ? formatDate(r.data_fim) : 'indeterminado'}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-muted-foreground">Unidade: </span>
                          <span className="font-medium">{unitNameOf(r)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(filtered.length > visible.length || limit > PCMSO_PAGE_SIZE) && (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {filtered.length > visible.length && (
                      <Button variant="link" size="sm" onClick={() => setLimit(filtered.length)}>
                        Ver mais ({filtered.length - visible.length} restantes)
                      </Button>
                    )}
                    {limit > PCMSO_PAGE_SIZE && (
                      <Button variant="link" size="sm" onClick={() => setLimit(PCMSO_PAGE_SIZE)}>
                        Ver menos
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
