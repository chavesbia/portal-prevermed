import { describe, expect, it } from "vitest";
import { periodoAgenda, temKitAgenda } from "./agendaPainel";

describe("Painel de agendamentos", () => {
  it("inicia de D-5 até D+5", () => {
    expect(periodoAgenda("2026-10-23")).toEqual({ de: "2026-10-18", ate: "2026-10-28" });
  });
  it("não considera laudo de retorno como kit enviado", () => {
    expect(temKitAgenda({ soc_agendamento_anexos: [{ tipo_documento: "Alta Médica" }] })).toBe(false);
    expect(temKitAgenda({ soc_agendamento_anexos: [{ tipo_documento: "Guia/Kit" }] })).toBe(true);
  });
});