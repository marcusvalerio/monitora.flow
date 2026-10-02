import { describe, expect, it } from "vitest";
import { buscarEstacoes, estacoesProximas, ESTACOES } from "../src/lib/estacoes";
import { deltaAngulo, destinoDoTrajeto, normalizarFrota, normalizarVeiculo, rumoEntre } from "../src/lib/veiculo";
import type { Leitura } from "../src/lib/fontes";
import { lerDirecao } from "../src/lib/fontes";

describe("catálogo de estações do BRT", () => {
  it("tem estações e terminais com corredor", () => {
    expect(ESTACOES.length).toBeGreaterThan(150);
    expect(ESTACOES.filter((e) => e.tipo === "terminal").length).toBeGreaterThan(10);
  });
  it("busca devolve só itens do catálogo (nunca endereço)", () => {
    const r = buscarEstacoes("alvo");
    expect(r.map((e) => e.nome)).toContain("Terminal Alvorada");
    expect(r.every((e) => ESTACOES.some((x) => x.id === e.id))).toBe(true);
  });
  it("expande abreviações e ignora acento", () => {
    expect(buscarEstacoes("jardim oceanico")[0]?.nome).toBe("Terminal Jardim Oceânico");
  });
  it("sem resultado → lista vazia (sem completar com qualquer coisa)", () => {
    expect(buscarEstacoes("xyzabc")).toEqual([]);
  });
  it("planejadas vão por último e não entram em 'perto de mim'", () => {
    const r = buscarEstacoes("santa cruz");
    const iPlan = r.findIndex((e) => e.status === "planejada");
    if (iPlan >= 0) expect(iPlan).toBe(r.length - 1);
    expect(estacoesProximas(-22.92, -43.68, 20000).every((e) => e.status === "operando")).toBe(true);
  });
});

describe("rumo dos veículos", () => {
  const base = { lat: -23.0, lng: -43.3 };
  const L = (o: Partial<Leitura>): Leitura => ({ fonte: "brt", veiculo: "A", linha: "22", sentido: "ida", lat: base.lat, lng: base.lng, velocidade: 40, ts: new Date("2026-10-02T12:00:00Z"), direcao: null, ...o });
  const agora = new Date("2026-10-02T12:00:30Z");

  it("rumoEntre: norte 0°, leste 90°, sul 180°, oeste 270°, diagonal 45°", () => {
    expect(rumoEntre(base, { lat: base.lat + 0.01, lng: base.lng })).toBeCloseTo(0, 0);
    expect(rumoEntre(base, { lat: base.lat, lng: base.lng + 0.01 })).toBeCloseTo(90, 0);
    expect(rumoEntre(base, { lat: base.lat - 0.01, lng: base.lng })).toBeCloseTo(180, 0);
    expect(rumoEntre(base, { lat: base.lat, lng: base.lng - 0.01 })).toBeCloseTo(270, 0);
    expect(rumoEntre(base, { lat: base.lat + 0.01, lng: base.lng + 0.01 / Math.cos((23 * Math.PI) / 180) })).toBeCloseTo(45, 0);
  });
  it("usa o rumo do GPS quando a fonte informa", () => {
    const v = normalizarVeiculo(L({ direcao: 137 }), [], agora);
    expect(v).toMatchObject({ rumo: 137, rumoOrigem: "gps", parado: false });
  });
  it("sem rumo da fonte: calcula pelo deslocamento ≥ 30 m", () => {
    const ant = L({ lat: base.lat - 0.001, ts: new Date("2026-10-02T11:59:40Z") }); // ~110 m ao sul
    const v = normalizarVeiculo(L({}), [ant], agora);
    expect(v.rumoOrigem).toBe("deslocamento");
    expect(v.rumo).toBeCloseTo(0, -1);
  });
  it("deslocamento pequeno (< 30 m) não gera rumo → neutro", () => {
    const ant = L({ lat: base.lat - 0.0001, ts: new Date("2026-10-02T11:59:40Z") }); // ~11 m
    expect(normalizarVeiculo(L({}), [ant], agora).rumo).toBeNull();
  });
  it("parado mantém o último rumo em movimento (não gira)", () => {
    const ant = L({ direcao: 250, velocidade: 35, ts: new Date("2026-10-02T11:59:30Z") });
    const v = normalizarVeiculo(L({ velocidade: 0, direcao: 10 }), [ant], agora);
    expect(v).toMatchObject({ parado: true, rumo: 250, rumoOrigem: "anterior" });
  });
  it("sem nenhuma informação → rumo null (nunca inventa)", () => {
    expect(normalizarVeiculo(L({ velocidade: 0 }), [], agora)).toMatchObject({ rumo: null, rumoOrigem: null });
  });
  it("normalizarFrota pega a leitura mais recente de cada veículo", () => {
    const f = normalizarFrota([L({ ts: new Date("2026-10-02T11:59:00Z"), lat: -23.01 }), L({}), L({ veiculo: "B" })], agora);
    expect(f).toHaveLength(2);
    expect(f.find((v) => v.veiculo === "A")!.lat).toBe(base.lat);
  });
  it("lerDirecao: vazio/espaço/fora do intervalo → null", () => {
    expect(lerDirecao(" ")).toBeNull();
    expect(lerDirecao("")).toBeNull();
    expect(lerDirecao("400")).toBeNull();
    expect(lerDirecao("107")).toBe(107);
    expect(lerDirecao(8.0)).toBe(8);
  });
});

