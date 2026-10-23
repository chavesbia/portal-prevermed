import { describe, expect, it } from "vitest";
import { PREPAROS_EXAMES, preparosDosExames } from "../../supabase/functions/_shared/preparosExames";

describe("Preparos oficiais", () => {
  it("usa os 23 exames ativos com recomendações da planilha", () => {
    expect(PREPAROS_EXAMES).toHaveLength(23);
    expect(new Set(PREPAROS_EXAMES.map((e) => e.codigo)).size).toBe(23);
  });
  it("aplica o preparo somente ao exame selecionado", () => {
    expect(preparosDosExames(["658"]).map((e) => e.codigo)).toEqual(["658"]);
    expect(preparosDosExames(["EXAME CLÍNICO"])).toEqual([]);
    expect(preparosDosExames(["HEMOGRAMA COMPLETO"]).map((e) => e.codigo)).toEqual(["28.04.048-1"]);
  });
});