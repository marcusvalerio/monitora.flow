"use client";
import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface MarcadorVeiculo { id: string; lat: number; lng: number; rotulo: string; texto: string; brt: boolean; idadeS: number }
export interface MarcadorChuva { id: string; lat: number; lng: number; mm: number | null; nome: string }

const R = 6371.0088;
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Mapa MapLibre com fundo OpenStreetMap via OpenFreeMap (sem chave).
 * Ao trocar de destino (ou quando os veículos chegam pela primeira vez), enquadra o destino e os
 * veículos mais próximos; depois não mexe mais na câmera, para não atrapalhar quem está arrastando o mapa.
 */
const estiloMapa = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "https://tiles.openfreemap.org/styles/dark"
    : "https://tiles.openfreemap.org/styles/positron";

export default function Mapa({ destino, veiculos, chuva, altura, zoom = 14, preencher = false }: { destino: { lat: number; lng: number }; veiculos: MarcadorVeiculo[]; chuva: MarcadorChuva[]; altura?: number; zoom?: number; preencher?: boolean }) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const ml = useRef<typeof import("maplibre-gl") | null>(null);
  const enquadrado = useRef<string>("");
  const ultimos = useRef({ destino, veiculos, chuva });
  ultimos.current = { destino, veiculos, chuva };

  useEffect(() => {
    let vivo = true;
    import("maplibre-gl").then((m) => {
      if (!vivo || !div.current) return;
      ml.current = m;
      mapa.current = new m.Map({
        container: div.current,
        style: estiloMapa(),
        center: [destino.lng, destino.lat], zoom,
        attributionControl: { compact: true },
      });
      mapa.current.addControl(new m.NavigationControl({ showCompass: false }), "bottom-right");
      desenhar();
    });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { desenhar(); }); // redesenha marcadores a cada atualização

  /** Destino + até 3 veículos mais próximos (até 25 km), com margem. */
  function enquadrar(forcar = false) {
    const m = ml.current, map = mapa.current;
    if (!m || !map) return;
    const { destino: d, veiculos: vs } = ultimos.current;
    const chave = `${d.lat},${d.lng}|${vs.length > 0}`;
    if (!forcar && enquadrado.current === chave) return;
    enquadrado.current = chave;
    const perto = vs.map((v) => ({ v, k: km(d, v) })).filter((x) => x.k <= 25).sort((a, b) => a.k - b.k).slice(0, 3);
    if (!perto.length) { map.easeTo({ center: [d.lng, d.lat], zoom }); return; }
    const b = new m.LngLatBounds([d.lng, d.lat], [d.lng, d.lat]);
    for (const { v } of perto) b.extend([v.lng, v.lat]);
    map.fitBounds(b, { padding: { top: 80, bottom: 60, left: 50, right: 50 }, maxZoom: 15, duration: 600 });
  }

  // Marcadores fixos (seu ponto, pluviômetros): recriados só quando mudam.
  const fixos = useRef<{ chave: string; marcas: Marker[] }>({ chave: "", marcas: [] });
  // Veículos: um marcador por veículo, que desliza até a nova posição a cada atualização.
  const frota = useRef(new Map<string, { marker: Marker; el: HTMLDivElement; seta: HTMLSpanElement; lat: number; lng: number; anim?: number }>());

  const el = (html: string, estilo: string, titulo?: string) => {
    const e = document.createElement("div");
    e.innerHTML = html; e.style.cssText = estilo;
    if (titulo) e.setAttribute("aria-label", titulo);
    return e;
  };

  /** Rumo (graus, 0 = norte) de a para b. */
  const rumo = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const r = (x: number) => (x * Math.PI) / 180;
    const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
    const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };

  /** Interpola a posição em DURACAO ms (suave, com desaceleração no fim). */
  function deslizar(item: { marker: Marker; lat: number; lng: number; anim?: number }, lat: number, lng: number) {
    const DURACAO = 2500;
    if (item.anim) cancelAnimationFrame(item.anim);
    const de = { lat: item.lat, lng: item.lng }, t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / DURACAO), e = 1 - (1 - p) ** 3;
      item.marker.setLngLat([de.lng + (lng - de.lng) * e, de.lat + (lat - de.lat) * e]);
      if (p < 1) item.anim = requestAnimationFrame(passo); else item.anim = undefined;
    };
    item.lat = lat; item.lng = lng;
    item.anim = requestAnimationFrame(passo);
  }

  function desenhar() {
    const m = ml.current, map = mapa.current;
    if (!m || !map) return;
    const { destino: d, veiculos: vs, chuva: cs } = ultimos.current;

    const chaveFixos = `${d.lat},${d.lng}|${cs.map((c) => `${c.id}:${c.mm}`).join(",")}`;
    if (fixos.current.chave !== chaveFixos) {
      fixos.current.marcas.forEach((x) => x.remove());
      const marcas: Marker[] = [new m.Marker({ element: el("", "width:18px;height:18px;border-radius:50%;background:#1c64f2;border:3px solid #fff;box-shadow:0 0 0 6px rgba(28,100,242,.25),0 1px 4px #0006", "Seu ponto") }).setLngLat([d.lng, d.lat]).addTo(map)];
      for (const c of cs) {
        marcas.push(new m.Marker({ element: el(`🌧 ${c.mm ?? "–"}`, "font:600 11px system-ui;background:#fff;color:#0b4a8a;border:1px solid #9cc3ee;border-radius:8px;padding:1px 5px") })
          .setLngLat([c.lng, c.lat]).setPopup(new m.Popup({ offset: 12 }).setText(`${c.nome}: ${c.mm ?? "sem dado"} mm na última hora`)).addTo(map));
      }
      fixos.current = { chave: chaveFixos, marcas };
    }

    const vistos = new Set<string>();
    for (const v of vs) {
      vistos.add(v.id);
      const cor = v.brt ? "#e8590c" : "#1c7ed6";
      let item = frota.current.get(v.id);
      if (!item) {
        const e = el(
          `<span class="seta" style="display:inline-block;font-size:10px;line-height:1;transition:transform .6s;visibility:hidden">▲</span>` +
          `<span style="font-size:14px">${v.brt ? "🚍" : "🚌"}</span>${v.texto}`,
          `display:flex;align-items:center;gap:3px;font:700 12px system-ui;color:#fff;background:${cor};` +
          `border:2px solid #fff;border-radius:12px;padding:2px 7px 2px 5px;box-shadow:0 1px 4px #0006;white-space:nowrap;` +
          `cursor:pointer;transition:opacity .4s`, v.rotulo) as HTMLDivElement;
        const marker = new m.Marker({ element: e }).setLngLat([v.lng, v.lat]).setPopup(new m.Popup({ offset: 14 })).addTo(map);
        item = { marker, el: e, seta: e.querySelector(".seta") as HTMLSpanElement, lat: v.lat, lng: v.lng };
        frota.current.set(v.id, item);
      } else if (Math.abs(item.lat - v.lat) > 1e-6 || Math.abs(item.lng - v.lng) > 1e-6) {
        // Seta de direção: rumo entre a posição anterior e a nova (só se andou mais de ~15 m).
        if (km({ lat: item.lat, lng: item.lng }, v) > 0.015) {
          item.seta.style.visibility = "visible";
          item.seta.style.transform = `rotate(${rumo({ lat: item.lat, lng: item.lng }, v)}deg)`;
        }
        deslizar(item, v.lat, v.lng);
      }
      // GPS com mais de 3 min fica semitransparente.
      item.el.style.opacity = v.idadeS > 180 ? "0.55" : "1";
      item.el.setAttribute("aria-label", v.rotulo);
      item.marker.getPopup()?.setText(v.rotulo);
    }
    for (const [id, item] of frota.current) {
      if (!vistos.has(id)) { if (item.anim) cancelAnimationFrame(item.anim); item.marker.remove(); frota.current.delete(id); }
    }
    enquadrar();
  }

  return (
    <div style={{ position: preencher ? "absolute" : "relative", inset: preencher ? 0 : undefined }}>
      <div ref={div} className="mapa" style={preencher ? { height: "100%", borderRadius: 0 } : altura ? { height: altura } : undefined} role="region" aria-label="Mapa" />
      {veiculos.length > 0 && (
        <div className="mapa-acoes">
          <button type="button" className="botao-flutuante" onClick={() => enquadrar(true)}>🚌 Ver ônibus</button>
        </div>
      )}
    </div>
  );
}
