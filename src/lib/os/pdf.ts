// Visualização de impressão da OS: abre uma nova aba com o documento formatado
// e um botão "Imprimir" que aciona a pré-visualização nativa do navegador.
import logoPreverMed from '@/assets/logo-prevermed.png';

export interface OSPrintData {
  numeroOS: string;
  empresaNome: string;
  empresaCnpj?: string | null;
  endereco?: string | null;
  contatoNome?: string | null;
  contatoEmail?: string | null;
  contatoTelefone?: string | null;
  dataEmissao?: string | null;
  unidade?: string | null;
  observacoes?: string | null;
  servicos: Array<{ tipo: string; executor?: string | null; status: string }>;
}

function esc(v: unknown) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function toDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function openOSPrintView(data: OSPrintData): Promise<boolean> {
  const win = window.open('', '_blank');
  if (!win) return false;

  const logo = await toDataUrl(logoPreverMed);

  const linhas = data.servicos.length
    ? data.servicos
        .map(
          (s) => `
        <tr>
          <td>${esc(s.tipo)}</td>
          <td>${esc(s.executor || '—')}</td>
          <td>${esc(s.status)}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="3" class="vazio">Nenhum serviço cadastrado</td></tr>`;

  const info = (label: string, value?: string | null) => `
    <div class="info">
      <div class="info-label">${esc(label)}</div>
      <div class="info-valor">${esc(value || 'Não informado')}</div>
    </div>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>OS ${esc(data.numeroOS)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #0f172a;
    text-transform: uppercase;
    background: #f1f5f9;
  }
  .folha {
    background: #fff;
    max-width: 800px;
    margin: 0 auto;
    padding: 28px;
  }
  .barra {
    max-width: 800px;
    margin: 0 auto 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .barra button {
    font-family: inherit;
    font-size: 10pt;
    text-transform: uppercase;
    padding: 8px 16px;
    border: 1px solid #1e3a8a;
    background: #1e3a8a;
    color: #fff;
    border-radius: 6px;
    cursor: pointer;
  }
  .barra button.sec { background: #fff; color: #1e3a8a; }
  h1, h2, div, td, th, span, strong { font-size: 10pt; }
  .cabecalho {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 10px;
    margin-bottom: 16px;
  }
  .cabecalho img { height: 42px; }
  .titulo-os { font-weight: 700; color: #1e3a8a; }
  .dados { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .dados > tbody > tr > td { vertical-align: top; width: 50%; padding-right: 12px; }
  .info { margin-bottom: 6px; }
  .info-label { color: #64748b; letter-spacing: .04em; }
  .aviso { color: #64748b; margin-top: 4px; }
  .secao { font-weight: 700; color: #1e3a8a; margin-bottom: 6px; }
  .servicos { width: 100%; border-collapse: collapse; }
  .servicos th, .servicos td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
  .servicos thead tr { background: #e2e8f0; }
  .vazio { text-align: center; color: #64748b; }
  .obs-box { border: 1px solid #cbd5e1; padding: 8px; white-space: pre-wrap; min-height: 40px; }
  .rodape { margin-top: 28px; color: #64748b; }
  @media print {
    body { background: #fff; padding: 0; text-transform: uppercase; }
    .barra { display: none; }
    .folha { max-width: none; padding: 0; }
    tr, table { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="barra">
    <button onclick="window.print()">Imprimir</button>
    <button class="sec" onclick="window.close()">Fechar</button>
  </div>
  <div class="folha">
    <div class="cabecalho">
      <div>
        ${logo ? `<img src="${logo}" alt="PreverMed" />` : `<strong class="titulo-os">PreverMed</strong>`}
      </div>
      <div style="text-align:right;">
        <div class="titulo-os">OS #${esc(data.numeroOS)}</div>
        <div>Data de emissão: ${esc(data.dataEmissao || 'Não informado')}</div>
      </div>
    </div>

    <table class="dados">
      <tbody>
        <tr>
          <td>
            ${info('Empresa', data.empresaNome)}
            ${info('CNPJ', data.empresaCnpj)}
            ${info('Unidade', data.unidade)}
            ${info('Endereço do CNPJ', data.endereco)}
            <div class="aviso">Confirme o local real da visita.</div>
          </td>
          <td>
            ${info('Contato', data.contatoNome)}
            ${info('E-mail', data.contatoEmail)}
            ${info('Telefone', data.contatoTelefone)}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="secao">Serviços da OS</div>
    <table class="servicos">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Executor</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>

    <div style="margin-top:14px;">
      <div class="secao">Observações</div>
      <div class="obs-box">${esc(data.observacoes || 'Não informado')}</div>
    </div>

    <div class="rodape">
      Documento gerado pelo Portal PreverMed para uso do técnico em campo.
    </div>
  </div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}
