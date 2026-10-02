/**
 * Validação da posição de um veículo contra o trajeto oficial (map matching simples). EXPERIMENTAL / ESCOLHA DO SISTEMA.
 *
 * Associação disponível no GPS do BRT: linha (código) + destino (texto "trajeto") — o feed NÃO traz trip_id nem shape_id
 * (verificado em 02/10/2026). Então: linha → sentido (destino ↔ trip_headsign) → shapes daquele sentido → projeção.
 * Sem destino, testa todos os shapes da linha e escolhe o que melhor concorda em distância e direção.
 */
import { acumulado, mesmoDestino, projetar, type Coords } from "./trajeto";
import { deltaAngulo, rumoEntre } from "./veiculo";

/** Até aqui do shape esperado a posição é compatível (GPS urbano típico erra 10–30 m; corredor BRT tem pistas largas). */
export const ROUTE_MATCHING_TOLERANCE_METERS = 60;
/** Acima disso a posição é incompatível com o trajeto (OFF_ROUTE). Entre os dois: UNCERTAIN. */
export const ROUTE_OFF_THRESHOLD_METERS = 300;
/** Rumo do GPS vs rumo do trecho: acima disso, sentido inconsistente (provável sentido trocado ou outro trajeto). */
export const HEADING_TOLERANCE_DEG = 60;
/** Só compara rumo com o veículo andando (parado, o rumo do GPS não é confiável). */
export const HEADING_MIN_KMH = 3;
/** Posição mais velha que isso é STALE. */
export const STALE_AFTER_S = 180;

export type RouteState = "ON_ROUTE" | "UNCERTAIN" | "OFF_ROUTE" | "STALE";
export interface TrajetoRef { shapeId: string; destino: string; coords: Coords; acc?: number[] }
export interface Casamento {
  routeState: RouteState; confidence: number; motivo: string;
  distanciaTrajetoM: number | null; headingDeltaDeg: number | null; shapeId: string | null;
}

/** Confiança 0–1 por estado (escala ordinal, não probabilidade). */
export const CONFIANCA: Record<RouteState, number> = { ON_ROUTE: 0.9, UNCERTAIN: 0.5, OFF_ROUTE: 0.15, STALE: 0.1 };

export function casarVeiculo(
  v: { lat: number; lng: number; destino: string | null; rumo: number | null; velocidadeKmh: number; idadeS: number },
  trajetos: TrajetoRef[],
): Casamento {
  const doSentido = v.destino ? trajetos.filter((t) => mesmoDestino(t.destino, v.destino)) : [];
  const candidatos = doSentido.length ? doSentido : trajetos;
  const comparaRumo = v.rumo !== null && v.velocidadeKmh >= HEADING_MIN_KMH;

  let melhor: { d: number; delta: number | null; shapeId: string; score: number } | null = null;
  for (const t of candidatos) {
    const e = projetar(v.lat, v.lng, t.coords, t.acc ?? acumulado(t.coords));
    if (!e) continue;
    const a = t.coords[e.indice], b = t.coords[e.indice + 1];
    const rumoTrecho = rumoEntre({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });
    const delta = comparaRumo ? Math.abs(deltaAngulo(rumoTrecho, v.rumo!)) : null;
    const score = e.distM + (delta !== null && delta > 90 ? 1000 : 0); // prefere o trecho no mesmo sentido
    if (!melhor || score < melhor.score) melhor = { d: e.distM, delta, shapeId: t.shapeId, score };
  }

  const base = { distanciaTrajetoM: melhor ? Math.round(melhor.d) : null, headingDeltaDeg: melhor?.delta == null ? null : Math.round(melhor.delta), shapeId: melhor?.shapeId ?? null };
  const r = (routeState: RouteState, motivo: string): Casamento => ({ routeState, confidence: CONFIANCA[routeState], motivo, ...base });
  if (v.idadeS > STALE_AFTER_S) return r("STALE", `posição com ${Math.round(v.idadeS)} s`);
  if (!melhor) return { routeState: "UNCERTAIN", confidence: 0.3, motivo: "linha sem trajeto oficial", distanciaTrajetoM: null, headingDeltaDeg: null, shapeId: null };
  if (melhor.d > ROUTE_OFF_THRESHOLD_METERS) return r("OFF_ROUTE", `a ${Math.round(melhor.d)} m do trajeto`);
  if (melhor.d > ROUTE_MATCHING_TOLERANCE_METERS) return r("UNCERTAIN", `a ${Math.round(melhor.d)} m do trajeto`);
  if (melhor.delta !== null && melhor.delta > HEADING_TOLERANCE_DEG) return r("UNCERTAIN", `rumo ${Math.round(melhor.delta)}° diferente do trecho`);
  const c = r("ON_ROUTE", melhor.delta !== null ? "no trajeto, rumo confere" : "no trajeto");
  return melhor.delta !== null ? { ...c, confidence: 0.95 } : c;
}

/** Linha de diagnóstico (logs de desenvolvimento). */
export const diagnostico = (veiculo: string, linha: string, c: Casamento) =>
  `vehicle=${veiculo} route=${linha} shape=${c.shapeId ?? "-"} distanceToShape=${c.distanciaTrajetoM ?? "-"}m headingDelta=${c.headingDeltaDeg ?? "-"}° state=${c.routeState} confidence=${c.confidence}`;
