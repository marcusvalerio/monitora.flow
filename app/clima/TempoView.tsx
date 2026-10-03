"use client";
/**
 * Clima — "Relógio do céu" (identidade própria do Monitora).
 * O hero é um mostrador de 24 h: cada hora é um gomo pintado com o tom do céu previsto para ela,
 * a chance de chuva cresce para fora do anel e o centro mostra a temperatura. Arrastar o dedo pelo
 * anel percorre as horas. Abaixo: fita das horas, semana em escala única e uma ficha tipográfica.
 * Regras de dado: só o que veio da previsão/medição. Campo ausente → "—" ou o bloco some.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp } from "lucide-react";
import { ContaNumero } from "./WeatherHero";
import { IconeTempo, LastUpdated } from "../ui/estados";
import { J, dec, diaSemana, distKm, fmtDist, horaLocal } from "../ui/util";
import type { Local } from "./ClimaApp";

const pontoCardeal = (g: number) => ["N", "NE", "L", "SE", "S", "SO", "O", "NO"][Math.round(g / 45) % 8];

/** Tom do céu por condição (paleta Monitora: Sea Mist, Periwinkle, Lilac, Ultramarine, Ink). */
function tomDoCeu(icone: string | null | undefined, dia: boolean | null | undefined): string {
  const noite = dia === false;
  switch (icone) {
    case "sol": return noite ? "#2E3566" : "#F1D488";
    case "parcial": return noite ? "#414A85" : "#CDD6EE";
    case "nublado": return noite ? "#565C78" : "#BCC1D2";
    case "neblina": return noite ? "#6A6F80" : "#D9DCDA";
    case "garoa": return noite ? "#5C7C84" : "#B9D7D6";
    case "chuva": return noite ? "#4C57B0" : "#8997F5";
    case "tempestade": return "#232A63";
    case "neve": return "#EEF2F3";
    default: return "var(--surface-2)";
  }
}

