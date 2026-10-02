/**
 * Catálogo oficial dos ônibus (GTFS SMTR, route_type ≠ 702), gerado por `npm run brt:atualizar` → src/data/onibus-catalogo.json.
 * Só no servidor (~2 MB). Shapes indexados por shape_id: o GPS dos ônibus informa o shape_id da viagem.
 */
import catalogo from "../data/onibus-catalogo.json";
import type { Coords } from "./trajeto";

const C = catalogo as unknown as {
  fonte: string; versaoGtfs: string | null; validoAte: string | null;
  linhas: Record<string, { routeId: string; nome: string; trajetos: { shapeId: string; sentido: number; destino: string; viagens: number }[] }>;
  shapes: Record<string, Coords>;
};
export const CATALOGO_ONIBUS = { fonte: C.fonte, versaoGtfs: C.versaoGtfs, validoAte: C.validoAte };
export function linhaOnibus(linha: string | null | undefined) { return C.linhas[(linha ?? "").trim().toUpperCase()] ?? null; }
export function shapeOnibus(id: string | null | undefined): Coords | null { return id ? C.shapes[id] ?? null : null; }
export function trajetosOnibus(linha: string) {
  return (linhaOnibus(linha)?.trajetos ?? []).filter((t) => C.shapes[t.shapeId]).map((t) => ({ ...t, coords: C.shapes[t.shapeId] }));
}
