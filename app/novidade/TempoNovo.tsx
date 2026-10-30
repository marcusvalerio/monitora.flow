"use client";
/**
 * Prévia "Tempo 2.0" (/novidade). Mesmas regras de dado do Clima: só o que veio da previsão; campo ausente some.
 * Novidades em relação à aba Clima: chuva nos próximos 15–120 min, comparação com ontem, avisos (UV, rajada,
 * calor, chuva forte), melhor janela para sair, gráfico de 36 h (temperatura + chuva), semana que abre por dia,
 * índice UV, rajadas, pressão e qualidade do ar.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, CloudSun, Droplets, Sun, Wind, Gauge, Leaf, Umbrella, Thermometer, Clock } from "lucide-react";
import { ErrorState, IconeTempo, LastUpdated, Skel } from "../ui/estados";
import { Relogio } from "../clima/TempoView";
import { J, coord, dec, diaSemana, get, gravarCache, horaLocal, ler, lerCache } from "../ui/util";

const hh = (iso: string) => horaLocal(iso);

export default function TempoNovo() {
  const [local, setLocal] = useState<J | null | undefined>(undefined);
  const [d, setD] = useState<J | null>(null);
  const [em, setEm] = useState<number | null>(null);

  useEffect(() => { setLocal(ler<J | null>("monitora:clima:local", null)); }, []);
  const chave = local ? `monitora:novidade:tempo:${coord(local.lat)},${coord(local.lng)}` : "";

  const carregar = useCallback(async () => {
    if (!local) return;
    const r = await get(`/tempo/completo?lat=${coord(local.lat)}&lng=${coord(local.lng)}`);
    if (!r.erro) { gravarCache(chave, r); setEm(Date.now()); }
    setD((ant) => (r.erro && ant && !ant.erro ? ant : r));
  }, [local, chave]);

  useEffect(() => {
    if (!local) return;
    const c = lerCache(chave, 3 * 3600_000);
    if (c) { setD(c.dado); setEm(c.em); }
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 10 * 60_000);
    return () => clearInterval(t);
  }, [local, chave, carregar]);

  if (local === undefined) return null;
  if (!local) return (
    <Link href="/clima" className="hc hc-convite nv-sec" aria-label="Escolher um local na aba Clima">
      <CloudSun aria-hidden /><span><b>Escolha um local na aba Clima</b><small>A prévia usa o mesmo local salvo</small></span>
    </Link>
  );
  if (!d) return <div className="nv-sec" style={{ display: "grid", gap: 12 }} aria-busy="true"><Skel h={64} r={18} /><Skel h={120} r={18} /><Skel h={180} r={18} /></div>;
  if (d.erro) return <div className="nv-sec"><ErrorState texto="Não foi possível carregar a prévia agora." tentar={carregar} /></div>;

  const c = d.calculado;
  const a = c.agora;
  return (
    <div className="nv-tempo">
      <div className="nv-cab">
        <span className="t-label">Prévia · Tempo 2.0</span>
        <h2>{local.nome}</h2>
      </div>

      <ChuvaCurta ch={c.chuva2h} />

      {/* o arco interativo do Clima continua sendo o centro da tela: arraste pelo anel para ver cada hora */}
      <div className="nv-sec"><Relogio horas={c.horas.slice(0, 24)} agora={a} hoje={c.dias[0]} /></div>

      <section className="nv-hero nv-sec" aria-label="Agora">
        <div className="nv-hero-l">
          <span className="nv-temp num">{a.temperaturaC == null ? "—" : Math.round(a.temperaturaC)}<sup>°</sup></span>
          <span className="nv-cond"><IconeTempo icone={a.descricao?.icone} dia={a.dia} size={20} /> {a.descricao?.texto ?? "—"}</span>
        </div>
        <div className="nv-hero-r">
          {a.sensacaoC != null && <span>Sensação <b>{Math.round(a.sensacaoC)}°</b></span>}
          {c.dias[0]?.maxC != null && <span>Máx <b>{Math.round(c.dias[0].maxC)}°</b> · Mín <b>{Math.round(c.dias[0].minC)}°</b></span>}
          {c.comparacao && <span className="nv-comp">{frasesOntem(c.comparacao.difC)}</span>}
        </div>
      </section>

      <Avisos c={c} />

      {c.melhorJanela && c.horas.some((h: J) => (h.probabilidadeChuvaPct ?? 0) >= 40) && (
        <div className="nv-chip nv-sec"><Clock aria-hidden /> Melhor hora para sair: <b>{hh(c.melhorJanela.inicio)}</b> ({c.melhorJanela.pct}% de chance de chuva nas 2 h seguintes)</div>
      )}

      {c.horas.length > 1 && <Grafico horas={c.horas} />}
      {c.dias.length > 0 && <SemanaAberta dias={c.dias} />}
      <Ficha a={a} ar={c.ar} hoje={c.dias[0]} />

      <p className="rc-fonte" style={{ marginTop: 18 }}>
        <LastUpdated em={em} fonte="Open-Meteo" velhoS={1800} /><br />
        Previsão de modelo numérico e qualidade do ar (Open-Meteo, CC BY 4.0). Experimental.
      </p>
    </div>
  );
}

