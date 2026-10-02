import { describe, expect, it } from "vitest";
import brt from "./fixtures/brt.json";
import sppo from "./fixtures/sppo.json";
import { parseBrt, parseSppo, urlSppo } from "../src/lib/fontes";

/** Instante em que as fixtures foram capturadas (respostas reais de 02/10/2026). */
const AGORA_FIXTURE = new Date("2026-10-02T03:19:08Z");

describe("parseBrt (fixture real)", () => {
  const r = parseBrt(brt, AGORA_FIXTURE);

  it("descarta a placa — nenhuma leitura carrega o campo", () => {
    for (const l of r.leituras) {
      expect(l).not.toHaveProperty("placa");
      expect(JSON.stringify(l)).not.toMatch(/TST\d{4}/);
    }
  });

  it("descarta posições antigas (o feed traz a última posição de veículos parados há dias)", () => {
    expect(r.descartadas.posicao_antiga).toBeGreaterThanOrEqual(5);
    for (const l of r.leituras) expect(AGORA_FIXTURE.getTime() - l.ts.getTime()).toBeLessThanOrEqual(5 * 60_000);
  });

  it("normaliza campos", () => {
    expect(r.leituras.length).toBeGreaterThan(30);
    const l = r.leituras[0];
    expect(l.fonte).toBe("brt");
    expect(typeof l.lat).toBe("number");
    expect(typeof l.veiculo).toBe("string");
  });

  it("rejeita resposta sem 'veiculos'", () => {
    expect(() => parseBrt({ outra: [] }, AGORA_FIXTURE)).toThrow();
  });
});

describe("parseSppo (fixture real)", () => {
  const r = parseSppo(sppo);

  it("remove FORA DE OP", () => {
    expect(r.descartadas.fora_de_operacao).toBeGreaterThan(0);
    expect(r.leituras.some((l) => l.linha === "FORA DE OP")).toBe(false);
  });

  it("aceita latitude/longitude como string", () => {
    const l = r.leituras.find((x) => x.veiculo === "STRTEST");
    expect(l).toBeDefined();
    expect(typeof l!.lat).toBe("number");
  });

  it("descarta item malformado sem derrubar o resto", () => {
    const r2 = parseSppo([...sppo, { id_veiculo: "X", latitude: "abc" }]);
    expect(r2.descartadas.formato_invalido).toBe(1);
    expect(r2.leituras.length).toBe(r.leituras.length);
  });
});

it("urlSppo usa UTC no formato esperado pelo servidor", () => {
  expect(urlSppo(new Date("2026-10-02T03:00:00Z"), new Date("2026-10-02T03:03:00Z"))).toBe(
    "https://dados.mobilidade.rio/gps/sppo?dataInicial=2026-10-02+03:00:00&dataFinal=2026-10-02+03:03:00",
  );
});
