import { describe, expect, it } from "vitest";
import { linhaBrt, modoDaLinha } from "../src/lib/brt";
import { trajetosDaLinha } from "../src/lib/catalogo";
import { casarVeiculo } from "../src/lib/matching";
import { acumulado, pontoEm } from "../src/lib/trajeto";
import { parseBrt, parseSppo } from "../src/lib/fontes";
import { proximaRotacao, rumoEntre } from "../src/lib/veiculo";
import { duracaoVeiculo } from "../app/ui/motion";
import { retrato } from "../src/lib/monitor";

const noRio = ([lng, lat]: [number, number]) => lng > -44 && lng < -42.9 && lat > -23.2 && lat < -22.6;

describe("coordenadas: latitude é latitude, GeoJSON é [lng, lat]", () => {
  it("todos os pontos dos trajetos BRT estão no Rio na ordem [lng, lat]", () => {
    for (const c of ["10", "22", "35", "60"]) for (const t of linhaBrt(c)!.trajetos) expect(t.coords.every(noRio)).toBe(true);
  });
  it("trajetos dos ônibus também", () => {
    for (const t of trajetosDaLinha("853", "BUS")) expect(t.coords.every(noRio)).toBe(true);
  });
  it("parsers mapeiam latitude→lat e longitude→lng (BRT e ônibus)", () => {
    const agora = new Date("2026-10-02T20:00:00Z");
    const b = parseBrt({ veiculos: [{ codigo: "1", linha: "10", latitude: -23.0, longitude: -43.4, dataHora: agora.getTime() - 5000, velocidade: 30, direcao: 90 }] }, agora).leituras[0];
    expect([b.lat, b.lng]).toEqual([-23.0, -43.4]);
    const s = parseSppo([{ id_veiculo: "A", servico: "853", latitude: -22.9, longitude: -43.5, velocidade: 10, datetime: "2026-10-02T19:59:50Z", shape_id: "x", trip_id: "y", route_id: "z" }]).leituras[0];
    expect([s.lat, s.lng, s.shapeId, s.tripId, s.routeId]).toEqual([-22.9, -43.5, "x", "y", "z"]);
  });
  it("pontos do Monitor saem como [lng, lat]", () => {
    const agora = new Date("2026-10-02T20:00:00Z");
    const r = retrato([{ fonte: "sppo", veiculo: "A", linha: "853", sentido: null, lat: -22.9, lng: -43.5, velocidade: 10, ts: agora }], agora, () => []);
    expect(r.pontos[0].slice(0, 2)).toEqual([-43.5, -22.9]);
  });
});

describe("linha 853 (convencional)", () => {
  it("é BUS e nunca BRT", () => {
    expect(modoDaLinha("853", "sppo")).toBe("BUS");
    expect(linhaBrt("853")).toBeNull();
  });
  it("tem trajetos oficiais de ônibus", () => expect(trajetosDaLinha("853", "BUS").length).toBeGreaterThan(0));
  it("veículo com shape_id da viagem é comparado SÓ com esse shape (associação por viagem)", () => {
    const tr = trajetosDaLinha("853", "BUS").map((t) => ({ ...t, acc: acumulado(t.coords) }));
    const t = tr[0];
    const p = pontoEm(t.coords, t.acc[t.acc.length - 1] * 0.5, t.acc), q = pontoEm(t.coords, t.acc[t.acc.length - 1] * 0.5 + 40, t.acc);
    const c = casarVeiculo({ ...p, rumo: Math.round(rumoEntre(p, q)), destino: null, velocidadeKmh: 30, idadeS: 5, shapeIdGps: t.shapeId }, tr);
    expect(c.associacao).toBe("viagem");
    expect(c.shapeId).toBe(t.shapeId);
    expect(c.routeState).toBe("ON_ROUTE");
    expect(c.projecao).not.toBeNull();
  });
});

describe("viagem informada no sentido oposto (dado real de 02/10/2026)", () => {
  it("fica UNCERTAIN com o motivo e o shape compatível — não troca o dado da fonte", () => {
    const tr = trajetosDaLinha("853", "BUS").map((t) => ({ ...t, acc: acumulado(t.coords) }));
    const ida = tr.find((t) => t.sentido === 0)!, volta = tr.find((t) => t.sentido === 1)!;
    const tot = volta.acc[volta.acc.length - 1];
    const p = pontoEm(volta.coords, tot * 0.4, volta.acc), q = pontoEm(volta.coords, tot * 0.4 + 40, volta.acc);
    // anda no sentido da VOLTA, mas o GPS diz que a viagem é a da IDA
    const c = casarVeiculo({ ...p, rumo: Math.round(rumoEntre(p, q)), destino: null, velocidadeKmh: 30, idadeS: 5, shapeIdGps: ida.shapeId }, tr);
    expect(c.routeState).toBe("UNCERTAIN");
    expect(c.shapeId).toBe(ida.shapeId);
    expect(c.motivo).toMatch(/sentido oposto/);
    expect(c.shapeCompativel).toBeTruthy();
  });
});

describe("rotação do marcador = rumo, menor caminho, sem deslocamento", () => {
  it("primeiro rumo vira a rotação, sem +180", () => expect(proximaRotacao(null, 90)).toBe(90));
  it("359° → 1° gira +2° (não −358°)", () => expect(proximaRotacao(359, 1, 0)).toBe(361));
  it("1° → 359° gira −2°", () => expect(proximaRotacao(1, 359, 0)).toBe(-1));
  it("350° → 20° gira +30°", () => expect(proximaRotacao(350, 20)).toBe(380));
  it("tremida < 4° é ignorada; sem rumo mantém", () => {
    expect(proximaRotacao(90, 92)).toBe(90);
    expect(proximaRotacao(90, null)).toBe(90);
  });
});

describe("interpolação nunca inventa percurso", () => {
  it("dado antigo (STALE) não anima", () => expect(duracaoVeiculo(10_000, 100, true)).toBe(0));
  it("intervalo incoerente (> 60 s) não anima", () => expect(duracaoVeiculo(70_000, 100)).toBe(0));
  it("salto grande é mostrado rápido", () => expect(duracaoVeiculo(10_000, 1500)).toBeLessThan(500));
  it("no ritmo normal, termina antes da próxima leitura", () => expect(duracaoVeiculo(10_000, 150)).toBeLessThan(10_000));
});
