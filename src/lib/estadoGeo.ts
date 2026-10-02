/**
 * Estado geográfico de um veículo em relação ao trajeto oficial da linha (EXPERIMENTAL / ESCOLHA DO SISTEMA).
 *   ON_ROUTE  — GPS a até ENCAIXE_MAX_M (60 m) do trajeto: pode ser desenhado sobre a via.
 *   UNCERTAIN — entre 60 m e FORA_TRAJETO_M (300 m): perto, mas não confiável para encaixe; mostra o GPS cru.
 *   OFF_ROUTE — mais de 300 m: incompatível com o trajeto; mostra o GPS cru e sinaliza.
 *   STALE     — última posição com mais de VELHO_S (180 s): dado antigo, vale mais que a distância.
 *   null      — linha sem trajeto conhecido (hoje: ônibus convencionais) e posição recente.
 */
import { ENCAIXE_MAX_M, FORA_TRAJETO_M } from "./trajeto";

export type EstadoGeo = "ON_ROUTE" | "UNCERTAIN" | "OFF_ROUTE" | "STALE";
export const VELHO_S = 180;

export function estadoGeo(idadeS: number, distanciaTrajetoM: number | null): EstadoGeo | null {
  if (idadeS > VELHO_S) return "STALE";
  if (distanciaTrajetoM === null) return null;
  if (distanciaTrajetoM <= ENCAIXE_MAX_M) return "ON_ROUTE";
  if (distanciaTrajetoM <= FORA_TRAJETO_M) return "UNCERTAIN";
  return "OFF_ROUTE";
}

/**
 * Proximidade de uma ocorrência ao trajeto (corredor de impacto).
 * NO_TRAJETO até CORREDOR_NO_M; PROXIMA até CORREDOR_PERTO_M; senão FORA_DO_IMPACTO. Valores: EXPERIMENTAL / ESCOLHA DO SISTEMA.
 */
export const CORREDOR_NO_M = 100;
export const CORREDOR_PERTO_M = 800;
export type Proximidade = "NO_TRAJETO" | "PROXIMA" | "FORA_DO_IMPACTO";
export function proximidade(distM: number): Proximidade {
  return distM <= CORREDOR_NO_M ? "NO_TRAJETO" : distM <= CORREDOR_PERTO_M ? "PROXIMA" : "FORA_DO_IMPACTO";
}
