import { describe, expect, it } from "vitest";
import { chuvaCurta, melhorJanela, nivelAr, nivelUv } from "../src/lib/tempoCompleto";

const t0 = Date.parse("2026-10-30T12:00:00Z");
const passo = (min: number, mm: number | null) => ({ inicio: new Date(t0 + min * 60_000).toISOString(), mm });

describe("tempo completo", () => {
  it("detecta quando a chuva começa", () => {
    const r = chuvaCurta([passo(0, 0), passo(15, 0), passo(30, 0.4), passo(45, 1)], t0);
    expect(r).toEqual({ chovendo: false, mudaEm: new Date(t0 + 30 * 60_000).toISOString(), totalMm: 1.4 });
  });
  it("detecta quando a chuva para", () => {
    expect(chuvaCurta([passo(0, 2), passo(15, 0)], t0)?.mudaEm).toBe(new Date(t0 + 15 * 60_000).toISOString());
  });
  it("sem passos futuros → null", () => { expect(chuvaCurta([passo(-60, 1)], t0)).toBeNull(); });
  it("melhor janela de 2 h", () => {
    const agora = Date.parse("2026-10-30T12:00:00Z");
    const h = [80, 70, 20, 10, 60].map((p, i) => ({ inicio: new Date(agora + i * 3600_000).toISOString(), probabilidadeChuvaPct: p }));
    expect(melhorJanela(h, agora)).toEqual({ inicio: new Date(agora + 2 * 3600_000).toISOString(), pct: 20 });
  });
  it("não sugere a hora atual nem uma janela que já começou", () => {
    const agora = Date.parse("2026-10-30T12:24:00Z");
    const h = [1, 5, 10, 15].map((min, i) => ({ inicio: new Date(agora - min * 60_000).toISOString(), probabilidadeChuvaPct: i }));
    h.push({ inicio: new Date(agora + 3600_000).toISOString(), probabilidadeChuvaPct: 30 });
    h.push({ inicio: new Date(agora + 2 * 3600_000).toISOString(), probabilidadeChuvaPct: 20 });
    h.push({ inicio: new Date(agora + 3 * 3600_000).toISOString(), probabilidadeChuvaPct: 10 });
    expect(melhorJanela(h, agora)).toEqual({ inicio: new Date(agora + 2 * 3600_000).toISOString(), pct: 20 });
  });
  it("não retorna janela sem duas horas futuras com probabilidade conhecida", () => {
    const agora = Date.parse("2026-10-30T12:00:00Z");
    const h = [{ inicio: new Date(agora + 3600_000).toISOString(), probabilidadeChuvaPct: 10 }];
    expect(melhorJanela(h, agora)).toBeNull();
  });
  it("faixas de UV e ar", () => {
    expect(nivelUv(0)).toBe("baixo"); expect(nivelUv(9)).toBe("muito alto"); expect(nivelUv(null)).toBeNull();
    expect(nivelAr(40)).toBe("boa"); expect(nivelAr(120)).toBe("ruim para grupos sensíveis");
  });
});