function useRevela<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!("IntersectionObserver" in window)) { setVis(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return [ref, vis] as const;
}

function Bloco({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  const [ref, vis] = useRevela<HTMLElement>();
  return (
    <section ref={ref} className={`rc-bloco${vis ? " vis" : ""} ${className}`} aria-label={titulo}>
      <h2 className="rc-tit">{titulo}</h2>
      {children}
    </section>
  );
}

export default function TempoView({ tempo, chuva, local }: { tempo: J; chuva: J | null; local: Local }) {
  const a = tempo.calculado?.agora;
  const horas: J[] = (tempo.calculado?.proximasHoras ?? []).slice(0, 24);
  const dias: J[] = tempo.calculado?.proximosDias ?? [];
  const hoje = dias[0], h1 = horas[1];
  const est = chuva?.observado?.[0];
  const estPerto = est && distKm(local, est) <= 15 ? est : null;

  return (
    <div className="rc">
      <Relogio horas={horas} agora={a} hoje={hoje} />

      {horas.length > 0 && (
        <Bloco titulo="Próximas 24 horas">
          <p className="rc-frase">{resumoHoras(horas)}</p>
          <Fita horas={horas} />
        </Bloco>
      )}

      {dias.length > 0 && (
        <Bloco titulo={`Semana · ${dias.length} dias na mesma escala`}>
          <Semana dias={dias} agora={a?.temperaturaC} />
        </Bloco>
      )}

      <Bloco titulo="Ficha de agora">
        <dl className="rc-ficha">
          <Item rotulo="Sensação" valor={a?.sensacaoC == null ? null : `${Math.round(a.sensacaoC)}°`}
            nota={a?.sensacaoC == null || a?.temperaturaC == null ? null : Math.abs(a.sensacaoC - a.temperaturaC) < 1 ? "igual ao termômetro" : a.sensacaoC > a.temperaturaC ? "mais abafado que o termômetro" : "mais frio que o termômetro"} />
          <Item rotulo="Umidade" valor={a?.umidadePct == null ? null : `${a.umidadePct}%`} medidor={a?.umidadePct} />
          <Item rotulo="Vento" valor={a?.ventoKmh == null ? null : `${Math.round(a.ventoKmh)} km/h`}
            nota={a?.ventoDirecao == null ? null : `vindo de ${pontoCardeal(a.ventoDirecao)}`}
            extra={a?.ventoDirecao != null && <ArrowUp className="rc-vento" aria-hidden style={{ ["--dir" as string]: `${a.ventoDirecao + 180}deg` }} />} />
          <Item rotulo="Chuva na próxima hora" valor={h1?.probabilidadeChuvaPct == null ? null : `${h1.probabilidadeChuvaPct}%`} medidor={h1?.probabilidadeChuvaPct}
            nota={h1?.precipitacaoMm == null ? null : `${dec(h1.precipitacaoMm)} mm previstos`} />
          <Item rotulo="Visibilidade" valor={h1?.visibilidadeM == null ? null : h1.visibilidadeM >= 10000 ? "10+ km" : `${dec(h1.visibilidadeM / 1000)} km`} />
          {hoje?.nascerSol && hoje?.porSol && <Sol nascer={hoje.nascerSol} por={hoje.porSol} />}
        </dl>
      </Bloco>

      {estPerto && (
        <Bloco titulo="Chuva medida agora">
          <div className="rc-medida">
            <span className="rc-num">{estPerto.mm.h01 == null ? "—" : dec(estPerto.mm.h01)}</span><span className="rc-un">mm na última hora</span>
          </div>
          <p className="rc-nota">{estPerto.mm.m15 != null && `${dec(estPerto.mm.m15)} mm em 15 min · `}Pluviômetro {estPerto.nome}, a {fmtDist(estPerto.distanciaM / 1000)}</p>
          <LastUpdated em={estPerto.medidoEm} fonte="Alerta Rio" velhoS={1200} />
        </Bloco>
      )}

      <Standby horas={horas} agora={a} hoje={hoje} local={local.nome} />

      <p className="rc-fonte">
        Previsão de modelo numérico (Open-Meteo, CC BY 4.0). Chuva medida: pluviômetros do Alerta Rio. <a href="/mais">Sobre os dados</a>
      </p>
    </div>
  );
}

/* ---------- relógio do céu ---------- */
const R_EXT = 128, R_INT = 100, CX = 170, CY = 170;
function arco(i: number, n: number, r1: number, r2: number, folga = 0.9) {
  const a0 = ((i + (1 - folga) / 2) / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1 - (1 - folga) / 2) / n) * 2 * Math.PI - Math.PI / 2;
  const p = (r: number, a: number) => `${(CX + r * Math.cos(a)).toFixed(2)},${(CY + r * Math.sin(a)).toFixed(2)}`;
  return `M${p(r2, a0)} A${r2},${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1},${r1} 0 0 0 ${p(r1, a0)} Z`;
}

function Relogio({ horas, agora, hoje }: { horas: J[]; agora: J | null | undefined; hoje: J | null | undefined }) {
  const [foco, setFoco] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const n = Math.max(1, horas.length);
  const h = foco == null ? null : horas[foco];
  const temp = h ? h.temperaturaC : agora?.temperaturaC;
  const cond = h ? h.descricao?.texto : agora?.descricao?.texto;
  const rotulo = h ? (foco === 0 ? "Agora" : `Às ${horaLocal(h.inicio).slice(0, 2)}h`) : "Agora";

  const escolher = (e: React.PointerEvent) => {
    const r = svg.current?.getBoundingClientRect(); if (!r) return;
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(x, y) < r.width * 0.2) { setFoco(null); return; }
    const ang = (Math.atan2(y, x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    setFoco(Math.min(n - 1, Math.floor((ang / (2 * Math.PI)) * n)));
  };
  // marcações a cada 6 h (rótulo da hora local)
  const marcas = horas.map((x, i) => ({ i, x })).filter(({ i }) => i > 0 && i % 6 === 0);

  return (
    <section className="rc-relogio" aria-label="Agora e as próximas 24 horas">
      <svg ref={svg} viewBox="0 0 340 340" className="rc-dial" role="img"
        aria-label={`${rotulo}: ${temp == null ? "temperatura indisponível" : Math.round(temp) + " graus"}, ${cond ?? "condição indisponível"}. Arraste pelo anel para ver cada hora.`}
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); escolher(e); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === "mouse") escolher(e); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setFoco(null); }}>
        <circle cx={CX} cy={CY} r={R_INT - 10} className="rc-miolo" />
        {horas.map((x, i) => (
          <g key={x.inicio} className={`rc-gomo${foco === i ? " foco" : ""}`} style={{ ["--i" as string]: i }}>
            <path d={arco(i, n, R_INT, R_EXT)} fill={tomDoCeu(x.descricao?.icone, x.dia)} />
            {x.probabilidadeChuvaPct > 0 && (
              <path className="rc-chuva" d={arco(i, n, R_EXT + 5, R_EXT + 5 + (x.probabilidadeChuvaPct / 100) * 22, 0.42)} />
            )}
          </g>
        ))}
        {marcas.map(({ i, x }) => {
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
          return <text key={i} className="rc-marca" x={CX + (R_INT - 22) * Math.cos(ang)} y={CY + (R_INT - 22) * Math.sin(ang) + 4} textAnchor="middle">{horaLocal(x.inicio).slice(0, 2) + "h"}</text>;
        })}
        {/* ponteiro: aponta a hora em foco (ou agora) */}
        <g className="rc-ponteiro" style={{ transform: `rotate(${((foco ?? 0) + 0.5) / n * 360}deg)` }}>
          <line x1={CX} y1={CY - R_EXT - 2} x2={CX} y2={CY - R_INT + 4} />
          <circle cx={CX} cy={CY - R_EXT - 6} r="4" />
        </g>
      </svg>
      <div className="rc-centro" aria-hidden>
        <span className="rc-rot">{rotulo}</span>
        <span className="rc-temp">{temp == null ? "—" : foco == null ? <ContaNumero valor={Math.round(temp)} /> : Math.round(temp)}<sup>°</sup></span>
        <span className="rc-cond">{cond ?? "—"}</span>
        {foco == null ? (
          <span className="rc-mm">{hoje?.maxC != null && `↑ ${Math.round(hoje.maxC)}°`}{hoje?.minC != null && `  ↓ ${Math.round(hoje.minC)}°`}</span>
        ) : (
          <span className="rc-mm">{h?.probabilidadeChuvaPct != null ? `chuva ${h.probabilidadeChuvaPct}%` : ""}</span>
        )}
      </div>
      <div className="rc-legenda" aria-hidden>
        <span><i className="sw ceu" />tom do céu por hora</span>
        <span><i className="sw chv" />chance de chuva</span>
      </div>
    </section>
  );
}

