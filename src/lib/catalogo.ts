/** Ponto único para "quais trajetos oficiais esta linha tem", por modo. */
import { linhaBrt, type TransportMode } from "./brt";
import { trajetosOnibus } from "./onibus";
import type { Coords } from "./trajeto";

export interface TrajetoOficial { shapeId: string; sentido: number; destino: string; viagens: number; coords: Coords }

export function trajetosDaLinha(linha: string, modo: TransportMode): TrajetoOficial[] {
  if (modo === "BRT") return linhaBrt(linha)?.trajetos ?? [];
  if (modo === "BUS") return trajetosOnibus(linha);
  return [];
}
