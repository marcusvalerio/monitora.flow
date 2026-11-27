import { describe, expect, it } from "vitest";
import { dataCemaden, parseCemaden } from "../src/lib/cemaden";
import { parseAvisosInmet, severidade } from "../src/lib/inmet";

describe("Cemaden", () => {
  it("filtra a cidade do Rio, lê '-' como sem dado e a data em UTC", () => {
    const p = parseCemaden([
      { idestacao: 7597, codibge: 3304557, nomeestacao: "CIEP Samuel Wainer", ultimovalor: 0.2, datahoraUltimovalor: "26/11/26 17:40", acc1hr: "-", acc24hr: 5.4 },
      { idestacao: 1, codibge: 3300100, nomeestacao: "Angra", ultimovalor: 0 },
    ]);
    expect(p).toEqual([{ id: "cemaden-7597", nome: "CIEP Samuel Wainer", mmUltimo: 0.2, mm1h: null, mm24h: 5.4, medidoEm: "2026-11-26T17:40:00.000Z" }]);
    expect(dataCemaden("x")).toBeNull();
  });
});

describe("avisos do INMET", () => {
  it("pega só os avisos que incluem o Rio e a severidade", () => {
    const a = parseAvisosInmet({ hoje: [
      { id: 1, descricao: "Chuvas Intensas", severidade: "Perigo", geocodes: "3304557,3303302", inicio: "2026-11-27 10:00" },
      { id: 2, descricao: "Vendaval", severidade: "Perigo Potencial", geocodes: "3550308" },
      { id: 4, descricao: "Vencido", severidade: "Perigo", geocodes: "3304557", fim: "2026-11-26 23:59" },
    ], futuro: [{ id: 3, descricao: "Onda de Calor", aviso_cor: "#FF0000", geocodes: "3304557" }] }, 3304557, new Date("2026-11-27T12:00:00Z"));
    expect(a.map((x) => [x.titulo, x.severidade])).toEqual([["Chuvas Intensas", "perigo"], ["Onda de Calor", "grande perigo"]]);
    expect(severidade("Perigo Potencial")).toBe("potencial");
    expect(a[0].inicio).toBe("2026-11-27T13:00:00.000Z");
  });
  it("resposta estranha não quebra", () => { expect(parseAvisosInmet(null)).toEqual([]); });
});
