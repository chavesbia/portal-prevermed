import { formatCNPJ, formatCPF, formatCEP, formatBRL, formatDateBR } from './format';

export interface ContractRenderData {
  cliente: any;
  contrato: any;
}

export function buildPlaceholderValues({ cliente, contrato }: ContractRenderData): Record<string, string> {
  const enderecoParts = [
    cliente?.logradouro,
    cliente?.numero,
    cliente?.complemento,
    cliente?.bairro,
    cliente?.cidade && cliente?.estado ? `${cliente.cidade}/${cliente.estado}` : (cliente?.cidade || cliente?.estado),
    cliente?.cep ? `CEP ${formatCEP(cliente.cep)}` : null,
  ].filter(Boolean);

  return {
    RAZAO_SOCIAL: cliente?.razao_social ?? '',
    NOME_FANTASIA: cliente?.nome_fantasia ?? '',
    CNPJ: formatCNPJ(cliente?.cnpj),
    ENDERECO: enderecoParts.join(', '),
    CEP: formatCEP(cliente?.cep),
    CIDADE: cliente?.cidade ?? '',
    ESTADO: cliente?.estado ?? '',
    NUMERO_PROPOSTA: contrato?.numero_proposta ?? '',
    VALOR_MENSAL: formatBRL(contrato?.valor_mensal),
    QTD_VIDAS: contrato?.qtd_vidas?.toString() ?? '',
    VALOR_EXCEDENTE: formatBRL(contrato?.valor_excedente),
    DATA_INICIO: formatDateBR(contrato?.data_inicio),
    DATA_FIM: formatDateBR(contrato?.data_fim),
    VIGENCIA: contrato?.vigencia_meses ? `${contrato.vigencia_meses} meses` : '',
    INDICE_REAJUSTE: contrato?.indice_reajuste ?? '',
    PRAZO_AVISO: contrato?.prazo_aviso ? `${contrato.prazo_aviso} dias` : '',
    DIA_COBRANCA: contrato?.dia_cobranca?.toString() ?? '',
    MULTA: contrato?.multa != null ? `${contrato.multa}%` : '',
    JUROS: contrato?.juros != null ? `${contrato.juros}%` : '',
    VALOR_KM: formatBRL(contrato?.valor_km),
    REPRESENTANTE: contrato?.rep_nome ?? cliente?.representante_legal ?? '',
    CPF_REPRESENTANTE: formatCPF(contrato?.rep_cpf ?? cliente?.cpf_representante),
    TESTEMUNHA_1: contrato?.testemunha1_nome ?? '',
    CPF_TESTEMUNHA_1: formatCPF(contrato?.testemunha1_cpf),
    TESTEMUNHA_2: contrato?.testemunha2_nome ?? '',
    CPF_TESTEMUNHA_2: formatCPF(contrato?.testemunha2_cpf),
  };
}

export function renderTemplate(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (m, key) => {
    return values[key] ?? m;
  });
}
