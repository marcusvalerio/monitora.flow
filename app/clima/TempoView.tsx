"use client";
/**
 * Tela de clima imersiva (referências: Tempo do iOS 26 e One UI 6.1).
 * - O céu (atmosfera) ocupa a tela inteira, atrás de tudo; o conteúdo flutua em cartões de vidro.
 * - O hero encolhe ao rolar (como no iOS): temperatura grande → linha compacta.
 * - Cartões entram com revelação ao aparecer na tela; medidores animam ao entrar.
 * Regras de dado: só mostra o que veio da previsão/medição. Campo ausente → "—" ou o cartão some.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Clock, CloudRain, Droplets, Eye, Gauge, Sunrise, Thermometer, Wind } from "lucide-react";
import WeatherAtmosphere, { atmosferaDe } from "./atmosfera/WeatherAtmosphere";
import { ContaNumero } from "./WeatherHero";
import { IconeTempo, LastUpdated } from "../ui/estados";
import { J, dec, diaSemana, distKm, fmtDist, horaLocal } from "../ui/util";
import type { Local } from "./ClimaApp";

const pontoCardeal = (g: number) => ["N", "NE", "L", "SE", "S", "SO", "O", "NO"][Math.round(g / 45) % 8];

/** Revela o elemento quando entra na tela (uma vez). */
function useRevela<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!("IntersectionObserver" in window)) { setVis(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.18 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return [ref, vis] as const;
}

function Cartao({ titulo, Icone, children, className = "", i = 0 }: { titulo: string; Icone: React.ElementType; children: React.ReactNode; className?: string; i?: number }) {
  const [ref, vis] = useRevela<HTMLElement>();
  return (
    <section ref={ref} className={`cw${vis ? " vis" : ""} ${className}`} style={{ ["--i" as string]: i }} aria-label={titulo}>
      <header className="cw-h"><Icone aria-hidden />{titulo}</header>
      {children}
    </section>
  );
}

export default function TempoView({ tempo, chuva, local }: { tempo: J; chuva: J | null; local: Local }) {
  const a = tempo.calculado?.agora;
  const horas: J[] = (tempo.calculado?.proximasHoras ?? []).slice(0, 24);
  const dias: J[] = tempo.calculado?.proximosDias ?? [];
  const hoje = dias[0], h1 = horas[1];
  const tipo = atmosferaDe(a?.descricao?.icone, a?.dia);
  const est = chuva?.observado?.[0];
  const estPerto = est && distKm(local, est) <= 15 ? est : null;

  // hero que encolhe com a rolagem (k: 0 → 1)
  const hero = useRef<HTMLDivElement>(null), barra = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const ler = (alvo: EventTarget | null) => {
      const el = alvo instanceof HTMLElement ? alvo : document.scrollingElement;
      const k = Math.min(1, Math.max(0, (el?.scrollTop ?? 0) / 170));
      hero.current?.style.setProperty("--k", k.toFixed(3)); barra.current?.style.setProperty("--k", k.toFixed(3));
    };
    const on = (e: Event) => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; ler(e.target === document ? null : e.target); }); };
    window.addEventListener("scroll", on, { capture: true, passive: true });
    return () => { window.removeEventListener("scroll", on, { capture: true }); cancelAnimationFrame(raf); };
  }, []);

  const t = a?.temperaturaC;
  return (
    <div className={`clima-imersivo on-${tipo}`}>
      {/* o céu vai direto no <body>: nenhuma transformação de transição de página o prende */}
      <Ceu tipo={tipo} />

      <div ref={hero} className="ch" aria-label={`Agora em ${local.nome}`}>
        <div className="ch-temp num" aria-label={t == null ? "Temperatura indisponível" : `${Math.round(t)} graus`}>
          {t == null ? "—" : <ContaNumero valor={Math.round(t)} />}<span className="deg" aria-hidden>°</span>
        </div>
        <div className="ch-cond">{a?.descricao?.texto ?? "Condição indisponível"}</div>
        <div className="ch-mm num">
          {hoje?.maxC != null && <span>Máx. {Math.round(hoje.maxC)}°</span>}
          {hoje?.minC != null && <span>Mín. {Math.round(hoje.minC)}°</span>}
        </div>
      </div>
      <NoBody>
        <div ref={barra} className="ch-barra" aria-hidden>
          <div><span className="num">{local.nome} · {t == null ? "—" : `${Math.round(t)}°`}</span><small>{a?.descricao?.texto ?? ""}</small></div>
        </div>
      </NoBody>

      <div className="cw-grid">
        {horas.length > 0 && (
          <Cartao titulo="Próximas horas" Icone={Clock} className="span2" i={0}>
            <p className="cw-resumo">{resumoHoras(horas)}</p>
            <Horas horas={horas} />
          </Cartao>
        )}

        {dias.length > 0 && (
          <Cartao titulo={`Próximos ${dias.length} dias`} Icone={CalendarDays} className="span2" i={1}>
            <Dias dias={dias} agora={t} />
          </Cartao>
        )}

        <Cartao titulo="Sensação" Icone={Thermometer} i={2}>
          <div className="cw-big num">{a?.sensacaoC == null ? "—" : `${Math.round(a.sensacaoC)}°`}</div>
          <p className="cw-nota">{a?.sensacaoC == null || t == null ? "Sem dado." : Math.abs(a.sensacaoC - t) < 1 ? "Parecida com a temperatura real." : a.sensacaoC > t ? "Parece mais quente pela umidade." : "Parece mais frio pelo vento."}</p>
        </Cartao>

        <Cartao titulo="Umidade" Icone={Droplets} i={3}>
          <Anel pct={a?.umidadePct} />
        </Cartao>

        <Cartao titulo="Vento" Icone={Wind} i={4}>
          <Bussola kmh={a?.ventoKmh} dir={a?.ventoDirecao} />
        </Cartao>

        <Cartao titulo="Chuva" Icone={CloudRain} i={5}>
          <div className="cw-big num">{h1?.probabilidadeChuvaPct == null ? "—" : `${h1.probabilidadeChuvaPct}%`}</div>
          <Barra pct={h1?.probabilidadeChuvaPct} />
          <p className="cw-nota">{h1?.precipitacaoMm == null ? "Chance na próxima hora." : `${dec(h1.precipitacaoMm)} mm previstos na próxima hora.`}</p>
        </Cartao>

        {hoje?.nascerSol && hoje?.porSol && (
          <Cartao titulo="Sol" Icone={Sunrise} i={6}>
            <ArcoSol nascer={hoje.nascerSol} por={hoje.porSol} />
          </Cartao>
        )}

        <Cartao titulo="Visibilidade" Icone={Eye} i={7}>
          <div className="cw-big num">{h1?.visibilidadeM == null ? "—" : h1.visibilidadeM >= 10000 ? "10+ km" : `${dec(h1.visibilidadeM / 1000)} km`}</div>
          <p className="cw-nota">{h1?.visibilidadeM == null ? "Sem dado." : h1.visibilidadeM >= 10000 ? "Céu limpo de névoa." : h1.visibilidadeM >= 4000 ? "Um pouco reduzida." : "Reduzida."}</p>
        </Cartao>

        {estPerto && (
          <Cartao titulo="Chuva medida agora" Icone={Gauge} className="span2" i={8}>
            <div className="cw-big num">{estPerto.mm.h01 == null ? "Sem medição" : `${dec(estPerto.mm.h01)} mm`}<small> na última hora</small></div>
            <p className="cw-nota">{estPerto.mm.m15 != null && `${dec(estPerto.mm.m15)} mm em 15 min · `}Pluviômetro {estPerto.nome}, a {fmtDist(estPerto.distanciaM / 1000)}</p>
            <div className="cw-upd"><LastUpdated em={estPerto.medidoEm} fonte="Alerta Rio" velhoS={1200} /></div>
          </Cartao>
        )}
      </div>

      <p className="cw-fonte">
        Previsão de modelo numérico (Open-Meteo, CC BY 4.0). Chuva medida: pluviômetros do Alerta Rio. <a href="/mais">Sobre os dados</a>
      </p>
    </div>
  );
}

