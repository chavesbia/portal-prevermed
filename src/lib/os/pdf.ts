// Geração da versão para impressão da OS via html2pdf.js (mesmo motor usado em Contratos)
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

export async function generateOSPdf(data: OSPrintData): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const logo = await toDataUrl(logoPreverMed);

  const linhas = data.servicos.length
    ? data.servicos
        .map(
          (s) => `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;">${esc(s.tipo)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${esc(s.executor || '—')}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${esc(s.status)}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="3" style="border:1px solid #cbd5e1;padding:6px;text-align:center;color:#64748b;">Nenhum serviço cadastrado</td></tr>`;

  const info = (label: string, value?: string | null) => `
    <div style="margin-bottom:6px;">
      <div style="font-size:9pt;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${esc(label)}</div>
      <div style="font-size:11pt;">${esc(value || '—')}</div>
    </div>`;

  const container = document.createElement('div');
  container.style.padding = '24px';
  container.style.fontFamily = "'Inter','Arial',sans-serif";
  container.style.color = '#0f172a';
  container.style.fontSize = '11pt';
  container.style.lineHeight = '1.5';
  container.innerHTML = `
    <div class="pdf-root">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e3a8a;padding-bottom:10px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${logo ? `<img src="${logo}" style="height:42px;" />` : `<strong style="color:#1e3a8a;font-size:16pt;">PreverMed</strong>`}
        </div>
        <div style="text-align:right;">
          <div style="font-size:15pt;font-weight:700;color:#1e3a8a;">OS #${esc(data.numeroOS)}</div>
          <div style="font-size:9pt;color:#475569;">Data de emissão: ${esc(data.dataEmissao || '—')}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:12px;">
            ${info('Empresa', data.empresaNome)}
            ${info('CNPJ', data.empresaCnpj)}
            ${data.unidade ? info('Unidade', data.unidade) : ''}
            ${info('Endereço do CNPJ', data.endereco)}
            <div style="font-size:8.5pt;color:#64748b;">Confirme o local real da visita — nem sempre coincide com o endereço do CNPJ.</div>
          </td>
          <td style="vertical-align:top;width:50%;">
            ${info('Contato', data.contatoNome)}
            ${info('E-mail', data.contatoEmail)}
            ${info('Telefone', data.contatoTelefone)}
          </td>
        </tr>
      </table>

      <div style="font-size:11pt;font-weight:700;color:#1e3a8a;margin-bottom:6px;">Serviços da OS</div>
      <table style="width:100%;border-collapse:collapse;font-size:10pt;">
        <thead>
          <tr style="background:#e2e8f0;">
            <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Tipo</th>
            <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Executor</th>
            <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>

      <div style="margin-top:28px;font-size:9pt;color:#64748b;">
        Documento gerado pelo Portal PreverMed para uso do técnico em campo.
      </div>
    </div>
  `;

  await html2pdf()
    .set({
      margin: [10, 12, 14, 12],
      filename: `OS-${data.numeroOS}.pdf`,
      image: { type: 'jpeg', quality: 0.9 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: { mode: ['css', 'legacy', 'avoid-all'], avoid: ['tr', 'table'] },
    } as any)
    .from(container)
    .save();
}
