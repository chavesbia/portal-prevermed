
export interface SignerEmailInfo {
  label: string;
  email: string | null | undefined;
}

export function validateUniqueEmails(signers: SignerEmailInfo[]): string | null {
  const normalized = signers.map(s => ({
    label: s.label,
    email: s.email?.trim().toLowerCase()
  })).filter(s => !!s.email);

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (normalized[i].email === normalized[j].email) {
        return `O e-mail de ${normalized[i].label} e ${normalized[j].label} não pode ser o mesmo — cada assinante precisa de um e-mail próprio para o Autentique identificar corretamente quem assinou.`;
      }
    }
  }

  return null;
}
