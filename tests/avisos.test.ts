import { describe, expect, it } from "vitest";
import { mensagem, proximaEtapa } from "../src/lib/avisos";

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
