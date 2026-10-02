import type { Leitura } from "./fontes";
import { distanciaM } from "./geo";
import { PARAMETROS } from "./parametros";

/**
 * ESTIMATIVA DE CHEGADA — EXPERIMENTAL / ESCOLHA DO SISTEMA. Não é horário oficial.
 *
 * Para cada veículo da linha com ≥ 2 leituras na janela:
 *   p1, t1 = última leitura;  p0, t0 = leitura mais antiga com t1 − t0 ≥ CHEGADA_DT_MIN_S
 *   d1 = dist(p1, destino), d0 = dist(p0, destino)   (linha reta, haversine)
 *   va = (d0 − d1) / (t1 − t0)                      velocidade de aproximação observada (m/s)
 *   Só conta como "vindo" se d0 − d1 ≥ CHEGADA_APROX_MIN_M.
 *   ETA = max(0, d1 / va − (agora − t1))           (segundos)
 * Linha reta subestima a distância real pela rua; paradas e trânsito mudam va. Sem veículo vindo → sem dado.
 */
export interface Chegada {
  fonte: string; veiculo: string; linha: string | null; sentido: string | null;
  lat: number; lng: number; distanciaM: number; velocidadeAproximacaoKmh: number;
  etaMin: number; ultimaLeitura: Date;
}

export function estimarChegadas(ls: Leitura[], lat: number, lng: number, agora: Date): Chegada[] {
  const porVeiculo = new Map<string, Leitura[]>();
  for (const l of ls) {
    const k = `${l.fonte}|${l.veiculo}`;
    (porVeiculo.get(k) ?? porVeiculo.set(k, []).get(k)!).push(l);
  }
  const out: Chegada[] = [];
  for (const arr of porVeiculo.values()) {
    arr.sort((a, b) => a.ts.getTime() - b.ts.getTime());
    const p1 = arr[arr.length - 1];
    const p0 = arr.find((x) => (p1.ts.getTime() - x.ts.getTime()) / 1000 >= PARAMETROS.CHEGADA_DT_MIN_S);
    if (!p0) continue;
    const d1 = distanciaM(p1.lat, p1.lng, lat, lng);
    const d0 = distanciaM(p0.lat, p0.lng, lat, lng);
    if (d1 > PARAMETROS.CHEGADA_DIST_MAX_M || d0 - d1 < PARAMETROS.CHEGADA_APROX_MIN_M) continue;
    const va = (d0 - d1) / ((p1.ts.getTime() - p0.ts.getTime()) / 1000);
    const eta = Math.max(0, d1 / va - (agora.getTime() - p1.ts.getTime()) / 1000);
    out.push({
      fonte: p1.fonte, veiculo: p1.veiculo, linha: p1.linha, sentido: p1.sentido, lat: p1.lat, lng: p1.lng,
      distanciaM: Math.round(d1), velocidadeAproximacaoKmh: Math.round(va * 3.6 * 10) / 10,
      etaMin: Math.round(eta / 6) / 10, ultimaLeitura: p1.ts,
    });
  }
  return out.sort((a, b) => a.etaMin - b.etaMin);
}

/** Última posição de cada veículo. */
export function ultimasPosicoes(ls: Leitura[]): Leitura[] {
  const m = new Map<string, Leitura>();
  for (const l of ls) {
    const k = `${l.fonte}|${l.veiculo}`;
    const a = m.get(k);
    if (!a || l.ts > a.ts) m.set(k, l);
  }
  return [...m.values()];
}
