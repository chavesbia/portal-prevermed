// deno-lint-ignore-file no-explicit-any
// Upload de anexos de agendamento no armazenamento privado
export const salvarArquivo = async (admin: any, data: string, a: { tipo: string; base64: string }) => {
  const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
  if (bytes.length > 5 * 1024 * 1024) throw new Error('Arquivo maior que 5 MB');
  const ext = a.tipo === 'application/pdf' ? 'pdf' : a.tipo === 'image/png' ? 'png' : 'jpg';
  const path = `soc-agenda/${data}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('os-anexos').upload(path, bytes, { contentType: a.tipo });
  if (error) throw new Error('Não foi possível enviar o arquivo');
  return path;
};

