"use client";
/**
 * Tela do Clima. Regras de dado: só o que veio da previsão; campo ausente some.
 * Ordem: céu da hora (atmosfera animada) → melhor hora para sair → próximas horas → chuva 2 h + céu do dia →
 * 7 dias → detalhes → sol e lua → satélite (NASA GIBS) → chuva medida (Alerta Rio) → fontes.
 * Em paisagem/desktop o céu vira uma coluna fixa à esquerda e o resto rola à direita (clima3.css).
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Clock, CloudSun, Droplets, Gauge, Leaf, Navigation, Sun, Thermometer, Umbrella, Wind } from "lucide-react";
import { ErrorState, IconeTempo, LastUpdated, Skel } from "../ui/estados";
import { tomDoCeu } from "./TempoView";
import WeatherAtmosphere, { atmosferaDe } from "./atmosfera/WeatherAtmosphere";
import Satelite from "./Satelite";
import type { Local } from "./ClimaApp";
import { J, coord, dec, diaSemana, distKm, fmtDist, get, gravarCache, horaLocal, lerCache } from "../ui/util";
import { reduzMovimento } from "../ui/motion";

const hh = (iso: string) => horaLocal(iso);
const h2 = (iso: string) => horaLocal(iso).slice(0, 2) + "h";
const r0 = (v: number) => Math.round(v);

export default function TempoNovo({ local, onTrocar }: { local: Local; onTrocar: () => void }) {
  const [d, setD] = useState<J | null>(null);
  const [em, setEm] = useState<number | null>(null);
  const [chuva, setChuva] = useState<J | null>(null);
  const chave = `monitora:clima:cache2:${coord(local.lat)},${coord(local.lng)}`;

  // Atualização em segundo plano: mantém o que já está na tela; se a rede falhar, segue com a previsão anterior.
  const carregar = useCallback(async () => {
    const [r, ch] = await Promise.all([get(`/tempo/completo?lat=${coord(local.lat)}&lng=${coord(local.lng)}`), get(`/chuva?lat=${local.lat}&lng=${local.lng}&k=1`)]);
    if (!r.erro) { gravarCache(chave, r); setEm(Date.now()); }
    setD((ant) => (r.erro && ant && !ant.erro ? ant : r));
    setChuva((ant) => (ch.erro && ant ? ant : ch));
  }, [local, chave]);

  useEffect(() => {
    const c = lerCache(chave, 3 * 3600_000); // abre na hora com a última previsão deste local
    setD(c?.dado ?? null); setEm(c?.em ?? null); setChuva(null);
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 10 * 60_000);
    return () => clearInterval(t);
  }, [chave, carregar]);

  const raiz = useRevela([d, chuva]);

  if (!d) return (
    <div className="cl" aria-busy="true">
      <section className="cl-ceu on-neutral"><div className="cl-ceu-c"><Skel h={22} w={140} /><Skel h={120} w={180} r={20} /></div></section>
      <div className="cl-corpo"><Skel h={96} r={24} /><Skel h={190} r={24} /><Skel h={300} r={24} /></div>
    </div>
  );
  if (d.erro) return <div className="cl-erro"><ErrorState texto="Não foi possível atualizar o clima agora." tentar={carregar} /></div>;

  const c = d.calculado;
  const a = c.agora ?? {};
  const hoje = c.dias?.[0];
  const horas: J[] = c.horas ?? [];
  const tipo = atmosferaDe(a.descricao?.icone, a.dia);
  const est = chuva?.observado?.[0];
  const estPerto = est && distKm(local, est) <= 15 ? est : null;

  return (
    <div className="cl" ref={raiz}>
      <Ceu local={local} onTrocar={onTrocar} a={a} hoje={hoje} c={c} tipo={tipo} horas={horas} />
      <div className="cl-corpo">
        <MelhorHora c={c} horas={horas} />
        {horas.length > 1 && <Horas horas={horas.slice(0, 24)} />}
        <div className="cl-par">
          <ChuvaCurta ch={c.chuva2h} />
          {horas.length >= 12 && <CeuDoDia horas={horas.slice(0, 24)} />}
        </div>
        <Avisos c={c} />
        {c.dias?.length > 0 && <Semana dias={c.dias} agoraC={a.temperaturaC} />}
        <Detalhes a={a} ar={c.ar} hoje={hoje} />
        {hoje?.nascerSol && hoje?.porSol && <SolLua hoje={hoje} amanha={c.dias?.[1]} />}
        <Satelite lat={local.lat} lng={local.lng} nome={local.nome} />
        {estPerto && (
          <section className="cl-card revela" aria-label="Chuva medida agora">
            <h2 className="cl-tit">Chuva medida agora</h2>
            <p className="cl-medida"><b className="num">{estPerto.mm.h01 == null ? "—" : dec(estPerto.mm.h01)}</b> mm na última hora</p>
            <p className="cl-nota">{estPerto.mm.m15 != null && `${dec(estPerto.mm.m15)} mm em 15 min · `}Pluviômetro {estPerto.nome}, a {fmtDist(estPerto.distanciaM / 1000)} · Alerta Rio</p>
          </section>
        )}
        <p className="cl-fonte">
          <LastUpdated em={em} fonte="Open-Meteo" velhoS={1800} /><br />
          Previsão de modelo numérico e qualidade do ar (Open-Meteo, CC BY 4.0). Satélite: NASA GIBS / NOAA. Chuva medida: Alerta Rio. <Link href="/mais">Sobre os dados</Link>
        </p>
      </div>
    </div>
  );
}

/* ---------- revela os blocos ao entrar na tela (uma vez) ---------- */
function useRevela(dep: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raiz = ref.current; if (!raiz) return;
    const els = Array.from(raiz.querySelectorAll<HTMLElement>(".revela:not(.visto)"));
    if (reduzMovimento() || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("visto")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dep);
  return ref;
}