function frasesOntem(dif: number) {
  if (Math.abs(dif) < 1) return "Máxima parecida com a de ontem";
  return `${Math.round(Math.abs(dif))}° ${dif > 0 ? "mais quente" : "mais fresco"} que ontem`;
}

/* ---------- chuva nas próximas 2 h (passos de 15 min) ---------- */
function ChuvaCurta({ ch }: { ch: J }) {
  const r = ch?.resumo, passos: J[] = ch?.passos ?? [];
  if (!r || !passos.length) return null;
  const texto = r.chovendo
    ? r.mudaEm ? `Chovendo agora; deve parar por volta das ${hh(r.mudaEm)}.` : "Chuva deve continuar nas próximas 2 h."
    : r.mudaEm ? `Chuva deve começar por volta das ${hh(r.mudaEm)}.` : "Sem chuva prevista nas próximas 2 h.";
  const max = Math.max(1, ...passos.map((p) => p.mm ?? 0));
  return (
    <section className={`nv-curta nv-sec${r.chovendo || r.mudaEm ? " molhado" : ""}`} aria-label="Chuva nas próximas 2 horas">
      <div className="nv-curta-t"><Umbrella aria-hidden /> <span>{texto}{r.totalMm > 0 && <small> ≈ {dec(r.totalMm)} mm no total</small>}</span></div>
      <div className="nv-curta-b" aria-hidden>
        {passos.map((p) => (
          <span key={p.inicio}><i style={{ height: `${Math.max(3, ((p.mm ?? 0) / max) * 100)}%`, opacity: (p.mm ?? 0) >= 0.1 ? 1 : 0.25 }} /><em>{hh(p.inicio).replace(":00", "h")}</em></span>
        ))}
      </div>
    </section>
  );
}

/* ---------- avisos derivados só da previsão ---------- */
function Avisos({ c }: { c: J }) {
  const hoje = c.dias[0] ?? {};
  const prox12: J[] = c.horas.slice(0, 12);
  const sensMax = Math.max(-99, ...prox12.map((h) => h.sensacaoC ?? -99));
  const avisos: { ico: React.ReactNode; t: string }[] = [];
  if ((hoje.uvMax ?? 0) >= 8) avisos.push({ ico: <Sun aria-hidden />, t: `UV ${Math.round(hoje.uvMax)} hoje (${hoje.uvMax >= 11 ? "extremo" : "muito alto"}): protetor e sombra entre 10h e 16h.` });
  if ((hoje.rajadaMaxKmh ?? 0) >= 50) avisos.push({ ico: <Wind aria-hidden />, t: `Rajadas de até ${Math.round(hoje.rajadaMaxKmh)} km/h previstas hoje.` });
  if (sensMax >= 35) avisos.push({ ico: <Thermometer aria-hidden />, t: `Sensação de até ${Math.round(sensMax)}° nas próximas 12 h. Hidrate-se.` });
  if ((hoje.chuvaMm ?? 0) >= 10) avisos.push({ ico: <Droplets aria-hidden />, t: `Até ${Math.round(hoje.chuvaMm)} mm de chuva previstos hoje.` });
  if (!avisos.length) return null;
  return (
    <ul className="nv-avisos nv-sec" aria-label="Avisos">
      {avisos.map((x) => <li key={x.t}>{x.ico}<span>{x.t}</span></li>)}
    </ul>
  );
}

