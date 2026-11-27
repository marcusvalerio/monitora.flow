import { describe, expect, it } from "vitest";
import { mensagem, proximaEtapa } from "../src/lib/avisos";
import { arredondar, chuvaForteAqui, mensagemChuva } from "../src/lib/avisosChuva";

describe("avisos de chegada", () => {
  it("avança por etapas e nunca volta", () => {
    expect(proximaEtapa(0, 12)).toBe(1);
    expect(proximaEtapa(1, 4)).toBe(2);
    expect(proximaEtapa(2, 9)).toBe(2);
    expect(proximaEtapa(2, 1.5)).toBe(3);
    expect(proximaEtapa(0, null)).toBe(1);
  });
  it("mensagens sem til", () => {
    expect(mensagem(1, "371", "Tijuca", 12.4).body).toBe("Chega em 12 min em Tijuca (estimativa). Avisamos quando estiver perto.");
    expect(mensagem(3, "371", "Tijuca", 1).title).toBe("371 chegando em Tijuca");
  });
});

describe("aviso de chuva forte", () => {
  const est = (id: string, lat: number, lng: number, h01: number, m15 = 0) => ({ id, nome: id, bacia: null, lat, lng, medidoEm: null, mm: { m05: null, m10: null, m15, h01, h04: null, h24: null, h96: null, mes: null } });
  it("dispara com > 25 mm/h a até 5 km e escolhe o mais forte", () => {
    const es = [est("Tijuca", -22.925, -43.232, 30), est("Grajaú", -22.92, -43.26, 40), est("Longe", -23.0, -43.5, 90)];
    expect(chuvaForteAqui(es, -22.924, -43.235)?.estacao).toBe("Grajaú");
  });
  it("usa o ritmo dos últimos 15 min (m15 × 4)", () => {
    expect(chuvaForteAqui([est("Tijuca", -22.925, -43.232, 3, 8)], -22.924, -43.235)?.mmH).toBe(32);
  });
  it("não dispara com chuva moderada nem com pluviômetro longe", () => {
    expect(chuvaForteAqui([est("Tijuca", -22.925, -43.232, 25)], -22.924, -43.235)).toBeNull();
    expect(chuvaForteAqui([est("Longe", -23.0, -43.5, 90)], -22.924, -43.235)).toBeNull();
  });
  it("guarda o ponto arredondado e escreve a mensagem", () => {
    expect(arredondar(-22.92437)).toBe(-22.92);
    expect(mensagemChuva("Tijuca", { estacao: "Grajaú", mmH: 32.4 }).title).toBe("Chuva forte perto de Tijuca");
  });
});

import { eventosCidade } from "../src/lib/inscricoes";
describe("alertas da cidade", () => {
  it("só estágio ≥ 3, INMET de perigo e calor ≥ 4 viram notificação", () => {
    const ev = eventosCidade({ hoje: "2026-11-27", estagio: { nivel: 3, desde: "x" }, calor: { nivel: 2 },
      avisos: [{ id: "1", titulo: "Chuvas Intensas", severidade: "perigo", inicio: null, fim: null, riscos: null, instrucoes: null },
               { id: "2", titulo: "Vendaval", severidade: "potencial", inicio: null, fim: null, riscos: null, instrucoes: null }] });
    expect(ev.map((e) => e.chave)).toEqual(["estagio-3-x", "inmet-1"]);
    expect(eventosCidade({ hoje: "h", estagio: { nivel: 2 }, calor: { nivel: 4 } }).map((e) => e.chave)).toEqual(["calor-4-h"]);
  });
});
