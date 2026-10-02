import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estacoesProximas, parseChuvas } from "../src/lib/chuva";
import { normalizarOpenMeteo } from "../src/lib/tempo";
import { estimarChegadas, ultimasPosicoes } from "../src/lib/chegada";
import { pontoProximo } from "../src/config/pontos";
import type { Leitura } from "../src/lib/fontes";
import om from "./fixtures/open-meteo.json";

describe("Alerta Rio (fixture real de 02/10/2026)", () => {
  const r = parseChuvas(readFileSync(new URL("./fixtures/alertario-chuvas.xml", import.meta.url), "utf8"));
  it("lê as 33 estações e converte horário de Brasília para UTC", () => {
    expect(r.estacoes).toHaveLength(33);
    expect(r.geradoEm).toBe("2026-10-02T03:23:03.000Z");
    const v = r.estacoes.find((e) => e.nome === "Vidigal")!;
    expect(v.mm.h04).toBe(8.2);
    expect(v.medidoEm).toBe("2026-10-02T03:20:00.000Z");
  });
  it("estações mais próximas ordenadas por distância", () => {
    const p = estacoesProximas(r.estacoes, -22.9925, -43.233056, 2);
    expect(p[0].nome).toBe("Vidigal");
    expect(p[0].distanciaM).toBe(0);
    expect(p[1].distanciaM).toBeGreaterThan(0);
  });
  it("valor 'None' vira null", () => {
    expect(parseChuvas('<estacoes hora="2026-10-02T00:00:00"><estacao id="1" nome="X"><localizacao latitude="-22.9" longitude="-43.2"/><chuvas m15="None" hora="2026-10-02T00:00:00"/></estacao></estacoes>').estacoes[0].mm.m15).toBeNull();
  });
});

it("Open-Meteo: horários locais viram UTC", () => {
  const n = normalizarOpenMeteo(om);
  expect(n.agora?.em).toMatch(/Z$/);
  expect(n.proximasHoras.length).toBeGreaterThan(0);
});

describe("chegada (EXPERIMENTAL)", () => {
  const destino = { lat: -23.0, lng: -43.3 };
  const agora = new Date("2026-10-02T12:10:00Z");
  // ~0,009 grau de latitude ≈ 1 km
  const L = (veiculo: string, lat: number, t: string): Leitura => ({ fonte: "sppo", veiculo, linha: "917", sentido: "I", lat, lng: destino.lng, velocidade: 30, ts: new Date(`2026-10-02T${t}Z`) });

  it("veículo se aproximando: ETA = d1/va − (agora − t1)", () => {
    // de ~2 km para ~1 km em 120 s → va ≈ 8,3 m/s; d1 ≈ 1000 m → 120 s − 60 s de atraso = 60 s = 1 min
    const r = estimarChegadas([L("A", -23.018, "12:07:00"), L("A", -23.009, "12:09:00")], destino.lat, destino.lng, agora);
    expect(r).toHaveLength(1);
    expect(r[0].etaMin).toBeCloseTo(1, 1);
    expect(r[0].velocidadeAproximacaoKmh).toBeCloseTo(30, 0);
  });
  it("veículo se afastando ou com uma leitura só → sem estimativa", () => {
    expect(estimarChegadas([L("B", -23.009, "12:07:00"), L("B", -23.018, "12:09:00"), L("C", -23.01, "12:09:00")], destino.lat, destino.lng, agora)).toEqual([]);
  });
  it("ultimasPosicoes pega a leitura mais recente de cada veículo", () => {
    const u = ultimasPosicoes([L("A", 1, "12:00:00"), L("A", 2, "12:05:00"), L("B", 3, "12:01:00")]);
    expect(u.find((x) => x.veiculo === "A")!.lat).toBe(2);
  });
});

it("pontoProximo associa só dentro do limite", () => {
  expect(pontoProximo(-22.966357, -43.219413, 150)?.id).toBe("jardim-botanico-746");
  expect(pontoProximo(-22.5, -43.0, 150)).toBeUndefined();
});
