/**
 * MapTransportLayer — rota, estações e diagnóstico. Só camadas nativas do MapLibre; cores de app/ui/tokens.ts.
 * Rota (de baixo para cima): route-glow (dimensão luminosa difusa) · route-base (separa a rota do mapa) · route-active (Ultramarine)
 * · route-flow (pulso discreto no sentido da viagem, animado) · route-direction (setas) · route-highlight (shape do veículo selecionado).
 * A ordem dos pontos do shape é a ordem da viagem: setas e fluxo seguem o sentido real.
 */
import type { Map as MLMap, ExpressionSpecification } from "maplibre-gl";
import { MAPA, temaAtual } from "../ui/tokens";
import { reduzMovimento } from "../ui/motion";

const vazio = { type: "FeatureCollection" as const, features: [] };
const largura = (a: number, b: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 10, a, 16, b] as ExpressionSpecification;

export function camadasRota(map: MLMap) {
  const c = MAPA[temaAtual()];
  map.addSource("rota", { type: "geojson", data: vazio, lineMetrics: true });
  const linha = { "line-join": "round", "line-cap": "round" } as const;
  map.addLayer({ id: "route-glow", type: "line", source: "rota", layout: linha,
    paint: { "line-color": c.rotaBrilho, "line-width": largura(8, 20), "line-blur": largura(6, 14), "line-opacity": 0.28 } });
  map.addLayer({ id: "route-base", type: "line", source: "rota", layout: linha,
    paint: { "line-color": c.rotaBase, "line-width": largura(4.5, 11), "line-opacity": 0.9 } });
  map.addLayer({ id: "route-active", type: "line", source: "rota", layout: linha,
    paint: { "line-color": c.rota, "line-width": largura(2.4, 6.5) } });
  map.addLayer({ id: "route-flow", type: "line", source: "rota", layout: linha,
    paint: { "line-color": c.rotaBase, "line-width": largura(1, 2.4), "line-opacity": 0.55, "line-dasharray": [0, 4, 3] } });
  map.addLayer({ id: "route-direction", type: "symbol", source: "rota", minzoom: 12.5,
    layout: { "symbol-placement": "line", "symbol-spacing": 110, "text-field": "›", "text-font": ["Noto Sans Bold"], "text-size": 15, "text-keep-upright": false, "text-rotation-alignment": "map" },
    paint: { "text-color": c.rotaBase, "text-opacity": 0.9 } });
  map.addLayer({ id: "route-highlight", type: "line", source: "rota", filter: ["==", ["get", "shapeId"], "__nenhum__"], layout: linha,
    paint: { "line-color": c.rota, "line-width": largura(4, 9.5) } });
  return animarFluxo(map);
}

/** Fluxo no sentido da viagem: troca o padrão de traço em passos (~10 fps). Pausa sem foco; desligado com reduced-motion. */
function animarFluxo(map: MLMap) {
  if (reduzMovimento()) return () => {};
  // sequência clássica de "marching ants" do MapLibre: o traço avança sem recalcular geometria
  const passos = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
  let i = 0, raf = 0, ultimo = 0;
  const passo = (t: number) => {
    raf = requestAnimationFrame(passo);
    if (document.hidden || t - ultimo < 110 || !map.getLayer("route-flow")) return;
    ultimo = t; i = (i + 1) % passos.length;
    map.setPaintProperty("route-flow", "line-dasharray", passos[i]);
  };
  raf = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(raf);
}

export function camadasEstacoes(map: MLMap, estacoes: { id: string; nome: string; tipo: string; lat: number; lng: number }[]) {
  const c = MAPA[temaAtual()];
  map.addSource("estacoes", {
    type: "geojson",
    data: { type: "FeatureCollection", features: estacoes.map((e) => ({ type: "Feature", id: e.id, properties: { id: e.id, nome: e.nome, tipo: e.tipo }, geometry: { type: "Point", coordinates: [e.lng, e.lat] } })) },
  });
  const tipo = (t: number | string, e: number | string) => ["match", ["get", "tipo"], "terminal", t, e] as ExpressionSpecification;
  map.addLayer({
    id: "estacoes-pt", type: "circle", source: "estacoes",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, tipo(3, 1.6), 15, tipo(6.5, 4.2)] as ExpressionSpecification,
      "circle-color": tipo(c.estacao, c.estacaoFundo), "circle-stroke-color": c.estacao, "circle-stroke-width": tipo(2, 1.3),
    },
  });
  map.addLayer({
    id: "estacoes-nome", type: "symbol", source: "estacoes", minzoom: 13,
    layout: { "text-field": ["get", "nome"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true, "text-letter-spacing": 0.02 },
    paint: { "text-color": c.rotulo, "text-halo-color": c.halo, "text-halo-width": 1.4 },
  });
}

export function camadasDiagnostico(map: MLMap) {
  map.addSource("debug", { type: "geojson", data: vazio });
  map.addLayer({ id: "debug-seg", type: "line", source: "debug", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#FF7058", "line-width": 2, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "debug-pt", type: "circle", source: "debug", filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 6, "circle-color": ["match", ["get", "tipo"], "gps", "#FF7058", "#3047C7"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
  map.addLayer({ id: "debug-rot", type: "symbol", source: "debug", filter: ["==", ["geometry-type"], "Point"],
    layout: { "text-field": ["get", "rotulo"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top" },
    paint: { "text-color": "#111318", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
}
