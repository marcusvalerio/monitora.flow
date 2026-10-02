import { expect, it } from "vitest";
import { calcularHabitual, compararComHabitual, diaHoraLocal } from "../src/lib/habitual";

it("diaHoraLocal usa o fuso do Rio (UTC−3)", () => {
  // 2026-10-02T02:30Z = quinta 01/10 23h30 no Rio
  expect(diaHoraLocal(new Date("2026-10-02T02:30:00Z"))).toEqual({ dia: 4, hora: 23, data: "2026-10-01" });
});

it("habitual: média ponderada por dia, depois mediana/p25/p75 entre dias; dias sem dado ficam fora", () => {
  // Segundas 18h no Rio = 21h UTC
  const b = (d: string, m: string, v: number | null, n: number) => ({ bucket: new Date(`${d}T21:${m}:00Z`), velocidadeMedia: v, nLeiturasMovimento: n });
  const h = calcularHabitual([
    b("2026-09-07", "00", 10, 1), b("2026-09-07", "05", 40, 3), // (10+120)/4 = 32.5
    b("2026-09-14", "00", 20, 2),                                // 20
    b("2026-09-21", "10", 30, 1),                                // 30
    b("2026-09-28", "00", null, 0),                              // sem dado
    b("2026-09-29", "00", 99, 5),                                // terça: ignorado
  ], 1, 18);
  expect(h.nDias).toBe(3);
  expect(h.mediana).toBe(30);
  expect(h.p25).toBe(25);
  expect(h.p75).toBe(31.3);
});

it("sem dias → nulls", () => {
  expect(calcularHabitual([], 1, 18)).toMatchObject({ nDias: 0, mediana: null, p25: null, p75: null });
});

it("compararComHabitual", () => {
  const h = { p25: 20, p75: 30, nDias: 4 };
  expect(compararComHabitual(15, h)).toBe("abaixo_da_faixa_habitual");
  expect(compararComHabitual(25, h)).toBe("dentro_da_faixa_habitual");
  expect(compararComHabitual(null, h)).toBe("sem_dado");
  expect(compararComHabitual(25, { p25: null, p75: null, nDias: 0 })).toBe("historico_insuficiente");
  expect(compararComHabitual(25, { p25: 20, p75: 30, nDias: 2 })).toBe("historico_insuficiente");
});