/* ---------- gráfico de 36 h: temperatura (linha) + chuva (barras) ---------- */
function Grafico({ horas }: { horas: J[] }) {
  const [foco, setFoco] = useState(0);
  const W = 30, H = 120, larg = horas.length * W;
  const ts = horas.map((h) => h.temperaturaC).filter((v): v is number => v != null);
  const tMin = Math.min(...ts), tMax = Math.max(...ts);
  const y = (v: number) => 14 + (1 - (v - tMin) / Math.max(1, tMax - tMin)) * 56;
  const pts = horas.map((h, i) => h.temperaturaC == null ? null : `${i * W + W / 2},${y(h.temperaturaC).toFixed(1)}`).filter(Boolean).join(" ");
  const f = horas[foco];
  return (
    <section className="nv-sec" aria-label="Próximas 36 horas">
      <h3 className="rc-tit">Próximas {horas.length} horas</h3>
      <p className="nv-foco">
        <b>{foco === 0 ? "Agora" : `${diaRel(f.inicio)}${hh(f.inicio)}`}</b> · {f.temperaturaC == null ? "—" : `${Math.round(f.temperaturaC)}°`} · {f.descricao?.texto ?? "—"}
        {f.probabilidadeChuvaPct != null && ` · chuva ${f.probabilidadeChuvaPct}%`}{(f.precipitacaoMm ?? 0) > 0 && ` (${dec(f.precipitacaoMm)} mm)`}
        {f.rajadaKmh != null && ` · rajada ${Math.round(f.rajadaKmh)} km/h`}{(f.uv ?? 0) >= 1 && ` · UV ${Math.round(f.uv)}`}
      </p>
      <div className="nv-graf">
        <svg width={larg} height={H} role="img" aria-label="Temperatura e chuva por hora. Toque numa hora para ver os detalhes.">
          {horas.map((h, i) => {
            const p = h.probabilidadeChuvaPct ?? 0, mm = h.precipitacaoMm ?? 0;
            const meia = new Date(h.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", timeZone: "America/Sao_Paulo" }) === "00";
            return (
              <g key={h.inicio} onClick={() => setFoco(i)} className={foco === i ? "foco" : ""}>
                <rect x={i * W} y={0} width={W} height={H} className="nv-col" />
                {meia && <line x1={i * W} x2={i * W} y1={0} y2={H - 16} className="nv-meia" />}
                <rect x={i * W + 7} width={W - 14} y={H - 18 - (p / 100) * 30} height={(p / 100) * 30} className="nv-prob" />
                {mm > 0 && <rect x={i * W + 11} width={W - 22} y={H - 18 - Math.min(30, mm * 6)} height={Math.min(30, mm * 6)} className="nv-mm" />}
                <text x={i * W + W / 2} y={H - 4} textAnchor="middle" className="nv-hh">{i === 0 ? "agora" : hh(h.inicio).slice(0, 2)}</text>
              </g>
            );
          })}
          <polyline points={pts} className="nv-linha" />
          {horas.map((h, i) => h.temperaturaC != null && (i % 3 === 0 || i === foco) && (
            <text key={h.inicio} x={i * W + W / 2} y={y(h.temperaturaC) - 6} textAnchor="middle" className={`nv-tt${i === foco ? " foco" : ""}`}>{Math.round(h.temperaturaC)}°</text>
          ))}
        </svg>
      </div>
      <div className="rc-legenda"><span><i className="sw" style={{ background: "var(--periwinkle)" }} />chance de chuva</span><span><i className="sw" style={{ background: "var(--ultramarine)" }} />mm previstos</span></div>
    </section>
  );
}
const diaRel = (iso: string) => {
  const d = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return d === hoje ? "" : "Amanhã, ";
};

/* ---------- semana: cada dia abre com os detalhes ---------- */
function SemanaAberta({ dias }: { dias: J[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const mins = dias.map((d) => d.minC).filter((v): v is number => v != null), maxs = dias.map((d) => d.maxC).filter((v): v is number => v != null);
  const min = Math.min(...mins), max = Math.max(...maxs);
  const pos = (v: number) => ((v - min) / Math.max(1, max - min)) * 100;
  return (
    <section className="nv-sec" aria-label="Próximos dias">
      <h3 className="rc-tit">Próximos {dias.length} dias</h3>
      <ul className="nv-semana">
        {dias.map((d, i) => {
          const ok = d.minC != null && d.maxC != null, ab = aberto === d.data;
          return (
            <li key={d.data}>
              <button aria-expanded={ab} onClick={() => setAberto(ab ? null : d.data)}>
                <span className="nv-d">{i === 0 ? "Hoje" : diaSemana(d.data)}</span>
                <IconeTempo icone={d.descricao?.icone} size={18} />
                <span className="nv-p">{(d.probabilidadeChuvaPct ?? 0) >= 20 ? `${d.probabilidadeChuvaPct}%` : ""}</span>
                <span className="nv-min num">{ok ? `${Math.round(d.minC)}°` : "—"}</span>
                <span className="nv-regua" aria-hidden>{ok && <i style={{ left: `${pos(d.minC)}%`, width: `${Math.max(3, pos(d.maxC) - pos(d.minC))}%` }} />}</span>
                <span className="nv-max num">{ok ? `${Math.round(d.maxC)}°` : "—"}</span>
                <ChevronDown aria-hidden className="nv-chev" />
              </button>
              {ab && (
                <dl className="nv-det">
                  <div><dt>Condição</dt><dd>{d.descricao?.texto ?? "—"}</dd></div>
                  <div><dt>Chuva</dt><dd>{d.chuvaMm == null ? "—" : `${dec(d.chuvaMm)} mm`}{d.probabilidadeChuvaPct != null && ` · ${d.probabilidadeChuvaPct}%`}</dd></div>
                  <div><dt>UV máximo</dt><dd>{d.uvMax == null ? "—" : Math.round(d.uvMax)}</dd></div>
                  <div><dt>Rajada máx.</dt><dd>{d.rajadaMaxKmh == null ? "—" : `${Math.round(d.rajadaMaxKmh)} km/h`}</dd></div>
                  {d.nascerSol && d.porSol && <div><dt>Sol</dt><dd>{hh(d.nascerSol)} – {hh(d.porSol)}</dd></div>}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- ficha ---------- */
function Ficha({ a, ar, hoje }: { a: J; ar: J | null; hoje: J | undefined }) {
  const itens = [
    a.uv != null && { ico: <Sun aria-hidden />, r: "Índice UV", v: `${Math.round(a.uv)}`, n: `${a.uvNivel}${hoje?.uvMax != null ? ` · máx. hoje ${Math.round(hoje.uvMax)}` : ""}`, p: Math.min(100, (a.uv / 11) * 100) },
    ar && { ico: <Leaf aria-hidden />, r: "Qualidade do ar", v: `${Math.round(ar.usAqi)}`, n: `${ar.nivel}${ar.pm25 != null ? ` · PM2,5 ${Math.round(ar.pm25)} µg/m³` : ""}`, p: Math.min(100, (ar.usAqi / 200) * 100) },
    a.ventoKmh != null && { ico: <Wind aria-hidden />, r: "Vento", v: `${Math.round(a.ventoKmh)} km/h`, n: a.rajadaKmh != null ? `rajadas de ${Math.round(a.rajadaKmh)} km/h` : null },
    a.umidadePct != null && { ico: <Droplets aria-hidden />, r: "Umidade", v: `${a.umidadePct}%`, n: null, p: a.umidadePct },
    a.pressaoHpa != null && { ico: <Gauge aria-hidden />, r: "Pressão", v: `${Math.round(a.pressaoHpa)} hPa`, n: null },
    a.nuvensPct != null && { ico: <CloudSun aria-hidden />, r: "Nuvens", v: `${a.nuvensPct}%`, n: null, p: a.nuvensPct },
  ].filter(Boolean) as { ico: React.ReactNode; r: string; v: string; n: string | null; p?: number }[];
  return (
    <section className="nv-sec" aria-label="Detalhes de agora">
      <h3 className="rc-tit">Detalhes de agora</h3>
      <dl className="nv-ficha">
        {itens.map((x) => (
          <div key={x.r}>
            <dt>{x.ico}{x.r}</dt>
            <dd><b className="num">{x.v}</b>{x.p != null && <span className="rc-med" aria-hidden><i style={{ ["--p" as string]: `${x.p}%` }} /></span>}{x.n && <small>{x.n}</small>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
