import { describe, it, expect } from "vitest";
import { diasEspera, faixa, unidadeDoPrestador } from "./ExamesPendentes";

describe("Exames Pendentes", () => {
  it("conta dias corridos desde a ficha", () => {
    expect(diasEspera("2026-10-20", new Date(2026, 9, 27))).toBe(7);
  });
  it("até 2 dias é recente, 3 a 5 atenção, acima de 5 atrasado", () => {
    expect(faixa(2)).toBe("recente");
    expect(faixa(5)).toBe("atencao");
    expect(faixa(6)).toBe("atrasado");
  });
  it("identifica a unidade pelo nome do prestador", () => {
    expect(unidadeDoPrestador("PREVERMED - LAPA")).toBe("lapa");
    expect(unidadeDoPrestador("Prever Medical - Osasco")).toBe("osasco");
    expect(unidadeDoPrestador("SOCNET - 3778 - PRINCIPAL")).toBeNull();
  });
});
