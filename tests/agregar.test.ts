import { describe, expect, it } from "vitest";
import { agregarPorPonto, deduplicar, inicioBucket, resumir } from "../src/lib/agregar";
import { distanciaM } from "../src/lib/geo";
import { percentil } from "../src/lib/estatistica";
import type { Leitura } from "../src/lib/fontes";
import sppo from "./fixtures/sppo.json";
import { parseSppo } from "../src/lib/fontes";
import { PONTOS } from "../src/config/pontos";

const P = { id: "p", nome: "teste", lat: -23.000556, lng: -43.334167 };
const L = (o: Partial<Leitura>): Leitura => ({
  fonte: "sppo", veiculo: "A", linha: "1", sentido: "I", lat: P.lat, lng: P.lng, velocidade: 30,
  ts: new Date("2026-10-02T12:01:00Z"), ...o,
});

it("haversine: 1 grau de latitude ≈ 111,2 km", () => {
  expect(distanciaM(0, 0, 1, 0)).toBeCloseTo(111_195, -1);
});

it("percentil tipo 7", () => {
  expect(percentil([1, 2, 3, 4], 0.5)).toBe(2.5);
  expect(percentil([1, 2, 3, 4], 0.25)).toBe(1.75);
  expect(percentil([], 0.5)).toBeNull();
});

describe("resumir", () => {
  it("média e mediana só dos que estão em movimento; parados viram proporção", () => {
    const r = resumir([L({ velocidade: 0 }), L({ veiculo: "B", velocidade: 20 }), L({ veiculo: "C", velocidade: 40 }), L({ veiculo: "C", velocidade: 60, ts: new Date("2026-10-02T12:02:00Z") })]);
    expect(r.nVeiculos).toBe(3);
    expect(r.nLeituras).toBe(4);
    expect(r.nLeiturasMovimento).toBe(3);
    expect(r.velocidadeMedia).toBe(40);
    expect(r.velocidadeMediana).toBe(40);
    expect(r.proporcaoParados).toBe(0.25);
  });

  it("sem dado → null (sem preencher)", () => {
    expect(resumir([])).toMatchObject({ nVeiculos: 0, velocidadeMedia: null, velocidadeMediana: null, proporcaoParados: null });
    expect(resumir([L({ velocidade: 0 })]).velocidadeMedia).toBeNull();
  });

  it("mesmo código em fontes diferentes conta como veículos diferentes", () => {
    expect(resumir([L({}), L({ fonte: "brt" })]).nVeiculos).toBe(2);
  });
});

describe("agregarPorPonto", () => {
  it("separa por bucket de 5 min e fonte, ignora fora do raio", () => {
    const ags = agregarPorPonto([
      L({ ts: new Date("2026-10-02T12:01:00Z") }),
      L({ veiculo: "B", ts: new Date("2026-10-02T12:04:59Z") }),
      L({ ts: new Date("2026-10-02T12:05:00Z") }),
      L({ fonte: "brt", ts: new Date("2026-10-02T12:02:00Z") }),
      L({ lat: P.lat + 0.01 }), // ~1,1 km ao norte
    ], [P]);
    expect(ags).toHaveLength(3);
    const b1 = ags.find((a) => a.fonte === "sppo" && a.bucket.toISOString() === "2026-10-02T12:00:00.000Z")!;
    expect(b1.nVeiculos).toBe(2);
  });

  it("ponto sem veículos não gera linha", () => {
    expect(agregarPorPonto([L({ lat: -22.9 })], [P])).toEqual([]);
  });

  it("roda sobre a fixture real do SPPO sem erro e respeita o raio", () => {
    const ls = parseSppo(sppo).leituras;
    for (const a of agregarPorPonto(ls, PONTOS)) {
      expect(a.nLeituras).toBeGreaterThan(0);
      if (a.velocidadeMedia !== null) expect(a.velocidadeMedia).toBeGreaterThan(0);
    }
  });
});

it("inicioBucket e deduplicar", () => {
  expect(inicioBucket(new Date("2026-10-02T12:09:59Z")).toISOString()).toBe("2026-10-02T12:05:00.000Z");
  expect(deduplicar([L({}), L({}), L({ veiculo: "B" })])).toHaveLength(2);
});