/** Frase de resumo derivada só das horas da previsão (estilo iOS). */
function resumoHoras(h: J[]): string {
  const desc = h[0]?.descricao?.texto;
  const muda = h.findIndex((x) => x.descricao?.texto && x.descricao.texto !== desc);
  const pMax = Math.max(...h.map((x) => x.probabilidadeChuvaPct ?? 0));
  const partes: string[] = [];
  if (desc) partes.push(muda > 0 ? `${desc} até por volta das ${horaLocal(h[muda].inicio).slice(0, 2)}h.` : `${desc} nas próximas horas.`);
  if (pMax >= 20) partes.push(`Chance de chuva de até ${pMax}% nas próximas 24 h.`);
  return partes.join(" ") || "Previsão para as próximas 24 horas.";
}

const COL = 58; // largura de cada hora (px) — a curva usa a mesma grade
function Horas({ horas }: { horas: J[] }) {
  const ts = horas.map((h) => h.temperaturaC as number | null);
  const val = ts.filter((x): x is number => x != null);
  const min = Math.min(...val), max = Math.max(...val), H = 34;
  const y = (v: number) => 4 + (max === min ? H / 2 : (1 - (v - min) / (max - min)) * H);
  const pts = ts.map((v, i) => (v == null ? null : [i * COL + COL / 2, y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
  const d = pts.map(([x, yy], i) => {
    if (i === 0) return `M${x},${yy}`;
    const [px, py] = pts[i - 1], cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${yy} ${x},${yy}`;
  }).join(" ");
  return (
    <div className="cw-horas" role="list">
      <div className="trilho" style={{ width: horas.length * COL }}>
        {horas.map((h, i) => (
          <div className="hr" role="listitem" key={h.inicio} style={{ ["--i" as string]: Math.min(i, 12) }}
            aria-label={`${i === 0 ? "Agora" : horaLocal(h.inicio)}: ${h.temperaturaC == null ? "sem dado" : Math.round(h.temperaturaC) + " graus"}, ${h.descricao?.texto ?? ""}, chance de chuva ${h.probabilidadeChuvaPct ?? "sem dado"}%`}>
            <span className="hr-h">{i === 0 ? "Agora" : horaLocal(h.inicio).slice(0, 2) + "h"}</span>
            <IconeTempo icone={h.descricao?.icone} dia={h.dia} />
            <span className="hr-p num">{h.probabilidadeChuvaPct >= 20 ? `${h.probabilidadeChuvaPct}%` : ""}</span>
          </div>
        ))}
        {pts.length > 1 && (
          <svg className="curva" width={horas.length * COL} height={H + 8} aria-hidden>
            <defs><linearGradient id="cv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
            <path d={`${d} L${pts[pts.length - 1][0]},${H + 8} L${pts[0][0]},${H + 8} Z`} fill="url(#cv)" />
            <path className="linha" d={d} pathLength={1} />
            {pts.map(([x, yy], i) => <circle key={i} cx={x} cy={yy} r={i === 0 ? 3.6 : 2.2} className={i === 0 ? "agora" : ""} />)}
          </svg>
        )}
        <div className="hr-t">
          {horas.map((h) => <span key={h.inicio} className="num">{h.temperaturaC == null ? "—" : `${Math.round(h.temperaturaC)}°`}</span>)}
        </div>
      </div>
    </div>
  );
}

function Dias({ dias, agora }: { dias: J[]; agora: number | null | undefined }) {
  const min = Math.min(...dias.map((d) => d.minC ?? 99)), max = Math.max(...dias.map((d) => d.maxC ?? -99));
  const pos = (v: number) => ((v - min) / Math.max(1, max - min)) * 100;
  return (
    <ul className="cw-dias">
      {dias.map((d, i) => {
        const ok = d.minC != null && d.maxC != null;
        return (
          <li key={d.data} style={{ ["--i" as string]: i }}
            aria-label={`${i === 0 ? "Hoje" : diaSemana(d.data)}: ${d.descricao?.texto ?? ""}, mínima ${ok ? Math.round(d.minC) : "sem dado"}, máxima ${ok ? Math.round(d.maxC) : "sem dado"}, chance de chuva ${d.probabilidadeChuvaPct ?? "sem dado"}%`}>
            <span className="dd">{i === 0 ? "Hoje" : diaSemana(d.data)}</span>
            <span className="di"><IconeTempo icone={d.descricao?.icone} />{d.probabilidadeChuvaPct >= 20 && <small className="num">{d.probabilidadeChuvaPct}%</small>}</span>
            <span className="num dmin">{ok ? `${Math.round(d.minC)}°` : "—"}</span>
            <span className="dbar" aria-hidden>
              {ok && <i style={{ ["--clip" as string]: `inset(0 ${100 - pos(d.maxC)}% 0 ${pos(d.minC)}% round 3px)` }} />}
              {i === 0 && agora != null && ok && <b style={{ left: `${pos(Math.min(d.maxC, Math.max(d.minC, agora)))}%` }} />}
            </span>
            <span className="num dmax">{ok ? `${Math.round(d.maxC)}°` : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Anel({ pct }: { pct: number | null | undefined }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="cw-anel">
      <svg viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r={r} className="fundo" />
        {pct != null && <circle cx="40" cy="40" r={r} className="valor" strokeDasharray={c} style={{ ["--off" as string]: c * (1 - pct / 100), ["--c" as string]: c }} />}
      </svg>
      <div className="num">{pct == null ? "—" : `${pct}%`}</div>
      <p className="cw-nota">{pct == null ? "Sem dado." : pct >= 80 ? "Ar bem úmido." : pct >= 50 ? "Umidade confortável." : "Ar seco."}</p>
    </div>
  );
}

function Bussola({ kmh, dir }: { kmh: number | null | undefined; dir: number | null | undefined }) {
  return (
    <div className="cw-bussola">
      <div className="mostrador" aria-hidden>
        {["N", "L", "S", "O"].map((p, i) => <span key={p} style={{ ["--a" as string]: `${i * 90}deg` }}>{p}</span>)}
        {dir != null && <i className="agulha" style={{ ["--dir" as string]: `${dir + 180}deg` }} />}
        <b className="num">{kmh == null ? "—" : Math.round(kmh)}<small>km/h</small></b>
      </div>
      <p className="cw-nota">{dir == null ? "Direção indisponível." : `Vindo de ${pontoCardeal(dir)}.`}</p>
    </div>
  );
}

function Barra({ pct }: { pct: number | null | undefined }) {
  return <div className="cw-barra" aria-hidden><i style={{ ["--p" as string]: `${pct ?? 0}%` }} /></div>;
}

function ArcoSol({ nascer, por }: { nascer: string; por: string }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => { setAgora(Date.now()); const t = setInterval(() => setAgora(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const n = Date.parse(nascer), p = Date.parse(por);
  const k = agora == null ? null : Math.min(1, Math.max(0, (agora - n) / (p - n)));
  const dia = agora != null && agora >= n && agora <= p;
  const pt = useMemo(() => {
    if (k == null) return null;
    const ang = Math.PI * (1 - k);
    return { x: 50 + 40 * Math.cos(ang), y: 52 - 40 * Math.sin(ang) };
  }, [k]);
  return (
    <div className="cw-sol">
      <svg viewBox="0 0 100 60" aria-hidden>
        <path d="M10,52 A40,40 0 0 1 90,52" className="arco" />
        {pt && dia && <path d={`M10,52 A40,40 0 0 1 ${pt.x},${pt.y}`} className="feito" />}
        <line x1="2" x2="98" y1="52" y2="52" className="horiz" />
        {pt && <circle cx={pt.x} cy={dia ? pt.y : 52} r="4.5" className={`astro${dia ? "" : " noite"}`} />}
      </svg>
      <div className="cw-sol-h num"><span>↑ {horaLocal(nascer)}</span><span>↓ {horaLocal(por)}</span></div>
    </div>
  );
}

function Ceu({ tipo }: { tipo: ReturnType<typeof atmosferaDe> }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setAlvo(document.body);
    document.documentElement.classList.add("tem-ceu");
    return () => document.documentElement.classList.remove("tem-ceu");
  }, []);
  return alvo ? createPortal(<div className={`ceu on-${tipo}`} aria-hidden><WeatherAtmosphere tipo={tipo} /></div>, alvo) : null;
}

/** Elementos fixos vão para o <body> (a transição de página usa transform, que prenderia o position: fixed). */
function NoBody({ children }: { children: React.ReactNode }) {
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => setAlvo(document.body), []);
  return alvo ? createPortal(children, alvo) : null;
}
