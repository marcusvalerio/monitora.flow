/**
 * MapTransportLayer — rota (base/ativa/direção/realce), estações e diagnóstico. Só camadas nativas do MapLibre.
 * A geometria vem pronta do domínio (GTFS); aqui só se desenha. Ordem de travessia do shape = sentido da viagem,
 * por isso as setas de direção (symbol-placement: line) apontam para onde o veículo vai.
 */
import type { Map as MLMap, ExpressionSpecification } from "maplibre-gl";
import { token } from "./engine";

const vazio = { type: "FeatureCollection" as const, features: [] };

export function camadasRota(map: MLMap) {
  map.addSource("rota", { type: "geojson", data: vazio });
  const largura = (a: number, b: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 10, a, 16, b] as ExpressionSpecification;
  map.addLayer({ id: "route-base", type: "line", source: "rota", layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": token("--surface", "#FDFDFE"), "line-width": largura(4.5, 11), "line-opacity": 0.95 } });
  map.addLayer({ id: "route-active", type: "line", source: "rota", layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": token("--map-route", "#1A9597"), "line-width": largura(2.2, 6) } });
  map.addLayer({ id: "route-direction", type: "symbol", source: "rota", minzoom: 12,
    layout: { "symbol-placement": "line", "symbol-spacing": 90, "text-field": "›", "text-font": ["Noto Sans Bold"], "text-size": 16, "text-keep-upright": false, "text-rotation-alignment": "map" },
    paint: { "text-color": token("--surface", "#FDFDFE"), "text-opacity": 0.95 } });
  // realce: shape do veículo selecionado (filtro trocado em tempo real)
  map.addLayer({ id: "route-highlight", type: "line", source: "rota", filter: ["==", ["get", "shapeId"], "__nenhum__"],
    layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": token("--signal", "#EEFF99"), "line-width": largura(1, 2.5), "line-opacity": 0.95 } });
}

export function camadasEstacoes(map: MLMap, estacoes: { id: string; nome: string; tipo: string; lat: number; lng: number }[]) {
  map.addSource("estacoes", {
    type: "geojson",
    data: { type: "FeatureCollection", features: estacoes.map((e) => ({ type: "Feature", id: e.id, properties: { id: e.id, nome: e.nome, tipo: e.tipo }, geometry: { type: "Point", coordinates: [e.lng, e.lat] } })) },
  });
  const tipo = (t: number | string, e: number | string) => ["match", ["get", "tipo"], "terminal", t, e] as ExpressionSpecification;
  map.addLayer({
    id: "estacoes-pt", type: "circle", source: "estacoes",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, tipo(3.2, 1.8), 15, tipo(7, 4.5)] as ExpressionSpecification,
      "circle-color": tipo(token("--map-station", "#000022"), token("--surface", "#FDFDFE")),
      "circle-stroke-color": token("--map-station", "#000022"), "circle-stroke-width": tipo(2, 1.4), "circle-opacity": 0.95,
    },
  });
  map.addLayer({
    id: "estacoes-nome", type: "symbol", source: "estacoes", minzoom: 13,
    layout: { "text-field": ["get", "nome"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
    paint: { "text-color": token("--text-2", "#3E4A5E"), "text-halo-color": token("--bg", "#EEF2F3"), "text-halo-width": 1.3 },
  });
}

export function camadasDiagnostico(map: MLMap) {
  map.addSource("debug", { type: "geojson", data: vazio });
  map.addLayer({ id: "debug-seg", type: "line", source: "debug", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#dc2626", "line-width": 2, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "debug-pt", type: "circle", source: "debug", filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 6, "circle-color": ["match", ["get", "tipo"], "gps", "#dc2626", "#1A9597"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
  map.addLayer({ id: "debug-rot", type: "symbol", source: "debug", filter: ["==", ["geometry-type"], "Point"],
    layout: { "text-field": ["get", "rotulo"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top" },
    paint: { "text-color": "#000022", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
}