/** Frase de resumo derivada só das horas da previsão. */
function resumoHoras(h: J[]): string {
  const desc = h[0]?.descricao?.texto;
  const muda = h.findIndex((x) => x.descricao?.texto && x.descricao.texto !== desc);
  const pMax = Math.max(...h.map((x) => x.probabilidadeChuvaPct ?? 0));
  const partes: string[] = [];
  if (desc) partes.push(muda > 0 ? `${desc} até por volta das ${horaLocal(h[muda].inicio).slice(0, 2)}h, depois ${h[muda].descricao.texto.toLowerCase()}.` : `${desc} o dia todo.`);
  if (pMax >= 20) partes.push(`Chance de chuva chega a ${pMax}%.`);
  return partes.join(" ") || "Previsão para as próximas 24 horas.";
}

/* ---------- fita das horas: temperatura como relevo ---------- */
function Fita({ horas }: { horas: J[] }) {
  const ts = horas.map((x) => x.temperaturaC as number | null).filter((x): x is number => x != null);
  const min = Math.min(...ts), max = Math.max(...ts);
  const alt = (v: number | null) => v == null ? 0 : 18 + (max === min ? 30 : ((v - min) / (max - min)) * 52);
  return (
    <div className="rc-fita" role="list">
      {horas.map((x, i) => (
        <div key={x.inicio} className="rc-h" role="listitem" style={{ ["--i" as string]: Math.min(i, 14) }}
          aria-label={`${i === 0 ? "Agora" : horaLocal(x.inicio)}: ${x.temperaturaC == null ? "sem dado" : Math.round(x.temperaturaC) + " graus"}, ${x.descricao?.texto ?? ""}, chance de chuva ${x.probabilidadeChuvaPct ?? "sem dado"}%`}>
          <span className="rc-h-t">{x.temperaturaC == null ? "—" : `${Math.round(x.temperaturaC)}°`}</span>
          <span className="rc-h-col" style={{ height: alt(x.temperaturaC), background: tomDoCeu(x.descricao?.icone, x.dia) }} />
          <IconeTempo icone={x.descricao?.icone} dia={x.dia} size={18} />
          <span className="rc-h-p">{x.probabilidadeChuvaPct >= 20 ? `${x.probabilidadeChuvaPct}%` : ""}</span>
          <span className="rc-h-h">{i === 0 ? "agora" : horaLocal(x.inicio).slice(0, 2) + "h"}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- semana: todas as faixas na mesma régua ---------- */
function Semana({ dias, agora }: { dias: J[]; agora: number | null | undefined }) {
  const min = Math.min(...dias.map((d) => d.minC ?? 99)), max = Math.max(...dias.map((d) => d.maxC ?? -99));
  const pos = (v: number) => ((v - min) / Math.max(1, max - min)) * 100;
  return (
    <ol className="rc-semana">
      {dias.map((d, i) => {
        const ok = d.minC != null && d.maxC != null;
        return (
          <li key={d.data} style={{ ["--i" as string]: i }}
            aria-label={`${i === 0 ? "Hoje" : diaSemana(d.data)}: ${d.descricao?.texto ?? ""}, mínima ${ok ? Math.round(d.minC) : "sem dado"}, máxima ${ok ? Math.round(d.maxC) : "sem dado"}, chance de chuva ${d.probabilidadeChuvaPct ?? "sem dado"}%`}>
            <span className="rc-d">{i === 0 ? "Hoje" : diaSemana(d.data)}</span>
            <IconeTempo icone={d.descricao?.icone} size={18} />
            <span className="rc-regua" aria-hidden>
              {ok && <i style={{ left: `${pos(d.minC)}%`, width: `${Math.max(2, pos(d.maxC) - pos(d.minC))}%`, background: tomDoCeu(d.descricao?.icone, true) }}>
                <em>{Math.round(d.minC)}°</em><b>{Math.round(d.maxC)}°</b>
              </i>}
              {i === 0 && agora != null && ok && <u style={{ left: `${pos(Math.min(d.maxC, Math.max(d.minC, agora)))}%` }} />}
            </span>
            <span className="rc-gotas" aria-hidden>
              {[0, 1, 2, 3, 4].map((k) => <i key={k} className={d.probabilidadeChuvaPct != null && d.probabilidadeChuvaPct > k * 20 ? "on" : ""} />)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Item({ rotulo, valor, nota, medidor, extra }: { rotulo: string; valor: string | null; nota?: string | null; medidor?: number | null; extra?: React.ReactNode }) {
  return (
    <div className="rc-item">
      <dt>{rotulo}</dt>
      <dd>
        <span className="rc-num">{valor ?? "—"}</span>{extra}
        {medidor != null && <span className="rc-med" aria-hidden><i style={{ ["--p" as string]: `${medidor}%` }} /></span>}
        {nota && <span className="rc-nota">{nota}</span>}
      </dd>
    </div>
  );
}

function Sol({ nascer, por }: { nascer: string; por: string }) {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => { setAgora(Date.now()); const t = setInterval(() => setAgora(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const n = Date.parse(nascer), p = Date.parse(por);
  const k = useMemo(() => agora == null ? null : Math.min(1, Math.max(0, (agora - n) / (p - n))), [agora, n, p]);
  return (
    <div className="rc-item">
      <dt>Luz do dia</dt>
      <dd>
        <span className="rc-num rc-num-s">{horaLocal(nascer)} · {horaLocal(por)}</span>
        <span className="rc-luz" aria-hidden><i style={{ ["--p" as string]: `${(k ?? 0) * 100}%` }} /></span>
        <span className="rc-nota">{k == null ? "" : k <= 0 ? "o sol ainda não nasceu" : k >= 1 ? "o sol já se pôs" : `${Math.round(k * 100)}% do dia já passou`}</span>
      </dd>
    </div>
  );
}

/**
 * StandBy: celular deitado (paisagem baixa) vira um relógio de mesa — hora grande à esquerda,
 * relógio do céu à direita. Só CSS decide quando aparece (globals.css, seção 14); fora disso fica oculto.
 */
function Standby({ horas, agora, hoje, local }: { horas: J[]; agora: J | null | undefined; hoje: J | null | undefined; local: string }) {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => { setT(new Date()); const i = setInterval(() => setT(new Date()), 10_000); return () => clearInterval(i); }, []);
  const hm = t ? t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "--:--";
  const [h, m] = hm.split(":");
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  useEffect(() => setAlvo(document.body), []); // fora da página: a transição da página usa transform, que prenderia o position: fixed
  const data = t ? t.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }) : "";
  if (!alvo) return null;
  return createPortal(
    <div className="standby" aria-hidden>
      <div className="sb-relogio">
        <div className="sb-hora num"><span>{h}</span><i className="sb-sep">:</i><span>{m}</span></div>
        <div className="sb-data">{data}</div>
        <div className="sb-local">{local}</div>
      </div>
      <div className="sb-ceu"><Relogio horas={horas} agora={agora} hoje={hoje} /></div>
    </div>, alvo);
}
