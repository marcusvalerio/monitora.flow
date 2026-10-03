/**
 * MapBaseLayer — estilo cartográfico próprio do Monitora (MapLibre, esquema OpenMapTiles).
 * Tiles vetoriais: OpenFreeMap (dados OpenStreetMap, sem chave). Para escala maior: auto-hospedar PMTiles (ver docs/MAPA.md).
 * Hierarquia (de cima para baixo): você · rota selecionada · veículo ativo · estações · vias principais · bairros · vias secundárias · relevo · água.
 * O mapa base é deliberadamente quieto: nada de POI, ícone ou rótulo competindo com veículos.
 */
import type { StyleSpecification, ExpressionSpecification } from "maplibre-gl";

import { MAPA, type Tema } from "../ui/tokens";
export type { Tema };

const z = (pares: number[]): ExpressionSpecification => ["interpolate", ["exponential", 1.5], ["zoom"], ...pares] as ExpressionSpecification;
const classe = (...cs: string[]): ExpressionSpecification => ["match", ["get", "class"], cs, true, false] as ExpressionSpecification;

export function estiloMonitora(tema: Tema): StyleSpecification {
  const c = MAPA[tema];
  const nome: ExpressionSpecification = ["coalesce", ["get", "name:pt"], ["get", "name"]] as ExpressionSpecification;
  return {
    version: 8,
    name: `Monitora ${tema}`,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { base: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: "© OpenStreetMap · OpenFreeMap" } },
    layers: [
      { id: "fundo", type: "background", paint: { "background-color": c.terra } },
      // relevo/verde: muito discreto
      { id: "verde", type: "fill", source: "base", "source-layer": "landcover", filter: classe("wood", "grass", "farmland", "wetland"), paint: { "fill-color": c.verde, "fill-opacity": 0.7 } },
      { id: "parque", type: "fill", source: "base", "source-layer": "park", paint: { "fill-color": c.verde, "fill-opacity": 0.8 } },
      // água: identidade própria (azul-teal), base para a "água viva" (app/ui/motion.ts)
      { id: "water", type: "fill", source: "base", "source-layer": "water", filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "fill-color": c.agua, "fill-antialias": true } },
      // profundidade tonal: a borda interna da água é mais clara (faixa rasa), o meio mais profundo
      { id: "agua-raso", type: "line", source: "base", "source-layer": "water", filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "line-color": c.terra, "line-width": z([8, 1.5, 14, 10]), "line-blur": z([8, 2, 14, 12]), "line-opacity": 0.55 } },
      { id: "agua-curso", type: "line", source: "base", "source-layer": "waterway", minzoom: 11, paint: { "line-color": c.aguaLinha, "line-width": z([11, 0.6, 16, 2]) } },
      { id: "predios", type: "fill", source: "base", "source-layer": "building", minzoom: 15, paint: { "fill-color": c.predio, "fill-opacity": z([15, 0, 16, 0.75]) } },
      // vias: 3 níveis; caminhos e serviço ficam de fora
      { id: "via-menor", type: "line", source: "base", "source-layer": "transportation", minzoom: 13, filter: classe("minor", "tertiary"),
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.viaMenor, "line-width": z([13, 0.6, 18, 9]) } },
      { id: "trilho", type: "line", source: "base", "source-layer": "transportation", minzoom: 11, filter: classe("rail", "transit"),
        paint: { "line-color": c.trilho, "line-width": z([11, 0.6, 16, 1.6]), "line-dasharray": [3, 2] } },
      { id: "via-secundaria", type: "line", source: "base", "source-layer": "transportation", minzoom: 10, filter: classe("secondary", "primary"),
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.viaSecundaria, "line-width": z([10, 0.8, 18, 16]) } },
      { id: "via-principal-borda", type: "line", source: "base", "source-layer": "transportation", minzoom: 8, filter: classe("motorway", "trunk"),
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.viaPrincipalBorda, "line-width": z([8, 1.4, 18, 22]) } },
      { id: "via-principal", type: "line", source: "base", "source-layer": "transportation", minzoom: 8, filter: classe("motorway", "trunk"),
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.viaPrincipal, "line-width": z([8, 0.8, 18, 18]) } },
      // rótulos: água, bairros/regiões, cidades e (só de perto) nomes das grandes vias
      { id: "rotulo-agua", type: "symbol", source: "base", "source-layer": "water_name", minzoom: 9,
        layout: { "text-field": nome, "text-font": ["Noto Sans Italic"], "text-size": 12, "text-letter-spacing": 0.2, "text-max-width": 8 },
        paint: { "text-color": c.aguaRotulo, "text-halo-color": c.agua, "text-halo-width": 1 } },
      { id: "rotulo-via", type: "symbol", source: "base", "source-layer": "transportation_name", minzoom: 14, filter: classe("motorway", "trunk", "primary"),
        layout: { "symbol-placement": "line", "text-field": nome, "text-font": ["Noto Sans Regular"], "text-size": 11, "text-letter-spacing": 0.02 },
        paint: { "text-color": c.rotulo, "text-halo-color": c.halo, "text-halo-width": 1.4 } },
      { id: "rotulo-bairro", type: "symbol", source: "base", "source-layer": "place", minzoom: 11.5, filter: classe("suburb", "neighbourhood", "quarter"),
        layout: { "text-field": ["upcase", nome] as ExpressionSpecification, "text-font": ["Noto Sans Regular"], "text-size": z([11.5, 9.5, 16, 12]), "text-letter-spacing": 0.14, "text-max-width": 7, "text-padding": 8 },
        paint: { "text-color": c.rotulo, "text-halo-color": c.halo, "text-halo-width": 1.4, "text-opacity": z([11.5, 0, 12.2, 0.85]) } },
      { id: "rotulo-cidade", type: "symbol", source: "base", "source-layer": "place", maxzoom: 12.5, filter: classe("city", "town"),
        layout: { "text-field": nome, "text-font": ["Noto Sans Bold"], "text-size": z([8, 11, 12, 14]), "text-letter-spacing": 0.02 },
        paint: { "text-color": c.rotuloForte, "text-halo-color": c.halo, "text-halo-width": 1.6 } },
    ],
  };
}
