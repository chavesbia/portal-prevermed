// Geração de PDF no client via html2pdf.js + upload para Supabase Storage
import { supabase } from '@/integrations/supabase/client';

export async function generateAndUploadPdf(opts: {
  contratoId: string;
  numero: string;
  html: string;
}): Promise<string> {
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.style.padding = '24px';
  container.style.fontFamily = "'Inter','Arial',sans-serif";
  container.style.color = '#0f172a';
  container.style.fontSize = '12pt';
  container.style.lineHeight = '1.6';
  container.innerHTML = `
    <style>
      .pdf-root p, .pdf-root li, .pdf-root h1, .pdf-root h2, .pdf-root h3,
      .pdf-root blockquote, .pdf-root tr, .pdf-root table {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .pdf-root hr {
        page-break-after: always;
        break-after: page;
        border: 0;
        height: 0;
        visibility: hidden;
        margin: 0;
      }
    </style>
    <div class="pdf-root">
      <div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #1e3a8a;padding-bottom:8px;">
        <strong style="color:#1e3a8a;font-size:14pt;">PreverMed</strong>
        <div style="font-size:10pt;color:#475569;">Contrato ${opts.numero}</div>
      </div>
      ${opts.html}
    </div>
  `;

  // Limite Autentique: 5 MB. Ajustamos scale/quality para manter o PDF leve.
  const buildPdf = (scale: number, quality: number): Promise<Blob> =>
    html2pdf()
      .set({
        margin: [10, 12, 14, 12],
        filename: `${opts.numero}.pdf`,
        image: { type: 'jpeg', quality },
        html2canvas: { scale, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: {
          mode: ['css', 'legacy', 'avoid-all'],
          avoid: ['p', 'li', 'h1', 'h2', 'h3', 'tr', 'blockquote', 'table'],
        },
      } as any)
      .from(container)
      .outputPdf('blob');

  const MAX_BYTES = 4.7 * 1024 * 1024; // margem de segurança abaixo dos 5 MB
  let blob: Blob = await buildPdf(1.5, 0.8);
  if (blob.size > MAX_BYTES) blob = await buildPdf(1.2, 0.7);
  if (blob.size > MAX_BYTES) blob = await buildPdf(1, 0.6);

  const pdfBase64 = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke('contract-pdf-upload', {
    body: {
      contrato_id: opts.contratoId,
      numero_contrato: opts.numero,
      pdf_base64: pdfBase64,
    },
  });
  if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Erro ao enviar PDF');
  return (data as any).path;
}

export async function getSignedPdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('contract-pdfs').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Erro ao ler PDF'));
    reader.readAsDataURL(blob);
  });
}
