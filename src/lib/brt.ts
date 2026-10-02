/**
 * Catálogo oficial do BRT (GTFS da SMTR, gerado por `npm run brt:atualizar`) e classificação de modo.
 * Fonte única de verdade: nenhuma outra parte do sistema decide "é BRT" por número, prefixo, cor ou fonte do GPS.
 */
import catalogo from "../data/brt-catalogo.json";
import type { Coords } from "./trajeto";

export type TransportMode = "BRT" | "BUS" | "OUTROS";

export interface BrtTrajeto { shapeId: string; sentido: number; destino: string; viagens: number; coords: Coords }
export interface BrtLinha { routeId: string; nome: string; servico: string | null; trajetos: BrtTrajeto[] }

const C = catalogo as unknown as {
  fonte: string; criterio: string; versaoGtfs: string | null; validoAte: string | null;
  linhas: Record<string, BrtLinha>; linhasPorEstacao: Record<string, string[]>;
  outrasDoOperador: Record<string, { routeType: string; nome: string }>;
};

export const CATALOGO_BRT = { fonte: C.fonte, criterio: C.criterio, versaoGtfs: C.versaoGtfs, validoAte: C.validoAte };
const cod = (linha: string | null | undefined) => (linha ?? "").trim().toUpperCase();

export function linhaBrt(linha: string | null | undefined): BrtLinha | null { return C.linhas[cod(linha)] ?? null; }
export function codigosBrt(): string[] { return Object.keys(C.linhas); }
export function linhasBrtDaEstacao(estacaoId: string): string[] { return C.linhasPorEstacao[estacaoId] ?? []; }

/** Sentidos da linha: um por destino distinto (trip_headsign), com os shapes usados. */
export function sentidosDaLinha(linha: string) {
  const l = linhaBrt(linha);
  if (!l) return [];
  const m = new Map<string, { sentido: number; destino: string; shapeIds: string[] }>();
  for (const t of l.trajetos) {
    const s = m.get(t.destino) ?? { sentido: t.sentido, destino: t.destino, shapeIds: [] };
    s.shapeIds.push(t.shapeId); m.set(t.destino, s);
  }
  return [...m.values()];
}

/**
 * Modo da linha de um veículo:
 *  - BRT: código existe no catálogo (route_type 702);
 *  - BUS: veio do GPS dos ônibus municipais (SPPO), ou do GPS do BRT mas o GTFS diz que é ônibus (alimentador, route_type 700/200);
 *  - OUTROS: veio do GPS do BRT com código que o GTFS não conhece (ex.: "0", "54") — não classificamos.
 */
export function modoDaLinha(linha: string | null | undefined, fonte: "brt" | "sppo"): TransportMode {
  const c = cod(linha);
  if (!c) return "OUTROS";
  if (fonte === "brt") return C.linhas[c] ? "BRT" : C.outrasDoOperador[c] ? "BUS" : "OUTROS";
  return C.linhas[c] ? "OUTROS" : "BUS"; // SPPO com código de BRT seria inconsistente (não observado em 02/10/2026)
}
