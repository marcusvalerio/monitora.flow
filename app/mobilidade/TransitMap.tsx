"use client";
import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import estacoesJson from "../../src/data/estacoes-brt.json";
import { deltaAngulo } from "../../src/lib/veiculo";
import { acumulado, encaixar, pontoEm, type Trajeto } from "../../src/lib/trajeto";
import { aguaViva, camera, DUR, duracaoVeiculo, ease } from "../ui/motion";

export interface Ponto { id: string; nome: string; tipo: "estacao" | "terminal" | "parada"; fonte: "brt" | "sppo"; lat: number; lng: number; corredor?: string | null; bairro?: string | null; rua?: string | null }
export interface VeiculoMapa { id: string; fonte: "brt" | "sppo"; linha: string | null; lat: number; lng: number; rumo: number | null; parado: boolean; idadeS: number; rotulo: string; destino?: string | null; estado?: "ON_ROUTE" | "UNCERTAIN" | "OFF_ROUTE" | "STALE" | null; shapeId?: string | null }

const ESTACOES = estacoesJson.estacoes as { id: string; nome: string; tipo: string; lat: number; lng: number }[];
const estiloMapa = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron";
const escuro = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
/** Cores do mapa vêm dos tokens CSS (paleta), não de valores soltos. */
const token = (nome: string, padrao: string) => (getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || padrao);


