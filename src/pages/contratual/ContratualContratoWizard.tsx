import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft, ArrowRight, FileSignature, Check } from 'lucide-react';
import { buildPlaceholderValues, placeholdersManuais, renderTemplate } from '@/lib/contractual/render';
import { generateAndUploadPdf } from '@/lib/contractual/pdf';
import { useContractPlaceholders } from '@/hooks/useContractPlaceholders';
import { useContractSignatarios } from '@/hooks/useContractSignatarios';
import { CPFInput } from '@/components/contratual/CPFInput';
import { isValidCPF } from '@/lib/contractual/cpf';
import { CompanySelector, type CompanyOption } from '@/components/shared/CompanySelector';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreated: (id: string) => void;
  /** Quando informado, reabre o assistente carregando um contrato em rascunho */
  draftId?: string | null;
}

const WIZARD_STEP_KEY = '__wizard_step';


const MANUAL_SIGNER = '__manual__';

// Mapeamento dos campos comerciais fixos do wizard para a fonte do placeholder.
// Só exibimos o campo se houver placeholder ativo apontando para essa fonte E
// esse placeholder (ou sua variante _EXTENSO) for usado no template selecionado.
const COMMERCIAL_FIELDS: { key: string; label: string; fonte: string; type?: string; cls?: string }[] = [
  { key: 'numero_proposta', label: 'Nº Proposta', fonte: 'contrato.numero_proposta' },
  { key: 'indice_reajuste', label: 'Índice de reajuste', fonte: 'contrato.indice_reajuste' },
  { key: 'valor_mensal', label: 'Valor mensal (R$)', type: 'number', fonte: 'contrato.valor_mensal' },
  { key: 'qtd_vidas', label: 'Qtd. vidas', type: 'number', fonte: 'contrato.qtd_vidas' },
  { key: 'valor_excedente', label: 'Valor vida excedente (R$)', type: 'number', fonte: 'contrato.valor_excedente' },
  { key: 'dia_cobranca', label: 'Dia cobrança', type: 'number', fonte: 'contrato.dia_cobranca' },
  { key: 'multa', label: 'Multa (%)', type: 'number', fonte: 'contrato.multa' },
  { key: 'juros', label: 'Juros (%)', type: 'number', fonte: 'contrato.juros' },
  { key: 'prazo_aviso', label: 'Prazo aviso prévio (dias)', type: 'number', fonte: 'contrato.prazo_aviso' },
  { key: 'valor_km', label: 'Valor KM rodado (R$)', type: 'number', fonte: 'contrato.valor_km' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  numero_proposta: '', valor_mensal: '', qtd_vidas: '', valor_excedente: '',
  dia_cobranca: '', multa: '', juros: '', vigencia_meses: '12',
  indice_reajuste: 'IPCA', prazo_aviso: '', valor_km: '',
  data_emissao: todayISO(),
  data_assinatura: '',
  data_inicio: todayISO(),
  rep_nome: '', rep_cpf: '', rep_email: '',
  testemunha1_nome: '', testemunha1_cpf: '', testemunha1_email: '',
  testemunha2_nome: '', testemunha2_cpf: '', testemunha2_email: '',
  prevermed_nome: '', prevermed_cpf: '', prevermed_email: '',
});

