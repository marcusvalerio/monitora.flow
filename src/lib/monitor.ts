/**
 * Retrato operacional da frota (só dados observados + cálculos documentados).
 * Base: leitura ao vivo da SMTR (BRT: retrato; ônibus: últimos 3 min) + histórico em memória de 10 min, última posição de cada veículo.
 * Modo de cada veículo pelo catálogo oficial (src/lib/brt.ts); estado geográfico para BRT (por sentido) e ônibus (pelo shape da viagem).
 */
import type { Leitura } from "./fontes";
import { normalizarFrota } from "./veiculo";
import { modoDaLinha, type TransportMode } from "./brt";
import { trajetosDaLinha } from "./catalogo";
import { casarVeiculo, STALE_AFTER_S, type RouteState } from "./matching";
import { acumulado, type Coords } from "./trajeto";

export const RECENTE_S = 120; // "posição recente" = até 2 min (EXPERIMENTAL / ESCOLHA DO SISTEMA)

export interface ResumoFrota {
  veiculos: number; linhas: number; recentes: number; velhos: number; parados: number;
  estados: Record<RouteState, number> | null;
}

export function ultimaPorVeiculo(ls: Leitura[]): Leitura[] {
  const m = new Map<string, Leitura>();
  for (const l of ls) {
    const k = `${l.fonte}|${l.veiculo}`;
    const a = m.get(k);
    if (!a || l.ts > a.ts) m.set(k, l);
  }
  return [...m.values()];
}

/** `trajetosDe` permite injetar trajetos nos testes; padrão = catálogo oficial do BRT. */
export function retrato(ls: Leitura[], agora: Date, trajetosDe: (linha: string, modo: TransportMode) => { shapeId: string; destino: string; coords: Coords }[] = trajetosDaLinha) {
  const cache = new Map<string, { shapeId: string; destino: string; coords: Coords; acc: number[] }[]>();
  const trs = (l: string, m: TransportMode) => cache.get(m + l) ?? cache.set(m + l, trajetosDe(l, m).map((t) => ({ ...t, acc: acumulado(t.coords) }))).get(m + l)!;
  const frota = normalizarFrota(ls.filter((l) => l.linha), agora);
  const pontos: [number, number, string, string][] = []; // [lng, lat, modo, estado]
  const porModo: Record<TransportMode, ResumoFrota> = {} as Record<TransportMode, ResumoFrota>;
  const linhas: Record<TransportMode, Set<string>> = { BRT: new Set(), BUS: new Set(), OUTROS: new Set() };
  for (const m of ["BRT", "BUS", "OUTROS"] as TransportMode[])
    porModo[m] = { veiculos: 0, linhas: 0, recentes: 0, velhos: 0, parados: 0, estados: m === "OUTROS" ? null : { ON_ROUTE: 0, UNCERTAIN: 0, OFF_ROUTE: 0, STALE: 0 } };
  for (const v of frota) {
    const modo = modoDaLinha(v.linha, v.fonte);
    const r = porModo[modo];
    r.veiculos++; linhas[modo].add(v.linha!.toUpperCase());
    if (v.idadeS <= RECENTE_S) r.recentes++;
    if (v.idadeS > STALE_AFTER_S) r.velhos++;
    if (v.parado) r.parados++;
    let estado = v.idadeS > STALE_AFTER_S ? "STALE" : "SEM_TRAJETO";
    const tr = modo === "OUTROS" ? [] : trs(v.linha!.toUpperCase(), modo);
    // sem trajeto oficial → SEM_TRAJETO (fora das contas de estado; não inventamos "incerto")
    if (tr.length) { estado = casarVeiculo(v, tr).routeState; r.estados![estado as RouteState]++; }
    pontos.push([Math.round(v.lng * 1e5) / 1e5, Math.round(v.lat * 1e5) / 1e5, modo, estado]);
  }
  for (const m of Object.keys(porModo) as TransportMode[]) porModo[m].linhas = linhas[m].size;
  const total = frota.length;
  return { brt: porModo.BRT, onibus: porModo.BUS, outros: porModo.OUTROS, total, recentes: frota.filter((v) => v.idadeS <= RECENTE_S).length, pontos };
}