describe("interpolação angular", () => {
  it("359 → 1 vira +2, 1 → 359 vira −2, 92 → 97 vira +5", () => {
    expect(deltaAngulo(359, 1)).toBe(2);
    expect(deltaAngulo(1, 359)).toBe(-2);
    expect(deltaAngulo(92, 97)).toBe(5);
    expect(deltaAngulo(0, 180)).toBe(-180);
    expect(deltaAngulo(720 + 10, 20)).toBe(10);
  });
});

it("destino a partir do trajeto do BRT", () => {
  expect(destinoDoTrajeto("22 - ALVORADA X JARDIM OCEANICO (PARADOR) [IDA]", "ida")).toBe("Jardim Oceanico");
  // a fonte inverte a ordem dos nomes na volta: o destino é sempre o último trecho
  expect(destinoDoTrajeto("10 - ALVORADA X SANTA CRUZ (EXPRESSO) [VOLTA]", "volta")).toBe("Santa Cruz");
  expect(destinoDoTrajeto("10 - SANTA CRUZ X ALVORADA (EXPRESSO) [IDA]", "ida")).toBe("Alvorada");
  expect(destinoDoTrajeto("22 - ALVORADA X JARDIM OCEANICO", null)).toBeNull();
  expect(destinoDoTrajeto(null, "ida")).toBeNull();
});

import { acumulado, distanciaAoTrajeto, encaixar, pontoEm, projetar, ENCAIXE_MAX_M, FORA_TRAJETO_M } from "../src/lib/trajeto";
import trajetosJson from "../src/data/trajetos-brt.json";

describe("trajeto (encaixe no trajeto oficial)", () => {
  const reta: [number, number][] = [[-43.5, -23.0], [-43.49, -23.0], [-43.48, -23.0]];
  it("projeta ponto ao lado da via sobre ela, com s crescente", () => {
    const e = projetar(-22.9997, -43.495, reta)!;
    expect(e.lat).toBeCloseTo(-23.0, 6);
    expect(e.distM).toBeGreaterThan(25);
    expect(e.distM).toBeLessThan(40);
    const e2 = projetar(-23.0, -43.485, reta)!;
    expect(e2.s).toBeGreaterThan(e.s);
  });
  it("pontoEm volta o ponto de s", () => {
    const acc = acumulado(reta);
    const p = pontoEm(reta, acc[1], acc);
    expect(p.lng).toBeCloseTo(-43.49, 6);
  });
  it("não encaixa longe demais (mostra GPS cru)", () => {
    expect(encaixar(-22.99, -43.49, null, [{ sentido: 0, destino: "X", coords: reta }])).toBeNull();
    expect(ENCAIXE_MAX_M).toBe(60);
  });
  it("prefere o trajeto do destino do veículo", () => {
    const ida = { sentido: 0, destino: "Terminal Alvorada", coords: reta };
    const volta = { sentido: 1, destino: "Estação Santa Cruz", coords: reta.map(([a, b]) => [a, b + 0.0001] as [number, number]) };
    expect(encaixar(-23.00005, -43.495, "Santa Cruz", [ida, volta])!.trajeto).toBe(1);
    expect(encaixar(-23.00005, -43.495, "Alvorada", [ida, volta])!.trajeto).toBe(0);
  });
  it("garagem da linha 10 (ponto real de 02/10/2026) fica fora do trajeto; corredor fica dentro", () => {
    const l = (trajetosJson as unknown as { linhas: Record<string, { coords: [number, number][] }[]> }).linhas["10"];
    expect(distanciaAoTrajeto(-22.9206, -43.6453, l)!).toBeGreaterThan(FORA_TRAJETO_M);
    expect(distanciaAoTrajeto(-23.0003, -43.3964, l)!).toBeLessThan(ENCAIXE_MAX_M);
    expect(distanciaAoTrajeto(0, 0, [])).toBeNull();
  });
  it("catálogo GTFS: linha 10 tem os dois sentidos", () => {
    const l = (trajetosJson as { linhas: Record<string, { destino: string }[]> }).linhas["10"];
    expect(l.map((t) => t.destino).sort()).toEqual(["Estação Santa Cruz", "Terminal Alvorada"]);
  });
});