export function ContratualContratoWizard({ open, onOpenChange, onCreated, draftId = null }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [resolvingCliente, setResolvingCliente] = useState(false);
  const [resolveError, setResolveError] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [form, setForm] = useState<any>(emptyForm());
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [prevermedId, setPrevermedId] = useState(MANUAL_SIGNER);
  const [test1Id, setTest1Id] = useState(MANUAL_SIGNER);
  const [test2Id, setTest2Id] = useState(MANUAL_SIGNER);
  const [duplicateWarningPending, setDuplicateWarningPending] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ type: 'proposta' | 'vigencia', id: string, numero: string } | null>(null);

  // Rascunho automático
  const [contratoId, setContratoId] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const creatingDraftRef = useRef(false);
  const finalizedRef = useRef(false);
  const hydratingRef = useRef(false);

  const { data: placeholders = [] } = useContractPlaceholders(true);
  const { data: respPrevermed = [] } = useContractSignatarios('responsavel_prevermed', true);
  const { data: testemunhas = [] } = useContractSignatarios('testemunha', true);

  useEffect(() => {
    if (!open) {
      setStep(1); setCompanyId(null); setCompany(null); setClienteId(''); setResolveError(false); setTemplateId(''); setVersionId('');
      setManualValues({}); setForm(emptyForm());
      setPrevermedId(MANUAL_SIGNER); setTest1Id(MANUAL_SIGNER); setTest2Id(MANUAL_SIGNER);
      setDuplicateWarningPending(false);
      setDuplicateInfo(null);
      setContratoId(null); setDraftSavedAt(null);
      creatingDraftRef.current = false;
      finalizedRef.current = false;
    }
  }, [open]);


  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // ---------- Rascunho automático ----------
  const num = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));

  const buildContratoPayload = useCallback((currentStep: number) => ({
    cliente_id: clienteId,
    template_id: templateId || null,
    template_version_id: versionId || null,
    data_emissao: form.data_emissao || null,
    data_assinatura: form.data_assinatura || null,
    data_inicio: form.data_inicio || todayISO(),
    vigencia_meses: Number(form.vigencia_meses) || 12,
    numero_proposta: form.numero_proposta || null,
    valor_mensal: num(form.valor_mensal),
    qtd_vidas: num(form.qtd_vidas),
    valor_excedente: num(form.valor_excedente),
    dia_cobranca: num(form.dia_cobranca),
    multa: num(form.multa),
    juros: num(form.juros),
    indice_reajuste: form.indice_reajuste || null,
    prazo_aviso: num(form.prazo_aviso),
    valor_km: num(form.valor_km),
    rep_nome: form.rep_nome || null, rep_cpf: form.rep_cpf || null, rep_email: form.rep_email || null,
    testemunha1_nome: form.testemunha1_nome || null, testemunha1_cpf: form.testemunha1_cpf || null, testemunha1_email: form.testemunha1_email || null,
    testemunha2_nome: form.testemunha2_nome || null, testemunha2_cpf: form.testemunha2_cpf || null, testemunha2_email: form.testemunha2_email || null,
    prevermed_nome: form.prevermed_nome || null, prevermed_cpf: form.prevermed_cpf || null, prevermed_email: form.prevermed_email || null,
    campos_personalizados: { ...manualValues, [WIZARD_STEP_KEY]: currentStep },
  }), [clienteId, templateId, versionId, form, manualValues]);

  // Carrega rascunho existente
  useEffect(() => {
    if (!open || !draftId) return;
    let cancelled = false;
    (async () => {
      setLoadingDraft(true);
      hydratingRef.current = true;
      try {
        const { data, error } = await supabase
          .from('contract_contratos')
          .select('*, cliente:contract_clientes(id, company_id)')
          .eq('id', draftId)
          .maybeSingle();
        if (error) throw error;
        if (!data || cancelled) return;
        const cp = (data.campos_personalizados || {}) as Record<string, any>;
        const { [WIZARD_STEP_KEY]: savedStep, ...manual } = cp;
        setContratoId(data.id);
        setClienteId(data.cliente_id);
        setCompanyId((data as any).cliente?.company_id ?? null);
        setTemplateId(data.template_id || '');
        setVersionId(data.template_version_id || '');
        setManualValues(manual as Record<string, string>);
        const str = (v: any) => (v === null || v === undefined ? '' : String(v));
        setForm({
          numero_proposta: str(data.numero_proposta),
          valor_mensal: str(data.valor_mensal), qtd_vidas: str(data.qtd_vidas),
          valor_excedente: str(data.valor_excedente), dia_cobranca: str(data.dia_cobranca),
          multa: str(data.multa), juros: str(data.juros),
          vigencia_meses: str(data.vigencia_meses) || '12',
          indice_reajuste: str(data.indice_reajuste) || 'IPCA',
          prazo_aviso: str(data.prazo_aviso), valor_km: str(data.valor_km),
          data_emissao: data.status === 'rascunho' ? todayISO() : (str(data.data_emissao) || todayISO()),
          data_assinatura: str(data.data_assinatura),
          data_inicio: str(data.data_inicio) || todayISO(),
          rep_nome: str(data.rep_nome), rep_cpf: str(data.rep_cpf), rep_email: str(data.rep_email),
          testemunha1_nome: str(data.testemunha1_nome), testemunha1_cpf: str(data.testemunha1_cpf), testemunha1_email: str(data.testemunha1_email),
          testemunha2_nome: str(data.testemunha2_nome), testemunha2_cpf: str(data.testemunha2_cpf), testemunha2_email: str(data.testemunha2_email),
          prevermed_nome: str(data.prevermed_nome), prevermed_cpf: str(data.prevermed_cpf), prevermed_email: str(data.prevermed_email),
        });
        const hasBase = !!data.cliente_id && !!data.template_id && !!data.template_version_id;
        const s = Number(savedStep) >= 1 && Number(savedStep) <= 3 ? Number(savedStep) : 1;
        setStep(hasBase ? s : 1);
      } catch (e: any) {
        toast.error(e.message || 'Falha ao carregar rascunho');
      } finally {
        if (!cancelled) setLoadingDraft(false);
        setTimeout(() => { hydratingRef.current = false; }, 300);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftId]);

  // Cria o rascunho assim que empresa + modelo estiverem definidos
  useEffect(() => {
    if (!open || draftId || contratoId || creatingDraftRef.current) return;
    if (!clienteId || !templateId || !versionId) return;
    creatingDraftRef.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('contract_contratos')
          .insert({ ...buildContratoPayload(1), status: 'rascunho' as const, created_by: user?.id, updated_by: user?.id })
          .select('id')
          .single();
        if (error) throw error;
        setContratoId(data.id);
        setDraftSavedAt(new Date());
        qc.invalidateQueries({ queryKey: ['contract-contratos'] });
      } catch (e: any) {
        creatingDraftRef.current = false;
        toast.error(e.message || 'Falha ao criar rascunho do contrato');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftId, contratoId, clienteId, templateId, versionId]);

  // Verificação de duplicidade por proposta ou vigência
  useEffect(() => {
    if (!open || !clienteId || loadingDraft) return;
    
    const checkDuplicates = async () => {
      try {
        // 1. Checar número da proposta se preenchido
        if (form.numero_proposta?.trim()) {
          const { data: propMatch } = await supabase
            .from('contract_contratos')
            .select('id, numero_contrato')
            .eq('cliente_id', clienteId)
            .eq('numero_proposta', form.numero_proposta.trim())
            .neq('id', contratoId || '00000000-0000-0000-0000-000000000000') // Ignora o próprio rascunho
            .not('status', 'in', '("cancelado","encerrado")')
            .maybeSingle();
            
          if (propMatch) {
            setDuplicateInfo({ type: 'proposta', id: propMatch.id, numero: propMatch.numero_contrato });
            return;
          }
        }

        // 2. Checar sobreposição de vigência
        if (form.data_inicio && form.vigencia_meses) {
          const start = form.data_inicio;
          const end = new Date(new Date(start + 'T00:00:00').getTime() + Number(form.vigencia_meses) * 30 * 86400000).toISOString().slice(0, 10);
          
          const { data: overlaps } = await supabase
            .from('contract_contratos')
            .select('id, numero_contrato')
            .eq('cliente_id', clienteId)
            .neq('id', contratoId || '00000000-0000-0000-0000-000000000000')
            .not('status', 'in', '("cancelado","encerrado")')
            .or(`data_inicio.lte.${end},data_fim.gte.${start}`)
            .limit(1);

          if (overlaps && overlaps.length > 0) {
            setDuplicateInfo({ type: 'vigencia', id: overlaps[0].id, numero: overlaps[0].numero_contrato });
            return;
          }
        }

        setDuplicateInfo(null);
      } catch (err) {
        console.error('Erro ao verificar duplicidade:', err);
      }
    };

    const t = setTimeout(checkDuplicates, 800);
    return () => clearTimeout(t);
  }, [open, clienteId, form.numero_proposta, form.data_inicio, form.vigencia_meses, contratoId, loadingDraft]);

  // Autosave com debounce
  useEffect(() => {
    if (!open || !contratoId || loadingDraft || hydratingRef.current || finalizedRef.current) return;
    const t = setTimeout(async () => {
      if (finalizedRef.current) return;
      setSavingDraft(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('contract_contratos')
          .update({ ...buildContratoPayload(step), updated_by: user?.id })
          .eq('id', contratoId)
          .eq('status', 'rascunho');
        if (error) throw error;
        setDraftSavedAt(new Date());
      } catch {
        /* silencioso: autosave não deve interromper o preenchimento */
      } finally {
        setSavingDraft(false);
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contratoId, loadingDraft, step, buildContratoPayload]);


  // Resolve/create contract_clientes record for the selected company
  const resolveClienteForCompany = async (opt: CompanyOption) => {
    setResolvingCliente(true);
    setResolveError(false);
    try {
      const { data: existing, error: qErr } = await supabase
        .from('contract_clientes')
        .select('id')
        .eq('company_id', opt.id)
        .maybeSingle();
      if (qErr) throw qErr;
      if (existing?.id) { setClienteId(existing.id); return; }
      const { data: { user } } = await supabase.auth.getUser();

      // Complementa endereço a partir da base mestre de empresas
      const { data: comp } = await supabase
        .from('companies')
        .select('cep, logradouro, numero, complemento, bairro, cidade, estado')
        .eq('id', opt.id)
        .maybeSingle();

      // Telefone/e-mail do primeiro contato cadastrado da empresa
      const { data: contato } = await supabase
        .from('company_contacts')
        .select('telefone_1, email_1, created_at')
        .eq('company_id', opt.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: created, error: iErr } = await supabase
        .from('contract_clientes')
        .insert({
          company_id: opt.id,
          razao_social: opt.razao_social,
          nome_fantasia: opt.nome_abreviado || null,
          cnpj: (opt.cnpj || '').replace(/\D/g, '') || null,
          cep: comp?.cep || null,
          logradouro: comp?.logradouro || null,
          numero: comp?.numero || null,
          complemento: comp?.complemento || null,
          bairro: comp?.bairro || null,
          cidade: comp?.cidade || null,
          estado: comp?.estado || null,
          telefone: contato?.telefone_1 || null,
          email: contato?.email_1 || null,
          created_by: user?.id, updated_by: user?.id,
        })
        .select('id')
        .single();
      if (iErr) throw iErr;
      setClienteId(created.id);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao vincular empresa ao contrato');
      setClienteId('');
      setResolveError(true);
    } finally {
      setResolvingCliente(false);
    }
  };


  const { data: templates = [] } = useQuery({
    queryKey: ['contract-templates-min'],
    queryFn: async () => {
      const { data } = await supabase.from('contract_templates').select('id, nome, versao_atual, current_version_id').eq('ativo', true).order('nome');
      return data || [];
    }, enabled: open,
  });

  const { data: cliente } = useQuery({
    queryKey: ['contract-cliente', clienteId],
    queryFn: async () => {
      const { data } = await supabase.from('contract_clientes').select('*').eq('id', clienteId).maybeSingle();
      return data;
    }, enabled: !!clienteId,
  });

  // Complementação manual dos dados do cliente (quando faltam na base)
  const [clienteEdits, setClienteEdits] = useState<Record<string, string>>({});
  const [savingCliente, setSavingCliente] = useState(false);
  const setCli = (k: string, v: string) => setClienteEdits(e => ({ ...e, [k]: v }));
  const cliVal = (k: string) => (clienteEdits[k] ?? (cliente as any)?.[k] ?? '') as string;

  useEffect(() => { setClienteEdits({}); }, [clienteId]);

  const camposClienteObrigatorios = [
    { key: 'logradouro', label: 'Logradouro' },
    { key: 'numero', label: 'Número' },
    { key: 'bairro', label: 'Bairro' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'estado', label: 'UF' },
    { key: 'cep', label: 'CEP' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'email', label: 'E-mail' },
  ];
  const clienteCamposFaltando = cliente
    ? camposClienteObrigatorios.filter(c => !String(cliVal(c.key)).trim())
    : [];
  const clienteIncompleto = !!cliente && camposClienteObrigatorios.some(
    c => !String((cliente as any)?.[c.key] || '').trim(),
  );

  const salvarDadosCliente = async () => {
    if (!clienteId || Object.keys(clienteEdits).length === 0) return true;
    setSavingCliente(true);
    try {
      const payload: any = {};
      for (const [k, v] of Object.entries(clienteEdits)) payload[k] = v.trim() || null;
      const { error } = await supabase.from('contract_clientes').update(payload).eq('id', clienteId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['contract-cliente', clienteId] });
      setClienteEdits({});
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Falha ao salvar dados do cliente');
      return false;
    } finally {
      setSavingCliente(false);
    }
  };



  const { data: version } = useQuery({
    queryKey: ['contract-version', versionId],
    queryFn: async () => {
      const { data } = await supabase.from('contract_template_versions').select('*').eq('id', versionId).maybeSingle();
      return data;
    }, enabled: !!versionId,
  });

  useEffect(() => {
    if (templateId && !hydratingRef.current) {
      const t = templates.find((x: any) => x.id === templateId);
      if (t?.current_version_id) setVersionId(t.current_version_id);
    }
  }, [templateId, templates]);

  useEffect(() => {
    if (cliente && !form.rep_nome) {
      set('rep_nome', cliente.representante_legal || '');
      set('rep_cpf', String(cliente.cpf_representante || '').replace(/\D/g, ''));
      set('rep_email', cliente.email || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente]);

  // Chaves de placeholders usadas no template (inclui variantes _EXTENSO)
  const usadasNoTemplate = useMemo(() => {
    const set = new Set<string>();
    if (version?.conteudo_html) {
      String(version.conteudo_html).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, k) => { set.add(k); return _m; });
    }
    return set;
  }, [version]);

  // Fontes (cliente.xxx / contrato.xxx) efetivamente referenciadas no template
  const fontesUsadas = useMemo(() => {
    const set = new Set<string>();
    for (const p of placeholders) {
      if (!p.fonte) continue;
      if (usadasNoTemplate.has(p.chave) || usadasNoTemplate.has(`${p.chave}_EXTENSO`)) {
        set.add(p.fonte);
      }
    }
    return set;
  }, [placeholders, usadasNoTemplate]);

  // Campos comerciais que devem aparecer no wizard
  const camposComerciais = useMemo(
    () => COMMERCIAL_FIELDS.filter(f => fontesUsadas.has(f.fonte)),
    [fontesUsadas],
  );

  // Placeholders manuais pendentes (excluindo variantes _EXTENSO, que se derivam automaticamente)
  const manuaisPendentes = useMemo(() => {
    const chavesBase = new Set(placeholders.map(p => p.chave));
    return placeholdersManuais(placeholders).filter(p => {
      if (!usadasNoTemplate.has(p.chave)) return false;
      // se a chave é uma variante _EXTENSO e há base, ignora
      if (p.chave.endsWith('_EXTENSO') && chavesBase.has(p.chave.replace(/_EXTENSO$/, ''))) return false;
      return true;
    });
  }, [placeholders, usadasNoTemplate]);

  const previewHtml = useMemo(() => {
    if (!cliente || !version) return '';
    const dataFim = form.data_inicio && form.vigencia_meses
      ? new Date(new Date(form.data_inicio + 'T00:00:00').getTime() + Number(form.vigencia_meses) * 30 * 86400000).toISOString().slice(0, 10)
      : null;
    const values = buildPlaceholderValues(placeholders, {
      cliente,
      contrato: { ...form, data_fim: dataFim },
      manual: manualValues,
    });
    return renderTemplate(version.conteudo_html, values);
  }, [cliente, version, form, placeholders, manualValues]);

  const cpfsValidos = (
    (!form.rep_cpf || isValidCPF(form.rep_cpf)) &&
    (!form.prevermed_cpf || isValidCPF(form.prevermed_cpf)) &&
    (!form.testemunha1_cpf || isValidCPF(form.testemunha1_cpf)) &&
    (!form.testemunha2_cpf || isValidCPF(form.testemunha2_cpf))
  );

  // Placeholders ainda presentes no HTML renderizado (não substituídos)
  const placeholdersFaltando = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    String(previewHtml).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, k) => {
      if (!seen.has(k)) { seen.add(k); out.push(k); }
      return _m;
    });
    return out;
  }, [previewHtml]);

  const canGoStep2 = !!companyId && !!clienteId && !resolvingCliente && !!templateId && !!versionId && !duplicateWarningPending && !resolveError;
  const canGoStep3 = canGoStep2 && !!form.data_emissao && !!form.data_inicio && !!form.vigencia_meses && cpfsValidos
    && clienteCamposFaltando.length === 0 && !savingCliente;

  const canConfirm = placeholdersFaltando.length === 0;


  const aplicarSignatario = (id: string, kind: 'prev' | 't1' | 't2') => {
    const list = kind === 'prev' ? respPrevermed : testemunhas;
    const s = list.find(x => x.id === id);
    if (!s) return;
    if (kind === 'prev') {
      set('prevermed_nome', s.nome); set('prevermed_cpf', s.cpf); set('prevermed_email', s.email || '');
    } else if (kind === 't1') {
      set('testemunha1_nome', s.nome); set('testemunha1_cpf', s.cpf); set('testemunha1_email', s.email || '');
    } else {
      set('testemunha2_nome', s.nome); set('testemunha2_cpf', s.cpf); set('testemunha2_email', s.email || '');
    }
  };


  const confirmar = async () => {
    setGenerating(true);
    finalizedRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        ...buildContratoPayload(3),
        campos_personalizados: manualValues,
        html_final: previewHtml,
        updated_by: user?.id,
      };
      let ctr: any;
      if (contratoId) {
        const { data, error } = await supabase.from('contract_contratos')
          .update(payload).eq('id', contratoId).select().single();
        if (error) throw error;
        ctr = data;
      } else {
        const { data, error } = await supabase.from('contract_contratos')
          .insert({ ...payload, status: 'rascunho' as const, created_by: user?.id })
          .select().single();
        if (error) throw error;
        ctr = data;
      }


      const signers = [
        { tipo: 'representante', nome: form.rep_nome, cpf: form.rep_cpf, email: form.rep_email },
        { tipo: 'contratada', nome: form.prevermed_nome, cpf: form.prevermed_cpf, email: form.prevermed_email },
        { tipo: 'testemunha_1', nome: form.testemunha1_nome, cpf: form.testemunha1_cpf, email: form.testemunha1_email },
        { tipo: 'testemunha_2', nome: form.testemunha2_nome, cpf: form.testemunha2_cpf, email: form.testemunha2_email },
      ].filter(s => s.nome);
      if (signers.length) {
        await supabase.from('contract_assinaturas').insert(signers.map(s => ({ contrato_id: ctr.id, ...s, tipo: s.tipo as any })));
      }

      try {
        const path = await generateAndUploadPdf({
          contratoId: ctr.id, numero: ctr.numero_contrato, html: previewHtml,
        });
        await supabase.from('contract_contratos').update({ pdf_url: path }).eq('id', ctr.id);
      } catch (pdfErr: any) {
        console.error('PDF error', pdfErr);
        toast.warning('Contrato criado mas houve falha ao gerar o PDF. Você pode gerar novamente na tela do contrato.');
      }

      await supabase.from('contract_eventos').insert({
        contrato_id: ctr.id, tipo: 'criado',
        descricao: `Contrato ${ctr.numero_contrato} criado`,
        performed_by: user?.id,
      });

      toast.success(`Contrato ${ctr.numero_contrato} criado`);
      onCreated(ctr.id);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar contrato');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{draftId ? 'Rascunho de contrato' : 'Novo contrato'} — passo {step} de 3</span>
            {loadingDraft && <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> carregando rascunho…</span>}
            {!loadingDraft && savingDraft && <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> salvando rascunho…</span>}
            {!loadingDraft && !savingDraft && draftSavedAt && (
              <span className="text-xs font-normal text-muted-foreground inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> rascunho salvo {draftSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            {duplicateInfo && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 font-medium flex flex-col gap-1">
                <p>
                  Atenção: já existe um contrato para esta empresa com {duplicateInfo.type === 'proposta' ? 'esta mesma proposta' : 'vigência semelhante'} — 
                  confirme se não é duplicidade antes de continuar.
                </p>
                <a 
                  href={`/gestao-contratual?contrato=${duplicateInfo.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-bold"
                >
                  Ver contrato existente ({duplicateInfo.numero})
                </a>
              </div>
            )}
            {resolveError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive font-medium">
                Não foi possível vincular esta empresa ao contrato — verifique se você tem permissão de edição em Gestão 
                Contratual → Clientes. Fale com o administrador se o problema persistir.
              </div>
            )}
            <div className="space-y-1">
              <Label>Empresa (Cliente) *</Label>
              <CompanySelector
                value={companyId}
                excludeInternal
                onDuplicateWarningChange={setDuplicateWarningPending}
                onChange={(id, opt) => {
                  setCompanyId(id);
                  setCompany(opt);
                  setClienteId('');
                  setResolveError(false);
                  if (opt) resolveClienteForCompany(opt);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Selecione uma empresa cadastrada e ativa na base sincronizada do SOC.
                {resolvingCliente && ' Vinculando empresa ao contrato…'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Modelo de contrato *</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione o modelo…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} (v{t.versao_atual})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Apenas modelos ativos. A versão atual é congelada no momento da geração.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {clienteIncompleto && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <h4 className="text-sm font-medium mb-1">Dados do cliente (preenchimento obrigatório)</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  A empresa não possui todos os dados de endereço/contato na base. Complete abaixo — eles serão salvos no cadastro do cliente.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {camposClienteObrigatorios.map(c => (
                    <F key={c.key} label={`${c.label} *`} v={cliVal(c.key)} on={v => setCli(c.key, v)} />
                  ))}
                </div>
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium mb-2">Datas do contrato</h4>

              <div className="grid grid-cols-3 gap-3">
                <F label="Data de emissão *" type="date" v={form.data_emissao} on={v => set('data_emissao', v)} />
                <F label="Data de assinatura" type="date" v={form.data_assinatura} on={v => set('data_assinatura', v)} />
                <F label="Início da vigência *" type="date" v={form.data_inicio} on={v => set('data_inicio', v)} />
                <F label="Vigência (meses) *" type="number" v={form.vigencia_meses} on={v => set('vigencia_meses', v)} />
              </div>
            </div>

            {camposComerciais.length > 0 && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-medium mb-1">Dados comerciais</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Exibindo apenas campos referenciados no modelo selecionado.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {camposComerciais.map(c => (
                    <F key={c.key} label={c.label} type={c.type} v={form[c.key]} on={v => set(c.key, v)} />
                  ))}
                </div>
              </div>
            )}

            {manuaisPendentes.length > 0 && (
              <div className="pt-3 border-t">
                <h4 className="text-sm font-medium mb-1">Campos do contrato</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Campos do modelo sem origem mapeada no banco — preenchidos a cada contrato.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {manuaisPendentes.map(p => (
                    <div key={p.id} className="space-y-1">
                      <Label className="text-xs">{p.label} *</Label>
                      <Input
                        value={manualValues[p.chave] || ''}
                        onChange={e => setManualValues(v => ({ ...v, [p.chave]: e.target.value }))}
                        placeholder={p.descricao || ''}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t">

              <h4 className="text-sm font-medium mb-1">Assinantes</h4>
              <p className="text-xs text-muted-foreground mb-3">
                O e-mail é obrigatório para envio à Autentique. Sem e-mail o signatário não recebe o convite.
              </p>

              <div className="space-y-1 mb-3">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Contratante (Cliente)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <F label="Representante legal" v={form.rep_nome} on={v => set('rep_nome', v)} />
                  <div className="space-y-1">
                    <Label className="text-xs">CPF representante</Label>
                    <CPFInput value={form.rep_cpf} onChange={v => set('rep_cpf', v)} />
                  </div>
                  <F label="E-mail representante *" type="email" v={form.rep_email} on={v => set('rep_email', v)} />
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Contratada (PreverMed)</Label>
                {respPrevermed.length > 0 && (
                  <Select value={prevermedId} onValueChange={(v) => { setPrevermedId(v); if (v !== MANUAL_SIGNER) aplicarSignatario(v, 'prev'); }}>
                    <SelectTrigger><SelectValue placeholder="Escolher cadastrado…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MANUAL_SIGNER}>Digitar manualmente</SelectItem>
                      {respPrevermed.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}{s.cargo ? ` — ${s.cargo}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <F label="Responsável PreverMed" v={form.prevermed_nome} on={v => set('prevermed_nome', v)} />
                  <div className="space-y-1">
                    <Label className="text-xs">CPF responsável</Label>
                    <CPFInput value={form.prevermed_cpf} onChange={v => set('prevermed_cpf', v)} />
                  </div>
                  <F label="E-mail responsável *" type="email" v={form.prevermed_email} on={v => set('prevermed_email', v)} />
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Testemunha da Contratada</Label>
                {testemunhas.length > 0 && (
                  <Select value={test1Id} onValueChange={(v) => { setTest1Id(v); if (v !== MANUAL_SIGNER) aplicarSignatario(v, 't1'); }}>
                    <SelectTrigger><SelectValue placeholder="Escolher cadastrado…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={MANUAL_SIGNER}>Digitar manualmente</SelectItem>
                      {testemunhas.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}{s.cargo ? ` — ${s.cargo}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <F label="Nome" v={form.testemunha1_nome} on={v => set('testemunha1_nome', v)} />
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <CPFInput value={form.testemunha1_cpf} onChange={v => set('testemunha1_cpf', v)} />
                  </div>
                  <F label="E-mail" type="email" v={form.testemunha1_email} on={v => set('testemunha1_email', v)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Testemunha do Contratante</Label>

                <div className="grid grid-cols-3 gap-3">
                  <F label="Nome" v={form.testemunha2_nome} on={v => set('testemunha2_nome', v)} />
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <CPFInput value={form.testemunha2_cpf} onChange={v => set('testemunha2_cpf', v)} />
                  </div>
                  <F label="E-mail" type="email" v={form.testemunha2_email} on={v => set('testemunha2_email', v)} />
                </div>
              </div>
            </div>

            {/* Campos manuais agora aparecem antes dos Assinantes */}


            {!cpfsValidos && (
              <p className="text-xs text-destructive">Há CPF(s) inválido(s). Corrija antes de avançar.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Pré-visualização do contrato. Confirme para gerar o PDF.</p>
            {placeholdersFaltando.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                <p className="font-medium mb-1">Não é possível gerar o contrato — há campos sem preenchimento:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {placeholdersFaltando.map(k => (
                    <li key={k}><code>{`{{${k}}}`}</code></li>
                  ))}
                </ul>
                <p className="mt-1">Volte ao passo 2 e preencha esses campos.</p>
              </div>
            )}
            <div className="border rounded-lg bg-white p-6 prose prose-sm max-w-none max-h-[60vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}


        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 3 && (
            <Button onClick={async () => { if (step === 2 && !(await salvarDadosCliente())) return; setStep(step + 1); }}
              disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={confirmar} disabled={generating || !canConfirm}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSignature className="h-4 w-4 mr-1" />}
              Confirmar e gerar PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={!!finalizedRef.current && !generating}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contrato Gerado com Sucesso!</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>O PDF foi gerado e o contrato está pronto para envio.</p>
              
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-md text-amber-800 text-sm">
                <p className="font-bold mb-1">⚠️ ATENÇÃO - AÇÃO MANUAL NECESSÁRIA</p>
                <p>Lembre-se de bloquear manualmente o documento antigo no painel do Autentique, para que ninguém assine a versão desatualizada.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              const id = contratoId;
              onOpenChange(false);
              if (id) onCreated(id);
            }}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function F({ label, v, on, type = 'text' }: { label: string; v: any; on: (s: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={v || ''} onChange={e => on(e.target.value)} />
    </div>
  );
}
