/**
 * Viagem oficial de cada BRT (GTFS-Realtime → trip_id) e estações restantes pela sequência de stop_times.
 * Tempo até cada estação = tempo PROGRAMADO entre paradas (stop_times), a partir da posição atual no trajeto
 * (interpolada entre a parada anterior e a próxima). Estimativa; não é horário oficial de passagem.
 */
import dados from "../data/brt-viagens.json";
import estacoesJson from "../data/estacoes-brt.json";
import { acumulado, projetar, type Coords } from "./trajeto";

type Parada = [string, string | null, number];
const V = dados as unknown as { trips: Record<string, [string, string, number, number]>; padroes: Parada[][]; versaoGtfs: string | null };
const EST = new Map((estacoesJson as { estacoes: { id: string; lat: number; lng: number }[] }).estacoes.map((e) => [e.id, e]));

export interface ViagemBrt { tripId: string; linha: string; shapeId: string; sentido: number; paradas: Parada[] }
export function viagemBrt(tripId: string | null | undefined): ViagemBrt | null {
  const t = tripId ? V.trips[tripId] : null;
  return t ? { tripId: tripId!, linha: t[0], shapeId: t[1], sentido: t[2], paradas: V.padroes[t[3]] } : null;
}

const posCache = new Map<string, (number | null)[]>(); // padrão+shape → s (m) de cada parada no shape
/** Estações à frente do veículo com o tempo programado restante até cada uma (min). */
export function estacoesRestantes(v: ViagemBrt, coords: Coords, lat: number, lng: number) {
  const acc = acumulado(coords);
  const k = `${v.tripId}`;
  let ss = posCache.get(k);
  if (!ss) {
    ss = v.paradas.map(([, est]) => { const e = est ? EST.get(est) : null; const p = e ? projetar(e.lat, e.lng, coords, acc) : null; return p && p.distM < 300 ? p.s : null; });
    posCache.set(k, ss);
  }
  const eu = projetar(lat, lng, coords, acc); if (!eu) return null;
  // parada anterior e próxima (com posição conhecida) em volta do veículo
  let ant = -1;
  for (let i = 0; i < ss.length; i++) if (ss[i] != null && ss[i]! <= eu.s) ant = i;
  const prox = ss.findIndex((s, i) => i > ant && s != null && s > eu.s);
  if (prox < 0) return [];
  const tAgora = ant < 0 ? v.paradas[prox][2] - 60
    : v.paradas[ant][2] + (v.paradas[prox][2] - v.paradas[ant][2]) * ((eu.s - ss[ant]!) / Math.max(1, ss[prox]! - ss[ant]!));
  return v.paradas.slice(prox).map(([nome, est, t]) => ({ nome, estacao: est, min: Math.max(0, Math.round(((t - tAgora) / 60) * 10) / 10) }));
}
