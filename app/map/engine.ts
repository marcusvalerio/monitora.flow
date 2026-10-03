/**
 * MapEngine — criação e configuração comum dos mapas do Monitora.
 * Camadas, de baixo para cima: MapBaseLayer (estilo.ts) → água viva (motion) → MapTransportLayer (transporte.ts)
 * → MapInteractionLayer (marcadores DOM de veículo, seleção, você). Clima e ocorrências entram como camadas próprias quando houver fonte.
 */
import type { Map as MLMap } from "maplibre-gl";
import { estiloMonitora } from "./estilo";
import { aguaViva } from "../ui/motion";
import { MAPA, temaAtual } from "../ui/tokens";
export { temaAtual };
export const token = (nome: string, padrao: string) =>
  (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(nome).trim()) || padrao;

export const RIO = { centro: [-43.42, -22.93] as [number, number], zoom: 10.2 };

export async function criarMapa(container: HTMLElement, opts: { centro?: [number, number]; zoom?: number } = {}) {
  const m = await import("maplibre-gl");
  const map: MLMap = new m.Map({
    container, style: estiloMonitora(temaAtual()), center: opts.centro ?? RIO.centro, zoom: opts.zoom ?? RIO.zoom,
    attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0,
    fadeDuration: 180,
  });
  map.touchZoomRotate.disableRotation();
  let pararAgua = () => {};
  map.on("load", () => { pararAgua = aguaViva(map, MAPA[temaAtual()].texturaAgua); });
  return { m, map, destruir: () => { pararAgua(); map.remove(); } };
}
