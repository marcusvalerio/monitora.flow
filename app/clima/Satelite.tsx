"use client";
/**
 * Satélite ao vivo: imagens do GOES-East servidas pela NASA GIBS (WMTS, sem chave).
 * - Cartão: o quadro mais recente que existe (o GIBS publica com ~30–60 min de atraso; procuramos de 10 em 10 min).
 * - Tela cheia: animação das últimas 3 h, troca de camada (cor real / infravermelho) e marcação do local.
 * O horário mostrado é o do próprio quadro — nunca "agora" inventado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Maximize2, Pause, Play } from "lucide-react";
import { horaLocal } from "../ui/util";
import { reduzMovimento } from "../ui/motion";

type Camada = "cor" | "ir";
const CAMADAS: Record<Camada, { id: string; matriz: string; z: number; nome: string }> = {
  cor: { id: "GOES-East_ABI_GeoColor", matriz: "GoogleMapsCompatible_Level7", z: 7, nome: "Cor real" },
  ir: { id: "GOES-East_ABI_Band13_Clean_Infrared", matriz: "GoogleMapsCompatible_Level6", z: 6, nome: "Infravermelho" },
};
const PASSO = 10 * 60_000;

const urlTile = (c: Camada, t: string, z: number, x: number, y: number) => {
  const k = CAMADAS[c];
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${k.id}/default/${t}/${k.matriz}/${z}/${y}/${x}.png`;
};
/** Posição (em tiles, fracionária) de lat/lng no zoom z — Web Mercator. */
function tileXY(lat: number, lng: number, z: number) {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}
const isoMin = (ms: number) => new Date(ms).toISOString().slice(0, 16) + ":00Z";
const piso10 = (ms: number) => Math.floor(ms / PASSO) * PASSO;

function carrega(url: string) {
  return new Promise<boolean>((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = url; });
}

/** Procura, do mais novo para o mais velho, o primeiro quadro publicado (até 3 h atrás). */
async function quadroMaisRecente(c: Camada, lat: number, lng: number): Promise<number | null> {
  const z = CAMADAS[c].z, p = tileXY(lat, lng, z);
  let t = piso10(Date.now() - 20 * 60_000);
  for (let k = 0; k < 18; k++, t -= PASSO) if (await carrega(urlTile(c, isoMin(t), z, Math.floor(p.x), Math.floor(p.y)))) return t;
  return null;
}

