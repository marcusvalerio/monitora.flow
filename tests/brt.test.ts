import { describe, expect, it } from "vitest";
import { linhaBrt, linhasBrtDaEstacao, modoDaLinha, sentidosDaLinha } from "../src/lib/brt";
import { casarVeiculo, ROUTE_MATCHING_TOLERANCE_METERS } from "../src/lib/matching";
import { acumulado, pontoEm } from "../src/lib/trajeto";
import { rumoEntre } from "../src/lib/veiculo";
import { ESTACOES } from "../src/lib/estacoes";

describe("classificação de modo (catálogo oficial GTFS)", () => {
  it("linha 10 do GPS do BRT é BRT", () => expect(modoDaLinha("10", "brt")).toBe("BRT"));
  // casos observados na UI com o bug (BRT mostrando ônibus): todos vêm do GPS dos ônibus municipais
  it.each(["100", "104", "107", "109", "010", "210"])("linha %s do GPS dos ônibus é BUS", (l) => expect(modoDaLinha(l, "sppo")).toBe("BUS"));
  it("alimentador operado pelo BRT (68, route_type 700 no GTFS) é BUS, não BRT", () => {
    expect(modoDaLinha("68", "brt")).toBe("BUS");
    expect(linhaBrt("68")).toBeNull();
  });
  it("código do GPS do BRT que o GTFS não conhece é OUTROS", () => {
    expect(modoDaLinha("0", "brt")).toBe("OUTROS");
    expect(modoDaLinha("54", "brt")).toBe("OUTROS");
  });
  it("010 nunca vira BRT 10", () => {
    expect(linhaBrt("010")).toBeNull();
    expect(modoDaLinha("010", "brt")).not.toBe("BRT");
  });
});

describe("catálogo do BRT", () => {
  it("linha 10 tem os dois sentidos oficiais", () => {
    expect(sentidosDaLinha("10").map((s) => s.destino).sort()).toEqual(["Estação Santa Cruz", "Terminal Alvorada"]);
    expect(linhaBrt("10")!.nome).toBe("Santa Cruz - Terminal Alvorada");
  });
  it("linhas da estação vêm do GTFS (Terminal Alvorada tem a 10; Mato Alto tem a 10)", () => {
    const id = (nome: string) => ESTACOES.find((e) => e.nome === nome)!.id;
    expect(linhasBrtDaEstacao(id("Terminal Alvorada"))).toContain("10");
    expect(linhasBrtDaEstacao(id("Mato Alto"))).toContain("10");
    for (const l of linhasBrtDaEstacao(id("Mato Alto"))) expect(linhaBrt(l)).not.toBeNull();
  });
});

describe("map matching da linha 10 (shapes oficiais)", () => {
  const tr = linhaBrt("10")!.trajetos.map((t) => ({ ...t, acc: acumulado(t.coords) }));
  const porDestino = (d: string) => tr.find((t) => t.destino === d)!;
  /** posição e rumo reais do trecho a uma fração do percurso */
  const em = (t: (typeof tr)[number], f: number) => {
    const total = t.acc[t.acc.length - 1];
    const p = pontoEm(t.coords, total * f, t.acc), q = pontoEm(t.coords, total * f + 40, t.acc);
    return { ...p, rumo: Math.round(rumoEntre(p, q)) };
  };
  const V = (p: { lat: number; lng: number; rumo: number | null }, destino: string | null, extra: Partial<{ velocidadeKmh: number; idadeS: number }> = {}) =>
    ({ lat: p.lat, lng: p.lng, rumo: p.rumo, destino, velocidadeKmh: 40, idadeS: 10, ...extra });

  for (const destino of ["Terminal Alvorada", "Estação Santa Cruz"]) {
    for (const f of [0.02, 0.5, 0.97]) {
      it(`→ ${destino}: ${f * 100}% do percurso é ON_ROUTE no shape do sentido`, () => {
        const t = porDestino(destino);
        const c = casarVeiculo(V(em(t, f), destino.replace(/^(Terminal|Estação) /, "")), tr);
        expect(c.routeState).toBe("ON_ROUTE");
        expect(c.shapeId).toBe(t.shapeId);
        expect(c.distanciaTrajetoM!).toBeLessThanOrEqual(ROUTE_MATCHING_TOLERANCE_METERS);
        expect(c.headingDeltaDeg!).toBeLessThan(20);
      });
    }
  }
  it("rumo contrário ao sentido informado → UNCERTAIN (não confirma)", () => {
    const p = em(porDestino("Terminal Alvorada"), 0.5);
    const c = casarVeiculo(V({ ...p, rumo: (p.rumo + 180) % 360 }, "Alvorada"), [porDestino("Terminal Alvorada")]);
    expect(c.routeState).toBe("UNCERTAIN");
  });
  it("sem destino, o rumo escolhe o shape certo", () => {
    const p = em(porDestino("Estação Santa Cruz"), 0.4);
    expect(casarVeiculo(V(p, null), tr).shapeId).toBe(porDestino("Estação Santa Cruz").shapeId);
  });
  it("sem rumo: ON_ROUTE com confiança menor", () => {
    const c = casarVeiculo(V({ ...em(porDestino("Terminal Alvorada"), 0.3), rumo: null }, "Alvorada"), tr);
    expect(c.routeState).toBe("ON_ROUTE");
    expect(c.confidence).toBeLessThan(0.95);
  });
  it("garagem real (02/10/2026, ~2,7 km do corredor) → OFF_ROUTE, sem mover a posição", () => {
    const c = casarVeiculo(V({ lat: -22.9206, lng: -43.6453, rumo: null }, "Alvorada", { velocidadeKmh: 0 }), tr);
    expect(c.routeState).toBe("OFF_ROUTE");
    expect(c.distanciaTrajetoM!).toBeGreaterThan(2000);
  });
  it("GPS antigo → STALE", () => {
    expect(casarVeiculo(V(em(porDestino("Terminal Alvorada"), 0.5), "Alvorada", { idadeS: 600 }), tr).routeState).toBe("STALE");
  });
});
