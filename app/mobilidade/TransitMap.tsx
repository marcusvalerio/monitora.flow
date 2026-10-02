"use client";
import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import estacoesJson from "../../src/data/estacoes-brt.json";
import { deltaAngulo } from "../../src/lib/veiculo";
import { acumulado, encaixar, pontoEm, type Trajeto } from "../../src/lib/trajeto";

export interface Ponto { id: string; nome: string; tipo: "estacao" | "terminal" | "parada"; fonte: "brt" | "sppo"; lat: number; lng: number; corredor?: string | null; bairro?: string | null; rua?: string | null }
export interface VeiculoMapa { id: string; fonte: "brt" | "sppo"; linha: string | null; lat: number; lng: number; rumo: number | null; parado: boolean; idadeS: number; rotulo: string; destino?: string | null }

const ESTACOES = estacoesJson.estacoes as { id: string; nome: string; tipo: string; lat: number; lng: number }[];
const estiloMapa = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron";
const escuro = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;


type ItemVeiculo = { marker: Marker; el: HTMLDivElement; anel: SVGSVGElement; lat: number; lng: number; angulo: number | null; anim?: number; enc?: { trajeto: number; s: number } | null };
type TrajetoAcc = Trajeto & { acc: number[] };

export default function TransitMap({ ponto, veiculos, veiculoSel, onVeiculo, onEstacao, eu, pad, enquadrarChave, trajetos }: {
  ponto: Ponto | null; veiculos: VeiculoMapa[]; veiculoSel: string | null; trajetos?: Trajeto[] | null;
  onVeiculo: (id: string | null) => void; onEstacao: (id: string) => void;
  eu: { lat: number; lng: number } | null; pad: { bottom: number; left: number }; enquadrarChave: string;
}) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const ml = useRef<typeof import("maplibre-gl") | null>(null);
  const frota = useRef(new Map<string, ItemVeiculo>());
  const marcaPonto = useRef<Marker | null>(null);
  const marcaEu = useRef<Marker | null>(null);
  const pronto = useRef(false);
  const ultimos = useRef({ ponto, veiculos, veiculoSel, eu, pad, onVeiculo, onEstacao });
  ultimos.current = { ponto, veiculos, veiculoSel, eu, pad, onVeiculo, onEstacao };
  const enquadrado = useRef("");
  // trajeto oficial (GTFS) da linha acompanhada, com comprimentos acumulados para encaixe/animação
  const rota = useRef<{ chave: string; t: TrajetoAcc[] }>({ chave: "", t: [] });
  const chaveRota = trajetos?.map((t) => `${t.destino}${t.coords.length}`).join("|") ?? "";
  if (rota.current.chave !== chaveRota) {
    rota.current = { chave: chaveRota, t: (trajetos ?? []).map((t) => ({ ...t, acc: acumulado(t.coords) })) };
    frota.current.forEach((i) => { i.enc = null; });
  }

  // --- criação do mapa (uma vez) ---
  useEffect(() => {
    let vivo = true;
    import("maplibre-gl").then((m) => {
      if (!vivo || !div.current) return;
      ml.current = m;
      const map = new m.Map({
        container: div.current, style: estiloMapa(), center: [-43.4, -22.93], zoom: 10.3,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new m.NavigationControl({ showCompass: false }), "bottom-right");
      mapa.current = map;
      map.on("load", () => {
        // Trajeto oficial da linha acompanhada (abaixo das estações)
        map.addSource("rota", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "rota-borda", type: "line", source: "rota", layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": escuro() ? "#14171c" : "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 9], "line-opacity": 0.9 } });
        map.addLayer({ id: "rota", type: "line", source: "rota", layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#e8590c", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 15, 5], "line-opacity": 0.75 } });
        // Camada de estações/terminais do BRT: discreta; terminal um pouco maior.
        map.addSource("estacoes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: ESTACOES.map((e) => ({ type: "Feature", id: e.id, properties: { id: e.id, nome: e.nome, tipo: e.tipo }, geometry: { type: "Point", coordinates: [e.lng, e.lat] } })) },
        });
        const fundo = escuro() ? "#14171c" : "#ffffff";
        map.addLayer({
          id: "estacoes-pt", type: "circle", source: "estacoes",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["match", ["get", "tipo"], "terminal", 3.5, 2], 15, ["match", ["get", "tipo"], "terminal", 7, 4.5]],
            "circle-color": ["match", ["get", "tipo"], "terminal", "#e8590c", fundo],
            "circle-stroke-color": "#e8590c", "circle-stroke-width": ["match", ["get", "tipo"], "terminal", 2, 1.5],
            "circle-opacity": 0.95,
          },
        });
        map.addLayer({
          id: "estacoes-nome", type: "symbol", source: "estacoes", minzoom: 13,
          layout: { "text-field": ["get", "nome"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
          paint: { "text-color": escuro() ? "#a4acb8" : "#5b6370", "text-halo-color": fundo, "text-halo-width": 1.2 },
        });
        map.on("click", "estacoes-pt", (e) => { const id = e.features?.[0]?.properties?.id; if (id) ultimos.current.onEstacao(id); });
        map.on("mouseenter", "estacoes-pt", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "estacoes-pt", () => { map.getCanvas().style.cursor = ""; });
        pronto.current = true;
        desenhar();
      });
      map.on("click", (e) => {
        const alvo = e.originalEvent.target as HTMLElement;
        if (!alvo.closest(".veh") && !map.queryRenderedFeatures(e.point, { layers: ["estacoes-pt"] }).length) ultimos.current.onVeiculo(null);
      });
    });
    return () => { vivo = false; frota.current.forEach((i) => i.anim && cancelAnimationFrame(i.anim)); mapa.current?.remove(); mapa.current = null; };
  }, []);

  useEffect(() => { desenhar(); });

  useEffect(() => {
    const map = mapa.current; if (!map) return;
    map.easeTo({ padding: { top: 76, right: 16, bottom: pad.bottom + 12, left: pad.left + 16 }, duration: 300 });
    document.documentElement.style.setProperty("--map-pad-b", `${pad.bottom}px`);
  }, [pad.bottom, pad.left]);

  function enquadrar() {
    const m = ml.current, map = mapa.current;
    if (!m || !map || !pronto.current) return;
    const { ponto: p, veiculos: vs, eu: e } = ultimos.current;
    const chave = `${enquadrarChave}|${vs.length > 0}`;
    if (enquadrado.current === chave) return;
    enquadrado.current = chave;
    if (!p) {
      if (vs.length) {
        const b = new m.LngLatBounds();
        vs.forEach((v) => b.extend([v.lng, v.lat]));
        map.fitBounds(b, { maxZoom: 14, duration: 800, padding: 60 });
      } else if (e) map.easeTo({ center: [e.lng, e.lat], zoom: 13.5, duration: 700 });
      return;
    }
    const perto = vs.map((v) => ({ v, d: Math.hypot(v.lat - p.lat, (v.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180)) }))
      .filter((x) => x.d < 0.2).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!perto.length) { map.easeTo({ center: [p.lng, p.lat], zoom: 15, duration: 700 }); return; }
    const b = new m.LngLatBounds([p.lng, p.lat], [p.lng, p.lat]);
    perto.forEach(({ v }) => b.extend([v.lng, v.lat]));
    map.fitBounds(b, { maxZoom: 15.5, duration: 800, padding: 60 });
  }

  /** Anima até (lat, lng). Se o antes e o depois estão encaixados no mesmo trajeto e o veículo avançou, anda pela via. */
  function animar(item: ItemVeiculo, lat: number, lng: number, enc: { trajeto: number; s: number } | null) {
    if (item.anim) cancelAnimationFrame(item.anim);
    const de = { lat: item.lat, lng: item.lng }, t0 = performance.now(), D = 1600;
    const antes = item.enc;
    item.lat = lat; item.lng = lng; item.enc = enc;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { item.marker.setLngLat([lng, lat]); return; }
    const tr = antes && enc && antes.trajeto === enc.trajeto ? rota.current.t[enc.trajeto] : null;
    const ds = tr ? enc!.s - antes!.s : 0;
    const pelaVia = tr && ds > 0 && ds < 5000;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / D), e = 1 - (1 - p) ** 3;
      if (pelaVia) { const q = pontoEm(tr!.coords, antes!.s + ds * e, tr!.acc); item.marker.setLngLat([q.lng, q.lat]); }
      else item.marker.setLngLat([de.lng + (lng - de.lng) * e, de.lat + (lat - de.lat) * e]);
      item.anim = p < 1 ? requestAnimationFrame(passo) : undefined;
    };
    item.anim = requestAnimationFrame(passo);
  }

  /** Gira o anel pelo menor caminho; ignora tremidas < 4°; sem rumo → anel some (estado neutro). */
  function girar(item: ItemVeiculo, rumo: number | null) {
    if (rumo === null) { item.anel.style.opacity = "0"; return; }
    item.anel.style.opacity = "1";
    if (item.angulo === null) { item.angulo = rumo; item.anel.style.transition = "none"; }
    else {
      const d = deltaAngulo(((item.angulo % 360) + 360) % 360, rumo);
      if (Math.abs(d) < 4) return;
      item.angulo += d; item.anel.style.transition = "";
    }
    item.anel.style.transform = `rotate(${item.angulo}deg)`;
  }

  function desenhar() {
    const m = ml.current, map = mapa.current;
    if (!m || !map) return;
    const { ponto: p, veiculos: vs, veiculoSel: sel, eu: e } = ultimos.current;

    // ponto selecionado
    const chaveP = p ? `${p.id}` : "";
    if ((marcaPonto.current as unknown as { _k?: string })?._k !== chaveP) {
      marcaPonto.current?.remove(); marcaPonto.current = null;
      if (p) {
        const el = document.createElement("div");
        el.className = "st-sel";
        el.innerHTML = `<div class="pin${p.tipo === "parada" ? " parada" : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 6v6M16 6v6M5 12h14M7 18l-2 3M17 18l2 3"/><rect x="5" y="3" width="14" height="15" rx="3"/></svg></div>`;
        el.setAttribute("aria-label", `${p.tipo === "terminal" ? "Terminal" : p.tipo === "estacao" ? "Estação" : "Parada"} ${p.nome}`);
        const mk = new m.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map);
        (mk as unknown as { _k?: string })._k = chaveP;
        marcaPonto.current = mk;
      }
    }
    // minha posição
    if (e) {
      if (!marcaEu.current) { const d = document.createElement("div"); d.className = "me-dot"; d.setAttribute("aria-label", "Você está aqui"); marcaEu.current = new m.Marker({ element: d }).setLngLat([e.lng, e.lat]).addTo(map); }
      else marcaEu.current.setLngLat([e.lng, e.lat]);
    }

    // trajeto da linha
    const src = map.getSource("rota") as GeoJSONSource | undefined;
    if (src && (src as unknown as { _k?: string })._k !== rota.current.chave) {
      src.setData({ type: "FeatureCollection", features: rota.current.t.map((t) => ({ type: "Feature", properties: { destino: t.destino }, geometry: { type: "LineString", coordinates: t.coords } })) });
      (src as unknown as { _k?: string })._k = rota.current.chave;
    }

    // veículos: um marcador por veículo, reaproveitado entre atualizações.
    // Exibição: posição encaixada no trajeto oficial quando o GPS está a até 60 m dele (src/lib/trajeto.ts).
    const vistos = new Set<string>();
    for (const v0 of vs) {
      const enc = v0.fonte === "brt" ? encaixar(v0.lat, v0.lng, v0.destino ?? null, rota.current.t) : null;
      const v = enc ? { ...v0, lat: enc.lat, lng: enc.lng } : v0;
      vistos.add(v.id);
      let it = frota.current.get(v.id);
      if (!it) {
        const el = document.createElement("div");
        el.innerHTML =
          `<svg class="ring" viewBox="0 0 44 44" aria-hidden="true"><path d="M22 1.5 L28 10 Q22 7.6 16 10 Z" fill="${v.fonte === "brt" ? "var(--brt)" : "var(--bus)"}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>` +
          `<div class="chip-v"></div>`;
        el.tabIndex = 0; el.setAttribute("role", "button");
        el.addEventListener("click", (ev) => { ev.stopPropagation(); ultimos.current.onVeiculo(v.id); });
        el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ultimos.current.onVeiculo(v.id); } });
        const marker = new m.Marker({ element: el }).setLngLat([v.lng, v.lat]).addTo(map);
        it = { marker, el, anel: el.querySelector("svg") as SVGSVGElement, lat: v.lat, lng: v.lng, angulo: null, enc: enc ? { trajeto: enc.trajeto, s: enc.s } : null };
        frota.current.set(v.id, it);
      } else if (Math.abs(it.lat - v.lat) > 1e-6 || Math.abs(it.lng - v.lng) > 1e-6) {
        animar(it, v.lat, v.lng, enc ? { trajeto: enc.trajeto, s: enc.s } : null);
      }
      girar(it, v.rumo);
      it.el.className = `veh ${v.fonte}${v.parado ? " parado" : ""}${v.idadeS > 180 ? " velho" : ""}${v.id === sel ? " sel" : ""}`;
      (it.el.querySelector(".chip-v") as HTMLElement).textContent = v.linha ?? "";
      it.el.setAttribute("aria-label", v.rotulo);
      it.el.style.zIndex = v.id === sel ? "3" : "1";
    }
    for (const [id, it] of frota.current) if (!vistos.has(id)) { if (it.anim) cancelAnimationFrame(it.anim); it.marker.remove(); frota.current.delete(id); }
    enquadrar();
  }

  return <div ref={div} className="map-fill" role="region" aria-label="Mapa de transporte" />;
}