/* ---------- número que conta até o valor (só na primeira vez) ---------- */
function Conta({ valor }: { valor: number }) {
  const [v, setV] = useState(valor);
  const ja = useRef(false);
  useEffect(() => {
    if (ja.current || reduzMovimento()) { setV(valor); return; }
    ja.current = true;
    const ini = performance.now(), de = valor - Math.min(8, Math.abs(valor)) * Math.sign(valor || 1);
    let raf = 0;
    const passo = (t: number) => { const k = Math.min(1, (t - ini) / 900), e = 1 - Math.pow(1 - k, 4); setV(Math.round(de + (valor - de) * e)); if (k < 1) raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{v}</>;
}

/* ---------- 1. céu da hora ---------- */
function frase(c: J, horas: J[]): string {
  const r = c.chuva2h?.resumo;
  if (r?.chovendo) return r.mudaEm ? `Chovendo agora; deve parar por volta das ${hh(r.mudaEm)}.` : "Chuva deve continuar nas próximas 2 horas.";
  if (r?.mudaEm) return `Chuva deve começar por volta das ${hh(r.mudaEm)}.`;
  const prox = horas.slice(0, 12), desc = prox[0]?.descricao?.texto;
  const muda = prox.findIndex((x) => x.descricao?.texto && x.descricao.texto !== desc);
  const pMax = Math.max(0, ...prox.map((x) => x.probabilidadeChuvaPct ?? 0));
  if (desc && muda > 0) return `${desc} até as ${h2(prox[muda].inicio)}, depois ${String(prox[muda].descricao.texto).toLowerCase()}.${pMax >= 30 ? ` Chuva chega a ${pMax}%.` : ""}`;
  return pMax >= 30 ? `Chance de chuva chega a ${pMax}% nas próximas horas.` : "Sem chuva prevista nas próximas horas.";
}

function Ceu({ local, onTrocar, a, hoje, c, tipo, horas }: { local: Local; onTrocar: () => void; a: J; hoje: J | undefined; c: J; tipo: string; horas: J[] }) {
  const [agora, setAgora] = useState<string>("");
  useEffect(() => {
    const f = () => setAgora(new Date().toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(".", "").replace(",", " ·"));
    f(); const i = setInterval(f, 30_000); return () => clearInterval(i);
  }, []);
  const dif = c.comparacao?.difC;
  return (
    <section className={`cl-ceu on-${tipo}`} aria-label={`Agora em ${local.nome}`}>
      <WeatherAtmosphere tipo={tipo as never} />
      <div className="cl-ceu-c">
        <div className="cl-ceu-topo">
          <button type="button" className="cl-local" onClick={onTrocar} aria-label={`Local: ${local.nome}. Trocar local`}>
            {local.gps && <Navigation aria-hidden />}<span>{local.nome}</span><ChevronDown aria-hidden />
          </button>
          <span className="cl-agora">{agora}</span>
        </div>
        <div className="cl-temp num" aria-label={a.temperaturaC == null ? "Temperatura indisponível" : `${r0(a.temperaturaC)} graus`}>
          {a.temperaturaC == null ? "—" : <Conta valor={r0(a.temperaturaC)} />}<span className="cl-grau">°</span>
        </div>
        <div className="cl-cond"><IconeTempo icone={a.descricao?.icone} dia={a.dia} size={22} />{a.descricao?.texto ?? "—"}</div>
        <p className="cl-frase">{frase(c, horas)}</p>
        <div className="cl-chips">
          {a.sensacaoC != null && <span>Sensação <b className="num">{r0(a.sensacaoC)}°</b></span>}
          {hoje?.maxC != null && hoje?.minC != null && <span>↑ <b className="num">{r0(hoje.maxC)}°</b>  ↓ <b className="num">{r0(hoje.minC)}°</b></span>}
          {dif != null && <span>{Math.abs(dif) < 1 ? "Parecido com ontem" : `${r0(Math.abs(dif))}° ${dif > 0 ? "mais quente" : "mais fresco"} que ontem`}</span>}
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. melhor hora para sair (liga o clima ao trajeto) ---------- */
function MelhorHora({ c, horas }: { c: J; horas: J[] }) {
  const risco = horas.slice(0, 12).some((h) => (h.probabilidadeChuvaPct ?? 0) >= 40);
  const j = c.melhorJanela;
  const amanha = !!j && new Date(j.inicio).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) !== new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const valor = risco && j ? `${amanha ? "Amanhã, " : ""}${hh(j.inicio)}` : "Agora";
  const nota = risco && j ? `${j.pct}% de chance de chuva nas 2 h seguintes` : "Sem chuva relevante nas próximas horas";
  return (
    <Link href="/mobilidade" className="cl-sair revela" aria-label={`Melhor hora para sair: ${valor}. ${nota}. Ver trajeto.`}>
      <span className="cl-sair-ico" aria-hidden><Clock /></span>
      <span className="cl-sair-t">
        <small>Melhor hora para sair</small>
        <b className="num">{valor}</b>
        <span>{nota}</span>
      </span>
      <span className="cl-sair-ir">Trajeto <ArrowRight aria-hidden /></span>
    </Link>
  );
}

/* ---------- 3. próximas horas: curva de temperatura + ícones + chuva ---------- */
function Horas({ horas }: { horas: J[] }) {
  const [foco, setFoco] = useState(0);
  const W = 58, H = 74, top = 22;
  const ts = horas.map((h) => h.temperaturaC).filter((v): v is number => v != null);
  const tMin = Math.min(...ts), tMax = Math.max(...ts);
  const y = (v: number) => top + (1 - (v - tMin) / Math.max(1, tMax - tMin)) * (H - top - 8);
  const pts = horas.map((h, i) => ({ x: i * W + W / 2, y: h.temperaturaC == null ? null : y(h.temperaturaC) })).filter((p): p is { x: number; y: number } => p.y != null);
  const linha = pts.map((p, i) => i === 0 ? `M${p.x} ${p.y.toFixed(1)}` : `C${(pts[i - 1].x + W / 2).toFixed(1)} ${pts[i - 1].y.toFixed(1)} ${(p.x - W / 2).toFixed(1)} ${p.y.toFixed(1)} ${p.x} ${p.y.toFixed(1)}`).join(" ");
  const area = pts.length ? `${linha} L${pts[pts.length - 1].x} ${H} L${pts[0].x} ${H} Z` : "";
  const f = horas[foco];
  return (
    <section className="cl-card cl-horas revela" aria-label="Próximas horas">
      <div className="cl-cab">
        <h2 className="cl-tit">Próximas horas</h2>
        <span className="cl-foco">{foco === 0 ? "Agora" : h2(f.inicio)}{f.probabilidadeChuvaPct != null && ` · chuva ${f.probabilidadeChuvaPct}%`}{(f.precipitacaoMm ?? 0) > 0 && ` (${dec(f.precipitacaoMm)} mm)`}{f.rajadaKmh != null && ` · rajada ${r0(f.rajadaKmh)} km/h`}</span>
      </div>
      <div className="cl-horas-rolo">
        <div className="cl-horas-faixa" style={{ width: horas.length * W }}>
          <svg width={horas.length * W} height={H} aria-hidden className="cl-curva">
            <defs><linearGradient id="clArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".22" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
            <path d={area} fill="url(#clArea)" className="cl-curva-area" />
            <path d={linha} pathLength={1} className="cl-curva-linha" />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === foco ? 5 : 3} className={i === foco ? "foco" : ""} />)}
            {horas.map((h, i) => h.temperaturaC != null && <text key={h.inicio} x={i * W + W / 2} y={y(h.temperaturaC) - 10} textAnchor="middle" className={i === foco ? "foco" : ""}>{r0(h.temperaturaC)}°</text>)}
          </svg>
          <div className="cl-horas-cols">
            {horas.map((h, i) => {
              const p = h.probabilidadeChuvaPct ?? 0;
              return (
                <button key={h.inicio} type="button" className={i === foco ? "foco" : ""} onClick={() => setFoco(i)} aria-pressed={i === foco}
                  aria-label={`${i === 0 ? "Agora" : h2(h.inicio)}: ${h.temperaturaC == null ? "sem temperatura" : r0(h.temperaturaC) + " graus"}, ${h.descricao?.texto ?? ""}, chuva ${p}%`}>
                  <IconeTempo icone={h.descricao?.icone} dia={h.dia} size={22} />
                  <span className={`cl-p${p >= 30 ? " alto" : ""}`}>{p >= 10 ? `${p}%` : ""}</span>
                  <span className="cl-h">{i === 0 ? "Agora" : h2(h.inicio)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4a. chuva nas próximas 2 h (passos de 15 min) ---------- */
function ChuvaCurta({ ch }: { ch: J }) {
  const r = ch?.resumo, passos: J[] = ch?.passos ?? [];
  if (!r || !passos.length) return null;
  const total = passos.reduce((s, p) => s + (p.mm ?? 0), 0);
  const max = Math.max(1, ...passos.map((p) => p.mm ?? 0));
  const molhado = r.chovendo || r.mudaEm;
  return (
    <section className={`cl-card cl-chuva revela${molhado ? " molhado" : ""}`} aria-label="Chuva nas próximas 2 horas">
      <h2 className="cl-tit"><Umbrella aria-hidden /> Chuva · 2 h</h2>
      <div className="cl-chuva-num"><b className="num">{total > 0 ? dec(total) : "0"}</b> mm</div>
      <div className="cl-chuva-b" aria-hidden>
        {passos.map((p, i) => (
          <span key={p.inicio} style={{ ["--i" as string]: i }}>
            <i style={{ height: `${Math.max(4, ((p.mm ?? 0) / max) * 100)}%`, opacity: (p.mm ?? 0) >= 0.1 ? 1 : 0.25 }} />
          </span>
        ))}
      </div>
      <div className="cl-chuva-eixo" aria-hidden><span>agora</span><span>{hh(passos[Math.floor(passos.length / 2)].inicio)}</span><span>{hh(passos[passos.length - 1].inicio)}</span></div>
    </section>
  );
}

/* ---------- 4b. céu do dia: anel de 24 h com o tom do céu e a chuva por fora ---------- */
function CeuDoDia({ horas }: { horas: J[] }) {
  const n = horas.length, C = 70, R1 = 44, R2 = 60;
  const arco = (i: number, r1: number, r2: number, gap = 0.012) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 + gap, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2 - gap;
    const p = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)},${(C + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(r2, a0)} A${r2},${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1},${r1} 0 0 0 ${p(r1, a0)} Z`;
  };
  const muda = horas.findIndex((x) => x.descricao?.texto !== horas[0].descricao?.texto);
  return (
    <section className="cl-card cl-ceudia revela" aria-label="Céu nas próximas 24 horas">
      <h2 className="cl-tit"><CloudSun aria-hidden /> Céu do dia</h2>
      <svg viewBox="0 0 140 140" className="cl-anel" role="img" aria-label={`Agora ${horas[0].descricao?.texto ?? ""}${muda > 0 ? `; muda às ${h2(horas[muda].inicio)} para ${horas[muda].descricao?.texto ?? ""}` : ""}`}>
        {horas.map((h, i) => (
          <g key={h.inicio} style={{ ["--i" as string]: i }} className="cl-gomo">
            <path d={arco(i, R1, R2)} fill={tomDoCeu(h.descricao?.icone, h.dia)} />
            {(h.probabilidadeChuvaPct ?? 0) > 0 && <path d={arco(i, R2 + 3, R2 + 3 + ((h.probabilidadeChuvaPct ?? 0) / 100) * 8, 0.05)} className="cl-gomo-chuva" />}
          </g>
        ))}
        <line x1={C} y1={C - R2 - 12} x2={C} y2={C - R1 + 4} className="cl-anel-ponteiro" transform={`rotate(${(0.5 / n) * 360} ${C} ${C})`} />
        <text x={C} y={C - 2} textAnchor="middle" className="cl-anel-h">{h2(horas[0].inicio)}</text>
        <text x={C} y={C + 13} textAnchor="middle" className="cl-anel-s">agora</text>
      </svg>
      <p className="cl-nota">{muda > 0 ? `Muda às ${h2(horas[muda].inicio)}: ${String(horas[muda].descricao?.texto ?? "").toLowerCase()}` : "Céu parecido nas próximas 24 h"}</p>
    </section>
  );
}

/* ---------- avisos derivados só da previsão (Coral: só alerta) ---------- */
function Avisos({ c }: { c: J }) {
  const hoje = c.dias?.[0] ?? {};
  const prox12: J[] = (c.horas ?? []).slice(0, 12);
  const sensMax = Math.max(-99, ...prox12.map((h) => h.sensacaoC ?? -99));
  const avisos: { ico: React.ReactNode; t: string }[] = [];
  if ((hoje.uvMax ?? 0) >= 8) avisos.push({ ico: <Sun aria-hidden />, t: `UV ${r0(hoje.uvMax)} hoje (${hoje.uvMax >= 11 ? "extremo" : "muito alto"}): protetor e sombra entre 10h e 16h.` });
  if ((hoje.rajadaMaxKmh ?? 0) >= 50) avisos.push({ ico: <Wind aria-hidden />, t: `Rajadas de até ${r0(hoje.rajadaMaxKmh)} km/h previstas hoje.` });
  if (sensMax >= 35) avisos.push({ ico: <Thermometer aria-hidden />, t: `Sensação de até ${r0(sensMax)}° nas próximas 12 h. Hidrate-se.` });
  if ((hoje.chuvaMm ?? 0) >= 10) avisos.push({ ico: <Droplets aria-hidden />, t: `Até ${r0(hoje.chuvaMm)} mm de chuva previstos hoje.` });
  if (!avisos.length) return null;
  return <ul className="cl-avisos revela" aria-label="Avisos">{avisos.map((x) => <li key={x.t}>{x.ico}<span>{x.t}</span></li>)}</ul>;
}

/* ---------- 5. semana: cada dia abre com os detalhes ---------- */
function Semana({ dias, agoraC }: { dias: J[]; agoraC: number | null }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const mins = dias.map((d) => d.minC).filter((v): v is number => v != null), maxs = dias.map((d) => d.maxC).filter((v): v is number => v != null);
  const min = Math.min(...mins), max = Math.max(...maxs);
  const pos = (v: number) => ((v - min) / Math.max(1, max - min)) * 100;
  return (
    <section className="cl-card cl-semana revela" aria-label="Próximos dias">
      <h2 className="cl-tit">Próximos {dias.length} dias</h2>
      <ul>
        {dias.map((d, i) => {
          const ok = d.minC != null && d.maxC != null, ab = aberto === d.data;
          return (
            <li key={d.data} style={{ ["--i" as string]: i }}>
              <button type="button" aria-expanded={ab} onClick={() => setAberto(ab ? null : d.data)}>
                <span className="cl-d">{i === 0 ? "Hoje" : diaSemana(d.data)}</span>
                <IconeTempo icone={d.descricao?.icone} size={20} />
                <span className="cl-p alto">{(d.probabilidadeChuvaPct ?? 0) >= 20 ? `${d.probabilidadeChuvaPct}%` : ""}</span>
                <span className="cl-min num">{ok ? `${r0(d.minC)}°` : "—"}</span>
                <span className="cl-regua" aria-hidden>
                  {ok && <i style={{ left: `${pos(d.minC)}%`, width: `${Math.max(4, pos(d.maxC) - pos(d.minC))}%` }} />}
                  {i === 0 && agoraC != null && ok && <em style={{ left: `${Math.min(100, Math.max(0, pos(agoraC)))}%` }} />}
                </span>
                <span className="cl-max num">{ok ? `${r0(d.maxC)}°` : "—"}</span>
                <ChevronDown aria-hidden className="cl-chev" />
              </button>
              <div className="cl-det-wrap" data-aberto={ab}>
                <dl className="cl-det">
                  <div><dt>Condição</dt><dd>{d.descricao?.texto ?? "—"}</dd></div>
                  <div><dt>Chuva</dt><dd>{d.chuvaMm == null ? "—" : `${dec(d.chuvaMm)} mm`}{d.probabilidadeChuvaPct != null && ` · ${d.probabilidadeChuvaPct}%`}</dd></div>
                  <div><dt>UV máximo</dt><dd>{d.uvMax == null ? "—" : r0(d.uvMax)}</dd></div>
                  <div><dt>Rajada máx.</dt><dd>{d.rajadaMaxKmh == null ? "—" : `${r0(d.rajadaMaxKmh)} km/h`}</dd></div>
                  {d.nascerSol && d.porSol && <div><dt>Sol</dt><dd>{hh(d.nascerSol)} – {hh(d.porSol)}</dd></div>}
                </dl>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- 6. detalhes ---------- */
const PONTOS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
function Detalhes({ a, ar, hoje }: { a: J; ar: J | null; hoje: J | undefined }) {
  const itens = [
    a.sensacaoC != null && { ico: <Thermometer aria-hidden />, r: "Sensação", v: `${r0(a.sensacaoC)}°`, n: a.temperaturaC != null ? (Math.abs(a.sensacaoC - a.temperaturaC) < 1.5 ? "Parecida com a real" : a.sensacaoC > a.temperaturaC ? "Mais quente que a real" : "Mais fria que a real") : null, p: Math.min(100, Math.max(0, ((a.sensacaoC - 10) / 30) * 100)) },
    a.uv != null && { ico: <Sun aria-hidden />, r: "Índice UV", v: `${r0(a.uv)}`, u: a.uvNivel, n: hoje?.uvMax != null ? `Máximo hoje: ${r0(hoje.uvMax)}` : null, p: Math.min(100, (a.uv / 11) * 100) },
    a.ventoKmh != null && { ico: <Wind aria-hidden />, r: "Vento", v: `${r0(a.ventoKmh)}`, u: `km/h${a.ventoDirecao != null ? ` ${PONTOS[Math.round(a.ventoDirecao / 45) % 8]}` : ""}`, n: a.rajadaKmh != null ? `Rajadas de ${r0(a.rajadaKmh)} km/h` : null, dir: a.ventoDirecao },
    a.umidadePct != null && { ico: <Droplets aria-hidden />, r: "Umidade", v: `${a.umidadePct}%`, n: a.umidadePct >= 80 ? "Ar bem úmido" : a.umidadePct <= 30 ? "Ar seco — beba água" : "Confortável", p: a.umidadePct },
    ar && { ico: <Leaf aria-hidden />, r: "Qualidade do ar", v: `${r0(ar.usAqi)}`, n: `${ar.nivel}${ar.pm25 != null ? ` · PM2,5 ${r0(ar.pm25)}` : ""}`, p: Math.min(100, (ar.usAqi / 200) * 100) },
    a.pressaoHpa != null && { ico: <Gauge aria-hidden />, r: "Pressão", v: `${r0(a.pressaoHpa)}`, u: "hPa", n: null, p: Math.min(100, Math.max(0, ((a.pressaoHpa - 990) / 40) * 100)) },
    a.nuvensPct != null && { ico: <CloudSun aria-hidden />, r: "Nuvens", v: `${a.nuvensPct}%`, n: a.nuvensPct >= 85 ? "Céu encoberto" : a.nuvensPct <= 20 ? "Céu aberto" : "Parcialmente nublado", p: a.nuvensPct },
    a.precipitacaoMm != null && { ico: <Umbrella aria-hidden />, r: "Chuva hoje", v: hoje?.chuvaMm != null ? dec(hoje.chuvaMm) : dec(a.precipitacaoMm), u: "mm", n: hoje?.probabilidadeChuvaPct != null ? `Chance de ${hoje.probabilidadeChuvaPct}%` : null, p: Math.min(100, ((hoje?.chuvaMm ?? 0) / 30) * 100) },
  ].filter(Boolean) as { ico: React.ReactNode; r: string; v: string; u?: string | null; n: string | null; p?: number; dir?: number }[];
  return (
    <section className="cl-detalhes revela" aria-label="Detalhes de agora">
      {itens.map((x, i) => (
        <div key={x.r} className="cl-tile" style={{ ["--i" as string]: i }}>
          <span className="cl-tile-r">{x.ico}{x.r}</span>
          <span className="cl-tile-v"><b className="num">{x.v}</b>{x.u && <small> {x.u}</small>}</span>
          {x.dir != null ? (
            <svg viewBox="0 0 40 40" className="cl-bussola" aria-hidden><circle cx="20" cy="20" r="17" /><path d="M20 8 L25 24 L20 21 L15 24 Z" style={{ transform: `rotate(${x.dir + 180}deg)` }} /></svg>
          ) : x.p != null && <span className="cl-med" aria-hidden><i style={{ ["--p" as string]: `${x.p}%` }} /></span>}
          {x.n && <span className="cl-tile-n">{x.n}</span>}
        </div>
      ))}
    </section>
  );
}

/* ---------- 7. sol e lua ---------- */
function faseLua(ms: number) {
  const idade = (((ms - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000) % 29.530588 + 29.530588) % 29.530588;
  const ilum = (1 - Math.cos((2 * Math.PI * idade) / 29.530588)) / 2;
  const nome = idade < 1.5 || idade > 28 ? "Lua nova" : idade < 6.4 ? "Crescente" : idade < 8.9 ? "Quarto crescente" : idade < 13.8 ? "Crescente gibosa" : idade < 15.8 ? "Lua cheia" : idade < 20.8 ? "Minguante gibosa" : idade < 23.3 ? "Quarto minguante" : "Minguante";
  return { idade, ilum, nome, crescente: idade < 14.77 };
}
function SolLua({ hoje, amanha }: { hoje: J; amanha: J | undefined }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => { setAgora(Date.now()); const i = setInterval(() => setAgora(Date.now()), 60_000); return () => clearInterval(i); }, []);
  const n0 = Date.parse(hoje.nascerSol), p0 = Date.parse(hoje.porSol);
  const k = agora == null ? 0 : Math.min(1, Math.max(0, (agora - n0) / (p0 - n0)));
  const dur = p0 - n0, horasLuz = Math.floor(dur / 3600_000), minLuz = Math.round((dur % 3600_000) / 60_000);
  const falta = agora != null && agora < p0 && agora > n0 ? Math.round((p0 - agora) / 60_000) : null;
  // arco: x de 10 a 190, y = parábola; ponto do sol na fração k
  const sx = 10 + 180 * k, sy = 80 - Math.sin(Math.PI * k) * 66;
  const lua = faseLua(agora ?? Date.parse(hoje.porSol));
  const sombra = (1 - lua.ilum * 2); // -1..1: largura da elipse do terminador
  return (
    <section className="cl-card cl-sol revela" aria-label="Sol e lua">
      <div className="cl-sol-a">
        <h2 className="cl-tit"><Sun aria-hidden /> Sol</h2>
        <svg viewBox="0 0 200 92" className="cl-arco" aria-hidden>
          <path d="M10 80 Q100 -52 190 80" className="cl-arco-base" />
          <path d="M10 80 Q100 -52 190 80" pathLength={1} className="cl-arco-feito" style={{ ["--k" as string]: k }} />
          <line x1="0" y1="80" x2="200" y2="80" className="cl-arco-horiz" />
          {agora != null && k > 0 && k < 1 && <circle cx={sx} cy={sy} r="7" className="cl-arco-sol" />}
        </svg>
        <div className="cl-sol-h"><span>Nascer <b className="num">{hh(hoje.nascerSol)}</b></span><span>Pôr <b className="num">{hh(hoje.porSol)}</b></span></div>
        <p className="cl-nota">{horasLuz} h {String(minLuz).padStart(2, "0")} min de luz{falta != null ? ` · faltam ${Math.floor(falta / 60)} h ${String(falta % 60).padStart(2, "0")} min` : amanha?.nascerSol ? ` · amanhã nasce às ${hh(amanha.nascerSol)}` : ""}</p>
      </div>
      <div className="cl-sol-b">
        <h2 className="cl-tit">Lua</h2>
        <svg viewBox="0 0 60 60" className="cl-lua" aria-hidden style={{ transform: "scaleX(-1)" /* hemisfério sul: a lua crescente acende pela esquerda */ }}>
          <circle cx="30" cy="30" r="24" className="cl-lua-escura" />
          <path className="cl-lua-clara" d={lua.crescente
            ? `M30 6 A24 24 0 0 1 30 54 A${Math.abs(24 * sombra)} 24 0 0 ${sombra > 0 ? 0 : 1} 30 6 Z`
            : `M30 6 A24 24 0 0 0 30 54 A${Math.abs(24 * sombra)} 24 0 0 ${sombra > 0 ? 1 : 0} 30 6 Z`} />
        </svg>
        <b className="cl-lua-n">{lua.nome}</b>
        <span className="cl-nota">{r0(lua.ilum * 100)}% iluminada</span>
      </div>
    </section>
  );
}
