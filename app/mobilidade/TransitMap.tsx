"use client";
import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import estacoesJson from "../../src/data/estacoes-brt.json";
import { proximaRotacao } from "../../src/lib/veiculo";
import { acumulado, encaixar, pontoEm, type Trajeto } from "../../src/lib/trajeto";
import { camera, DUR, duracaoVeiculo, ease } from "../ui/motion";
import { criarMapa } from "../map/engine";
import { camadasDiagnostico, camadasEstacoes, camadasRota } from "../map/transporte";

export interface Ponto { id: string; nome: string; tipo: "estacao" | "terminal" | "parada"; fonte: "brt" | "sppo"; lat: number; lng: number; corredor?: string | null; bairro?: string | null; rua?: string | null }
export interface VeiculoMapa { id: string; fonte: "brt" | "sppo"; linha: string | null; lat: number; lng: number; rumo: number | null; parado: boolean; idadeS: number; rotulo: string; destino?: string | null; estado?: "ON_ROUTE" | "UNCERTAIN" | "OFF_ROUTE" | "STALE" | null; shapeId?: string | null }

const ESTACOES = estacoesJson.estacoes as { id: string; nome: string; tipo: string; lat: number; lng: number }[];


/** lat/lng = último dado REAL recebido; vis = onde o marcador está desenhado agora (durante a interpolação). */
type ItemVeiculo = { marker: Marker; el: HTMLDivElement; anel: SVGSVGElement; lat: number; lng: number; vis: { lat: number; lng: number; s?: number }; recebidoEm: number;
  angulo: number | null; anim?: number; enc?: { trajeto: number; s: number } | null };
type TrajetoAcc = Trajeto & { acc: number[] };

/** Diagnóstico (modo debug): GPS real, projeção no shape e o segmento que os liga. */
export interface DebugGeo { gps: [number, number]; proj: [number, number] | null; shapeId: string | null }