/** Mosaico de tiles centrado no local. `cols`×`rows` tiles de 256 px; o contêiner recorta. */
function Mosaico({ lat, lng, camada, t, cols, rows, escala = 1, visivel = true }: { lat: number; lng: number; camada: Camada; t: number; cols: number; rows: number; escala?: number; visivel?: boolean }) {
  const z = CAMADAS[camada].z, p = tileXY(lat, lng, z);
  const x0 = Math.floor(p.x) - Math.floor(cols / 2), y0 = Math.floor(p.y) - Math.floor(rows / 2);
  const cx = (p.x - x0) * 256, cy = (p.y - y0) * 256;
  const tiles = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) tiles.push({ i, j, x: x0 + i, y: y0 + j });
  return (
    <div className="sat-mos" style={{ width: cols * 256, height: rows * 256, transform: `translate(-${cx}px, -${cy}px) scale(${escala})`, transformOrigin: `${cx}px ${cy}px`, opacity: visivel ? 1 : 0 }}>
      {tiles.map((k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${k.x}-${k.y}`} alt="" src={urlTile(camada, isoMin(t), z, k.x, k.y)} style={{ left: k.i * 256, top: k.j * 256 }} draggable={false}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
      ))}
    </div>
  );
}

function Mira() {
  return (
    <svg className="sat-mira" viewBox="0 0 80 80" aria-hidden>
      <path d="M8 22V8H22M58 8H72V22M8 58V72H22M58 72H72V58" />
      <circle cx="40" cy="40" r="6" />
    </svg>
  );
}

export default function Satelite({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
  const [t, setT] = useState<number | null | undefined>(undefined);
  const [cheia, setCheia] = useState(false);
  useEffect(() => { let vivo = true; quadroMaisRecente("cor", lat, lng).then((r) => vivo && setT(r)); return () => { vivo = false; }; }, [lat, lng]);
  if (t === null) return null; // GIBS fora do ar: o cartão some (não mostramos imagem velha como atual)
  return (
    <section className="cl-card cl-sat revela" aria-label="Satélite">
      <div className="cl-sat-cab">
        <h2 className="cl-tit">Satélite</h2>
        <span className="cl-sat-hora">{t ? <><i className="sat-vivo" aria-hidden />Imagem das {horaLocal(new Date(t).toISOString())}</> : "Carregando…"}</span>
      </div>
      <button type="button" className="cl-sat-vista" onClick={() => setCheia(true)} aria-label={`Abrir satélite em tela cheia, centrado em ${nome}`}>
        {t ? <div className="sat-centro sat-respira"><Mosaico lat={lat} lng={lng} camada="cor" t={t} cols={3} rows={3} /></div> : <div className="skeleton" style={{ position: "absolute", inset: 0 }} />}
        <Mira />
        <span className="cl-sat-abrir"><Maximize2 aria-hidden /> Tela cheia</span>
      </button>
      <p className="cl-sat-fonte">NASA GIBS · GOES-East · gira o celular para ver maior</p>
      {cheia && <SateliteCheio lat={lat} lng={lng} nome={nome} inicial={t ?? null} onFechar={() => setCheia(false)} />}
    </section>
  );
}

function SateliteCheio({ lat, lng, nome, inicial, onFechar }: { lat: number; lng: number; nome: string; inicial: number | null; onFechar: () => void }) {
  const [camada, setCamada] = useState<Camada>("cor");
  const [ultimo, setUltimo] = useState<number | null>(inicial);
  const [quadros, setQuadros] = useState<number[]>([]);
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [esc, setEsc] = useState(1);

  useEffect(() => {
    setAlvo(document.body);
    const ov = document.body.style.overflow; document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = ov; window.removeEventListener("keydown", tecla); };
  }, [onFechar]);

  // quadro mais recente da camada escolhida; depois, 3 h para trás de 30 em 30 min
  useEffect(() => {
    let vivo = true; setTocando(false);
    (camada === "cor" && inicial ? Promise.resolve(inicial) : quadroMaisRecente(camada, lat, lng)).then((u) => {
      if (!vivo) return;
      setUltimo(u);
      const lista = u ? Array.from({ length: 7 }, (_, k) => u - (6 - k) * 3 * PASSO) : [];
      setQuadros(lista); setI(Math.max(0, lista.length - 1));
    });
    return () => { vivo = false; };
  }, [camada, lat, lng, inicial]);

  // o mosaico cobre a tela inteira (cover), em qualquer orientação
  const medir = useCallback(() => {
    const r = caixa.current?.getBoundingClientRect(); if (!r) return;
    setEsc(Math.max(1, r.width / (4 * 256 - 140), r.height / (3 * 256 - 140)));
  }, []);
  useEffect(() => { medir(); window.addEventListener("resize", medir); return () => window.removeEventListener("resize", medir); }, [medir, alvo]);

  useEffect(() => {
    if (!tocando || quadros.length < 2) return;
    const id = setInterval(() => setI((k) => { if (k >= quadros.length - 1) { setTocando(false); return k; } return k + 1; }), reduzMovimento() ? 900 : 650);
    return () => clearInterval(id);
  }, [tocando, quadros.length]);

  const atual = quadros[i] ?? ultimo;
  const visiveis = useMemo(() => (tocando || i < quadros.length - 1 ? quadros : quadros.slice(-1)), [tocando, i, quadros]);
  if (!alvo) return null;
  return createPortal(
    <div className="satc" role="dialog" aria-modal="true" aria-label={`Satélite sobre ${nome}`}>
      <div className="satc-mapa" ref={caixa}>
        <div className="sat-centro">
          {visiveis.map((q) => <Mosaico key={`${camada}-${q}`} lat={lat} lng={lng} camada={camada} t={q} cols={4} rows={3} escala={esc} visivel={q === atual} />)}
        </div>
        <Mira />
        <span className="satc-local">{nome}</span>
      </div>
      <div className="satc-topo">
        <button type="button" className="satc-btn" onClick={onFechar} aria-label="Fechar satélite"><ChevronLeft aria-hidden /></button>
        <div className="satc-tit"><small>Satélite · GOES-East</small><b className="num">{atual ? horaLocal(new Date(atual).toISOString()) : "—"}</b></div>
        <div className="satc-camadas" role="radiogroup" aria-label="Camada">
          {(Object.keys(CAMADAS) as Camada[]).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={camada === c} onClick={() => setCamada(c)}>{CAMADAS[c].nome}</button>
          ))}
        </div>
      </div>
      <div className="satc-tempo">
        <button type="button" className="satc-play" disabled={quadros.length < 2} onClick={() => { if (!tocando && i >= quadros.length - 1) setI(0); setTocando((x) => !x); }}
          aria-label={tocando ? "Pausar animação" : "Animar as últimas 3 horas"}>{tocando ? <Pause aria-hidden /> : <Play aria-hidden />}</button>
        <div className="satc-trilho">
          <input type="range" min={0} max={Math.max(0, quadros.length - 1)} value={i} onChange={(e) => { setTocando(false); setI(Number(e.target.value)); }}
            aria-label="Horário da imagem" aria-valuetext={atual ? horaLocal(new Date(atual).toISOString()) : undefined} style={{ ["--p" as string]: `${quadros.length > 1 ? (i / (quadros.length - 1)) * 100 : 100}%` }} />
          <div className="satc-marcas" aria-hidden>{quadros.filter((_, k) => k % 2 === 0).map((q) => <span key={q}>{horaLocal(new Date(q).toISOString())}</span>)}</div>
        </div>
      </div>
      <p className="satc-fonte">Imagens: NASA GIBS / NOAA GOES-East · atraso típico de 30–60 min</p>
    </div>, alvo);
}
