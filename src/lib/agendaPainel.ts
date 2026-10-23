export const periodoAgenda = (hoje: string) => {
  const deslocar = (dias: number) => {
    const data = new Date(`${hoje}T12:00:00Z`);
    data.setUTCDate(data.getUTCDate() + dias);
    return data.toISOString().slice(0, 10);
  };
  return { de: deslocar(-5), ate: deslocar(5) };
};

export const temKitAgenda = (a: { guia_path?: string | null; soc_agendamento_anexos?: { tipo_documento: string }[] }) =>
  !!a.guia_path || !!a.soc_agendamento_anexos?.some((x) => /guia|kit/i.test(x.tipo_documento));