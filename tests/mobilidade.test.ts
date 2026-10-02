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

import { acumulado, encaixar, pontoEm, projetar, ENCAIXE_MAX_M } from "../src/lib/trajeto";
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
  it("catálogo GTFS: linha 10 tem os dois sentidos", () => {
    const l = (trajetosJson as { linhas: Record<string, { destino: string }[]> }).linhas["10"];
    expect(l.map((t) => t.destino).sort()).toEqual(["Estação Santa Cruz", "Terminal Alvorada"]);
  });
});
