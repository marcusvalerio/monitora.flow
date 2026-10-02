"use client";
import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MarcadorVeiculo { id: string; lat: number; lng: number; rotulo: string }
export interface MarcadorChuva { id: string; lat: number; lng: number; mm: number | null; nome: string }

/** Mapa MapLibre com fundo OpenStreetMap via OpenFreeMap (sem chave). */
export default function Mapa({ destino, veiculos, chuva, altura, zoom = 14 }: { destino: { lat: number; lng: number }; veiculos: MarcadorVeiculo[]; chuva: MarcadorChuva[]; altura?: number; zoom?: number }) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const marcas = useRef<Marker[]>([]);
  const ml = useRef<typeof import("maplibre-gl") | null>(null);

  useEffect(() => {
    let vivo = true;
    import("maplibre-gl").then((m) => {
      if (!vivo || !div.current) return;
      ml.current = m;
      mapa.current = new m.Map({
        container: div.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [destino.lng, destino.lat], zoom,
        attributionControl: { compact: true },
      });
      mapa.current.addControl(new m.NavigationControl({ showCompass: false }), "top-right");
      desenhar();
    });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { mapa.current?.easeTo({ center: [destino.lng, destino.lat] }); }, [destino.lat, destino.lng]);
  useEffect(() => { desenhar(); }); // redesenha marcadores a cada atualização

  function desenhar() {
    const m = ml.current, map = mapa.current;
    if (!m || !map) return;
    marcas.current.forEach((x) => x.remove());
    const el = (html: string, estilo: string) => { const d = document.createElement("div"); d.innerHTML = html; d.style.cssText = estilo; return d; };
    const novas: Marker[] = [new m.Marker({ color: "#0b6bcb" }).setLngLat([destino.lng, destino.lat]).addTo(map)];
    for (const c of chuva) {
      novas.push(new m.Marker({ element: el(`🌧 ${c.mm ?? "–"}`, "font:600 11px system-ui;background:#fff;color:#0b4a8a;border:1px solid #9cc3ee;border-radius:8px;padding:1px 5px") })
        .setLngLat([c.lng, c.lat]).setPopup(new m.Popup({ offset: 12 }).setText(`${c.nome}: ${c.mm ?? "sem dado"} mm na última hora`)).addTo(map));
    }
    for (const v of veiculos) {
      novas.push(new m.Marker({ element: el("🚌", "font-size:20px;filter:drop-shadow(0 1px 1px #0006)") })
        .setLngLat([v.lng, v.lat]).setPopup(new m.Popup({ offset: 12 }).setText(v.rotulo)).addTo(map));
    }
    marcas.current = novas;
  }

  return <div ref={div} className="mapa" style={altura ? { height: altura } : undefined} role="region" aria-label="Mapa" />;
}
