"use client";
import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { criarMapa } from "../map/engine";
import { COR_ESTADO, MAPA, temaAtual } from "../ui/tokens";

/** Mapa operacional: um ponto por veículo (camada única de círculos, atualização incremental via setData). */
export type PontoFrota = [number, number, string, string]; // lng, lat, fonte, estado
export { COR_ESTADO };

export default function MonitorMap({ pontos }: { pontos: PontoFrota[] }) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const pronto = useRef(false);
  const ultimos = useRef(pontos);
  ultimos.current = pontos;

  const geo = (ps: PontoFrota[]) => ({
    type: "FeatureCollection" as const,
    features: ps.map(([lng, lat, fonte, estado]) => ({ type: "Feature" as const, properties: { modo: fonte, estado }, geometry: { type: "Point" as const, coordinates: [lng, lat] } })),
  });

  useEffect(() => {
    let vivo = true;
    let destruir = () => {};
    criarMapa(div.current!, { zoom: 9.6 }).then(({ map, destruir: d }) => {
      destruir = d;
      if (!vivo) { d(); return; }
      mapa.current = map;
      map.on("load", () => {
        map.addSource("frota", { type: "geojson", data: geo(ultimos.current) });
        map.addLayer({
          id: "frota", type: "circle", source: "frota",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "modo"], "BRT", 2.6, 1.6], 14, ["match", ["get", "modo"], "BRT", 6, 4]],
            "circle-color": ["match", ["get", "estado"], "ON_ROUTE", COR_ESTADO.ON_ROUTE, "UNCERTAIN", COR_ESTADO.UNCERTAIN, "OFF_ROUTE", COR_ESTADO.OFF_ROUTE, "STALE", COR_ESTADO.STALE, COR_ESTADO.SEM_TRAJETO],
            "circle-opacity": ["match", ["get", "modo"], "BRT", 0.95, 0.6],
            "circle-stroke-width": ["match", ["get", "modo"], "BRT", 1, 0], "circle-stroke-color": MAPA[temaAtual()].terra,
          },
        });
        pronto.current = true;
      });
    });
    return () => { vivo = false; destruir(); mapa.current = null; };
  }, []);

  useEffect(() => {
    if (!pronto.current) return;
    (mapa.current?.getSource("frota") as GeoJSONSource | undefined)?.setData(geo(pontos));
  }, [pontos]);

  return <div ref={div} className="map-fill" role="region" aria-label={`Mapa operacional com ${pontos.length} veículos`} />;
}