import { estadoGeo, proximidade } from "../src/lib/estadoGeo";
describe("estado geográfico do veículo", () => {
  it("classifica por idade e distância ao trajeto", () => {
    expect(estadoGeo(10, 5)).toBe("ON_ROUTE");
    expect(estadoGeo(10, 60)).toBe("ON_ROUTE");
    expect(estadoGeo(10, 120)).toBe("UNCERTAIN");
    expect(estadoGeo(10, 2700)).toBe("OFF_ROUTE");
    expect(estadoGeo(400, 5)).toBe("STALE");
    expect(estadoGeo(10, null)).toBeNull();
  });
  it("corredor de impacto", () => {
    expect(proximidade(40)).toBe("NO_TRAJETO");
    expect(proximidade(640)).toBe("PROXIMA");
    expect(proximidade(2000)).toBe("FORA_DO_IMPACTO");
  });
});

import { retrato, ultimaPorVeiculo } from "../src/lib/monitor";
describe("monitor (retrato da frota)", () => {
  const agora = new Date("2026-10-02T19:00:00Z");
  const L = (fonte: "brt" | "sppo", veiculo: string, linha: string, lat: number, lng: number, sAtras: number, vel = 30) =>
    ({ fonte, veiculo, linha, sentido: null, lat, lng, velocidade: vel, ts: new Date(agora.getTime() - sAtras * 1000) });
  const trajetos = { "10": [{ coords: [[-43.5, -23.0], [-43.4, -23.0]] as [number, number][] }] };
  it("usa a última posição de cada veículo", () => {
    expect(ultimaPorVeiculo([L("brt", "1", "10", -23, -43.45, 50), L("brt", "1", "10", -23, -43.44, 10)])[0].lng).toBe(-43.44);
  });
  it("conta veículos, linhas e estados reais (sem inventar)", () => {
    const r = retrato([
      L("brt", "1", "10", -23.0, -43.45, 10),        // no trajeto
      L("brt", "2", "10", -22.999, -43.45, 10),      // ~110 m → UNCERTAIN
      L("brt", "3", "10", -22.97, -43.45, 10, 0),    // ~3,3 km → OFF_ROUTE
      L("brt", "4", "10", -23.0, -43.45, 400),       // antigo → STALE
      L("sppo", "A", "474", -22.9, -43.2, 30),
    ], agora, trajetos);
    expect(r.total).toBe(5);
    expect(r.brt.estados).toEqual({ ON_ROUTE: 1, UNCERTAIN: 1, OFF_ROUTE: 1, STALE: 1, SEM_TRAJETO: 0 });
    expect(r.brt.linhas).toBe(1);
    expect(r.onibus.estados).toBeNull();
    expect(r.recentes).toBe(4);
  });
});

import { mesmoDestino } from "../src/lib/trajeto";
it("mesmoDestino: casa nomes do GPS com os do GTFS", () => {
  expect(mesmoDestino("Terminal Alvorada", "Alvorada")).toBe(true);
  expect(mesmoDestino("Estação Santa Cruz", "Santa Cruz")).toBe(true);
  expect(mesmoDestino("Terminal Alvorada", "Santa Cruz")).toBe(false);
  expect(mesmoDestino(null, "Alvorada")).toBe(false);
});