/** lat/lng = último dado REAL recebido; vis = onde o marcador está desenhado agora (durante a interpolação). */
type ItemVeiculo = { marker: Marker; el: HTMLDivElement; anel: SVGSVGElement; lat: number; lng: number; vis: { lat: number; lng: number; s?: number }; recebidoEm: number;
  angulo: number | null; anim?: number; enc?: { trajeto: number; s: number } | null };
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
    let pararAgua = () => {};
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
          paint: { "line-color": token("--map-route", "#1A9597"), "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 15, 5], "line-opacity": 0.75 } });
        // Camada de estações/terminais do BRT: discreta; terminal um pouco maior.
        map.addSource("estacoes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: ESTACOES.map((e) => ({ type: "Feature", id: e.id, properties: { id: e.id, nome: e.nome, tipo: e.tipo }, geometry: { type: "Point", coordinates: [e.lng, e.lat] } })) },
        });
        const fundo = token("--surface", "#ffffff");
        map.addLayer({
          id: "estacoes-pt", type: "circle", source: "estacoes",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["match", ["get", "tipo"], "terminal", 3.5, 2], 15, ["match", ["get", "tipo"], "terminal", 7, 4.5]],
            "circle-color": ["match", ["get", "tipo"], "terminal", token("--map-station", "#000022"), fundo],
            "circle-stroke-color": token("--map-station", "#000022"), "circle-stroke-width": ["match", ["get", "tipo"], "terminal", 2, 1.5],
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
        pararAgua = aguaViva(map, token("--map-water-tint", "#9fd6d7"));
        desenhar();
      });
      map.on("click", (e) => {
        const alvo = e.originalEvent.target as HTMLElement;
        if (!alvo.closest(".veh") && !map.queryRenderedFeatures(e.point, { layers: ["estacoes-pt"] }).length) ultimos.current.onVeiculo(null);
      });
    });
    return () => { vivo = false; pararAgua(); frota.current.forEach((i) => i.anim && cancelAnimationFrame(i.anim)); mapa.current?.remove(); mapa.current = null; };
  }, []);

  useEffect(() => { desenhar(); });

  useEffect(() => {
    const map = mapa.current; if (!map) return;
    map.easeTo({ padding: { top: 76, right: 16, bottom: pad.bottom + 12, left: pad.left + 16 }, ...camera(DUR.interacao) });
    document.documentElement.style.setProperty("--map-pad-b", `${pad.bottom}px`);
  }, [pad.bottom, pad.left]);

  // Seleção de veículo: a câmera acompanha só se ele estiver fora da área visível (continuidade espacial sem "puxão").
  useEffect(() => {
    const map = mapa.current, it = veiculoSel ? frota.current.get(veiculoSel) : null;
    if (!map || !it) return;
    const p = map.project([it.vis.lng, it.vis.lat]), c = map.getContainer();
    const fora = p.x < 40 || p.y < 90 || p.x > c.clientWidth - 40 || p.y > c.clientHeight - (pad.bottom + 40);
    if (fora) map.easeTo({ center: [it.vis.lng, it.vis.lat], ...camera() });
  }, [veiculoSel]); // eslint-disable-line react-hooks/exhaustive-deps

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
        map.fitBounds(b, { maxZoom: 14, padding: 60, ...camera(700) });
      } else if (e) map.easeTo({ center: [e.lng, e.lat], zoom: 13.5, ...camera() });
      return;
    }
    const perto = vs.map((v) => ({ v, d: Math.hypot(v.lat - p.lat, (v.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180)) }))
      .filter((x) => x.d < 0.2).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!perto.length) { map.easeTo({ center: [p.lng, p.lat], zoom: 15, ...camera() }); return; }
    const b = new m.LngLatBounds([p.lng, p.lat], [p.lng, p.lat]);
    perto.forEach(({ v }) => b.extend([v.lng, v.lat]));
    map.fitBounds(b, { maxZoom: 15.5, padding: 60, ...camera(700) });
  }

  /** Anima até (lat, lng). Se o antes e o depois estão encaixados no mesmo trajeto e o veículo avançou, anda pela via. */
  function encaixarNoShape(v: VeiculoMapa) {
    const t = rota.current.t;
    const i = v.shapeId ? t.findIndex((x) => x.shapeId === v.shapeId) : -1;
    if (i < 0) return null; // shape do veículo não está desenhado (ex.: outro sentido filtrado) → GPS cru
    const e = encaixar(v.lat, v.lng, null, [t[i]]);
    return e ? { ...e, trajeto: i } : null;
  }

  /**
   * Interpola do ponto DESENHADO até o novo dado real, no ritmo do GPS (ver duracaoVeiculo).
   * Pela via só quando antes e depois estão ON_ROUTE no mesmo shape e o veículo avançou; senão, reta curta.
   * Nunca extrapola: termina exatamente no dado recebido.
   */
  function animar(item: ItemVeiculo, lat: number, lng: number, enc: { trajeto: number; s: number } | null) {
    if (item.anim) cancelAnimationFrame(item.anim);
    const agora = performance.now();
    const intervalo = agora - item.recebidoEm;
    const de = { ...item.vis };
    const antesS = item.enc && enc && item.enc.trajeto === enc.trajeto ? (de.s ?? item.enc.s) : null;
    item.lat = lat; item.lng = lng; item.enc = enc; item.recebidoEm = agora;
    const tr = antesS !== null ? rota.current.t[enc!.trajeto] : null;
    const ds = tr ? enc!.s - antesS! : 0;
    const pelaVia = !!tr && ds > 0 && ds < 5000;
    const dist = Math.hypot((lng - de.lng) * 111320 * Math.cos((lat * Math.PI) / 180), (lat - de.lat) * 110540);
    const D = duracaoVeiculo(intervalo, pelaVia ? ds : dist);
    if (!D) { item.vis = { lat, lng, s: enc?.s }; item.marker.setLngLat([lng, lat]); return; }
    const curva = dist > 800 ? ease.out : ease.viagem;
    const passo = (t: number) => {
      const p = Math.min(1, (t - agora) / D), e = curva(p);
      if (pelaVia) { const sv = antesS! + ds * e; const q = pontoEm(tr!.coords, sv, tr!.acc); item.vis = { ...q, s: sv }; }
      else item.vis = { lng: de.lng + (lng - de.lng) * e, lat: de.lat + (lat - de.lat) * e, s: p === 1 ? enc?.s : undefined };
      item.marker.setLngLat([item.vis.lng, item.vis.lat]);
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
      // Só encaixa o que é compatível com o trajeto; UNCERTAIN/OFF_ROUTE ficam na posição GPS real.
      // Só ON_ROUTE é desenhado sobre a via, e só no shape que o servidor validou (shapeId).
      const enc = v0.estado === "ON_ROUTE" ? encaixarNoShape(v0) : null;
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
        it = { marker, el, anel: el.querySelector("svg") as SVGSVGElement, lat: v.lat, lng: v.lng, vis: { lat: v.lat, lng: v.lng, s: enc?.s }, recebidoEm: performance.now(),
          angulo: null, enc: enc ? { trajeto: enc.trajeto, s: enc.s } : null };
        frota.current.set(v.id, it);
      } else if (Math.abs(it.lat - v.lat) > 1e-6 || Math.abs(it.lng - v.lng) > 1e-6) {
        animar(it, v.lat, v.lng, enc ? { trajeto: enc.trajeto, s: enc.s } : null);
      }
      girar(it, v.rumo);
      it.el.className = `veh ${v.fonte}${v.parado ? " parado" : ""}${v.idadeS > 180 || v.estado === "STALE" ? " velho" : ""}${v.estado === "OFF_ROUTE" ? " fora" : v.estado === "UNCERTAIN" ? " incerto" : ""}${v.id === sel ? " sel" : ""}`;
      (it.el.querySelector(".chip-v") as HTMLElement).textContent = v.linha ?? "";
      it.el.setAttribute("aria-label", v.rotulo);
      it.el.style.zIndex = v.id === sel ? "3" : "1";
    }
    for (const [id, it] of frota.current) if (!vistos.has(id)) { if (it.anim) cancelAnimationFrame(it.anim); it.marker.remove(); frota.current.delete(id); }
    enquadrar();
  }

  return <div ref={div} className="map-fill" role="region" aria-label="Mapa de transporte" />;
}