export default function TransitMap({ ponto, veiculos, veiculoSel, onVeiculo, onEstacao, eu, pad, enquadrarChave, trajetos, debug }: {
  ponto: Ponto | null; veiculos: VeiculoMapa[]; veiculoSel: string | null; trajetos?: Trajeto[] | null; debug?: DebugGeo | null;
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
  const ultimos = useRef({ ponto, veiculos, veiculoSel, eu, pad, onVeiculo, onEstacao, debug });
  ultimos.current = { ponto, veiculos, veiculoSel, eu, pad, onVeiculo, onEstacao, debug };
  const enquadrado = useRef("");
  // trajeto oficial (GTFS) da linha acompanhada, com comprimentos acumulados para encaixe/animação
  const rota = useRef<{ chave: string; t: TrajetoAcc[] }>({ chave: "", t: [] });
  const chaveRota = trajetos?.map((t) => `${t.destino}${t.coords.length}`).join("|") ?? "";
  if (rota.current.chave !== chaveRota) {
    rota.current = { chave: chaveRota, t: (trajetos ?? []).map((t) => ({ ...t, acc: acumulado(t.coords) })) };
    frota.current.forEach((i) => { i.enc = null; });
  }

  // --- criação do mapa (uma vez) — MapEngine + MapTransportLayer ---
  useEffect(() => {
    let vivo = true;
    let destruir = () => {};
    let pararFluxo = () => {};
    criarMapa(div.current!).then(({ m, map, destruir: d }) => {
      destruir = d;
      if (!vivo) { d(); return; }
      ml.current = m;
      map.addControl(new m.NavigationControl({ showCompass: false }), "bottom-right");
      mapa.current = map;
      map.on("load", () => {
        pararFluxo = camadasRota(map);
        camadasDiagnostico(map);
        camadasEstacoes(map, ESTACOES);
        map.on("click", "estacoes-pt", (e) => { const id = e.features?.[0]?.properties?.id; if (id) ultimos.current.onEstacao(id); });
        map.on("mouseenter", "estacoes-pt", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "estacoes-pt", () => { map.getCanvas().style.cursor = ""; });
        pronto.current = true;
        desenhar();
        sentirAmbiente();
      });
      // Material responde ao ambiente: o que está sob a busca (água, rota ativa, terra) tinge levemente o vidro.
      const sentirAmbiente = () => {
        const alvo = div.current?.closest(".mob") as HTMLElement | null;
        if (!alvo || !map.isStyleLoaded()) return;
        const w = map.getContainer().clientWidth;
        const caixa: [[number, number], [number, number]] = [[16, 20], [w - 16, 70]];
        const sob = map.queryRenderedFeatures(caixa, { layers: ["route-active", "water"].filter((l) => map.getLayer(l)) });
        alvo.dataset.sob = sob.some((f) => f.layer.id === "route-active") ? "rota" : sob.some((f) => f.layer.id === "water") ? "agua" : "terra";
      };
      map.on("moveend", sentirAmbiente);
      map.on("click", (e) => {
        const alvo = e.originalEvent.target as HTMLElement;
        if (!alvo.closest(".veh") && !map.queryRenderedFeatures(e.point, { layers: ["estacoes-pt"] }).length) ultimos.current.onVeiculo(null);
      });
    });
    return () => { vivo = false; pararFluxo(); frota.current.forEach((i) => i.anim && cancelAnimationFrame(i.anim)); destruir(); mapa.current = null; };
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
    const chave = `${enquadrarChave}|${vs.length > 0}|${rota.current.chave}`;
    if (enquadrado.current === chave) return;
    enquadrado.current = chave;
    if (!p) {
      // linha escolhida sem estação: enquadra o TRAJETO oficial (não os veículos, que podem estar fora dele)
      const tr = rota.current.t;
      if (tr.length) {
        const b = new m.LngLatBounds();
        tr.forEach((t) => t.coords.forEach((c) => b.extend(c)));
        map.fitBounds(b, { maxZoom: 13.5, padding: 48, ...camera(700) });
      } else if (vs.length) {
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
  function animar(item: ItemVeiculo, lat: number, lng: number, enc: { trajeto: number; s: number } | null, stale = false) {
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
    const D = duracaoVeiculo(intervalo, pelaVia ? ds : dist, stale);
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
    if (rumo === null) { item.el.dataset.semRumo = ""; return; }
    delete item.el.dataset.semRumo;
    const novo = proximaRotacao(item.angulo, rumo);
    if (novo === item.angulo) return;
    item.anel.style.transition = item.angulo === null ? "none" : "";
    item.angulo = novo;
    item.anel.style.transform = `rotate(${novo}deg)`;
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
      src.setData({ type: "FeatureCollection", features: rota.current.t.map((t) => ({ type: "Feature", properties: { destino: t.destino, shapeId: t.shapeId ?? "" }, geometry: { type: "LineString", coordinates: t.coords } })) });
      (src as unknown as { _k?: string })._k = rota.current.chave;
    }

    // diagnóstico
    const dbg = map.getSource("debug") as GeoJSONSource | undefined;
    const d = ultimos.current.debug;
    if (dbg) {
      dbg.setData({ type: "FeatureCollection", features: !d ? [] : [
        { type: "Feature", properties: { tipo: "gps", rotulo: "GPS real" }, geometry: { type: "Point", coordinates: d.gps } },
        ...(d.proj ? [
          { type: "Feature" as const, properties: { tipo: "proj", rotulo: "projeção no shape" }, geometry: { type: "Point" as const, coordinates: d.proj } },
          { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [d.gps, d.proj] } },
        ] : []),
      ] });
      // realce: shape do veículo selecionado (no modo debug, ou sempre que houver seleção)
      const selV = vs.find((v) => v.id === sel);
      if (map.getLayer("route-highlight")) map.setFilter("route-highlight", ["==", ["get", "shapeId"], d?.shapeId ?? selV?.shapeId ?? "__nenhum__"]);
    }

    // veículos: um marcador por veículo, reaproveitado entre atualizações.
    // Exibição: posição encaixada no trajeto oficial quando o GPS está a até 60 m dele (src/lib/trajeto.ts).
    const vistos = new Set<string>();
    for (const v0 of vs) {
      // Fora do trajeto (> 300 m, ex.: garagem): não desenha no mapa — continua listado no painel.
      // Aparece só no modo debug ou se o usuário selecionou esse veículo na lista.
      if (v0.estado === "OFF_ROUTE" && !ultimos.current.debug && v0.id !== sel) continue;
      // Só encaixa o que é compatível com o trajeto; UNCERTAIN/OFF_ROUTE ficam na posição GPS real.
      // Só ON_ROUTE é desenhado sobre a via, e só no shape que o servidor validou (shapeId).
      const enc = v0.estado === "ON_ROUTE" ? encaixarNoShape(v0) : null;
      const v = enc ? { ...v0, lat: enc.lat, lng: enc.lng } : v0;
      vistos.add(v.id);
      let it = frota.current.get(v.id);
      if (!it) {
        const el = document.createElement("div");
        // Marcador próprio: o corpo (seta) gira inteiro com o rumo real e aponta ao longo da via;
        // o número da linha fica numa etiqueta fixa ao lado, sempre legível.
        el.innerHTML =
          `<svg class="ring" viewBox="0 0 32 32" aria-hidden="true"><circle class="disco" cx="16" cy="16" r="11"/><path class="seta" d="M16 8.5 L21.5 21 L16 18.2 L10.5 21 Z"/><circle class="ponto" cx="16" cy="16" r="3.6"/></svg>` +
          `<span class="rot"></span>`;
        el.tabIndex = 0; el.setAttribute("role", "button");
        el.addEventListener("click", (ev) => { ev.stopPropagation(); ultimos.current.onVeiculo(v.id); });
        el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ultimos.current.onVeiculo(v.id); } });
        const marker = new m.Marker({ element: el }).setLngLat([v.lng, v.lat]).addTo(map);
        it = { marker, el, anel: el.querySelector("svg") as SVGSVGElement, lat: v.lat, lng: v.lng, vis: { lat: v.lat, lng: v.lng, s: enc?.s }, recebidoEm: performance.now(),
          angulo: null, enc: enc ? { trajeto: enc.trajeto, s: enc.s } : null };
        frota.current.set(v.id, it);
      } else if (Math.abs(it.lat - v.lat) > 1e-6 || Math.abs(it.lng - v.lng) > 1e-6) {
        animar(it, v.lat, v.lng, enc ? { trajeto: enc.trajeto, s: enc.s } : null, v.estado === "STALE");
      }
      girar(it, v.rumo);
      it.el.className = `veh ${v.fonte}${v.parado ? " parado" : ""}${v.idadeS > 180 || v.estado === "STALE" ? " velho" : ""}${v.estado === "OFF_ROUTE" ? " fora" : v.estado === "UNCERTAIN" ? " incerto" : ""}${v.id === sel ? " sel" : ""}`;
      (it.el.querySelector(".rot") as HTMLElement).textContent = v.linha ?? "";
      it.el.setAttribute("aria-label", v.rotulo);
      it.el.style.zIndex = v.id === sel ? "3" : "1";
    }
    for (const [id, it] of frota.current) if (!vistos.has(id)) { if (it.anim) cancelAnimationFrame(it.anim); it.marker.remove(); frota.current.delete(id); }
    enquadrar();
  }

  return <div ref={div} className="map-fill" role="region" aria-label="Mapa de transporte" />;
}
