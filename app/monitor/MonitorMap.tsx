"use client";
import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Mapa operacional: um ponto por veículo (camada única de círculos, atualização incremental via setData). */
export type PontoFrota = [number, number, string, string]; // lng, lat, fonte, estado
export const COR_ESTADO: Record<string, string> = {
  ON_ROUTE: "#16a34a", UNCERTAIN: "#d97706", OFF_ROUTE: "#dc2626", STALE: "#94a3b8", SEM_TRAJETO: "#0247FE",
};

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
    import("maplibre-gl").then((m) => {
      if (!vivo || !div.current) return;
      const escuro = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const map = new m.Map({
        container: div.current, style: escuro ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron",
        center: [-43.42, -22.93], zoom: 9.6, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      });
      map.touchZoomRotate.disableRotation();
      mapa.current = map;
      map.on("load", () => {
        map.addSource("frota", { type: "geojson", data: geo(ultimos.current) });
        map.addLayer({
          id: "frota", type: "circle", source: "frota",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "modo"], "BRT", 2.6, 1.6], 14, ["match", ["get", "modo"], "BRT", 6, 4]],
            "circle-color": ["match", ["get", "estado"], "ON_ROUTE", COR_ESTADO.ON_ROUTE, "UNCERTAIN", COR_ESTADO.UNCERTAIN, "OFF_ROUTE", COR_ESTADO.OFF_ROUTE, "STALE", COR_ESTADO.STALE, COR_ESTADO.SEM_TRAJETO],
            "circle-opacity": ["match", ["get", "modo"], "BRT", 0.95, 0.55],
            "circle-stroke-width": ["match", ["get", "modo"], "BRT", 1, 0], "circle-stroke-color": escuro ? "#0b0d10" : "#ffffff",
          },
        });
        pronto.current = true;
      });
    });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    if (!pronto.current) return;
    (mapa.current?.getSource("frota") as GeoJSONSource | undefined)?.setData(geo(pontos));
  }, [pontos]);

  return <div ref={div} className="map-fill" role="region" aria-label={`Mapa operacional com ${pontos.length} veículos`} />;
}
