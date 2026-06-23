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
    <div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #1e3a8a;padding-bottom:8px;">
      <strong style="color:#1e3a8a;font-size:14pt;">PreverMed</strong>
      <div style="font-size:10pt;color:#475569;">Contrato ${opts.numero}</div>
    </div>
    ${opts.html}
  `;

  const blob: Blob = await html2pdf()
    .set({
      margin: [10, 12, 14, 12],
      filename: `${opts.numero}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    } as any)
    .from(container)
    .outputPdf('blob');

  const path = `${opts.contratoId}/${opts.numero}.pdf`;
  const { error } = await supabase.storage.from('contract-pdfs').upload(path, blob, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) throw error;
  return path;
}

export async function getSignedPdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('contract-pdfs').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
