"use client";
import WeatherHero from "./WeatherHero";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LocateFixed, Search, MapPin, Clock, Droplets, Wind, Thermometer, Eye, CloudRain, Navigation } from "lucide-react";
import SearchSheet from "../ui/SearchSheet";
import { EmptyState, ErrorState, IconeTempo, LastUpdated, Skel } from "../ui/estados";
import { J, dec, diaSemana, distKm, fmtDist, get, gravar, horaLocal, lembrar, ler, minhaPosicao } from "../ui/util";

export interface Local { id: string; nome: string; detalhe?: string; lat: number; lng: number; gps?: boolean }
const CHAVE_LOCAL = "monitora:clima:local";
const CHAVE_RECENTES = "monitora:clima:recentes";

const pontoCardeal = (g: number) => ["N", "NE", "L", "SE", "S", "SO", "O", "NO"][Math.round(g / 45) % 8];

export default function ClimaApp() {
  const [local, setLocal] = useState<Local | null | undefined>(undefined); // undefined = lendo armazenamento
  const [tempo, setTempo] = useState<J | null>(null);
  const [chuva, setChuva] = useState<J | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);

  useEffect(() => { setLocal(ler<Local | null>(CHAVE_LOCAL, null)); }, []);

  const carregar = useCallback(async (l: Local) => {
    setTempo(null); setChuva(null);
    const [t, c] = await Promise.all([get(`/tempo?lat=${l.lat}&lng=${l.lng}`), get(`/chuva?lat=${l.lat}&lng=${l.lng}&k=1`)]);
    setTempo(t); setChuva(c);
  }, []);

  useEffect(() => {
    if (!local) return;
    carregar(local);
    const t = setInterval(() => { if (!document.hidden) carregar(local); }, 10 * 60_000);
    return () => clearInterval(t);
  }, [local, carregar]);

  const escolher = (l: Local) => {
    setLocal(l); gravar(CHAVE_LOCAL, l);
    if (!l.gps) lembrar(CHAVE_RECENTES, l);
    setEscolhendo(false);
  };

  if (local === undefined) return <main className="page"><Skel h={28} w={160} /></main>;

  return (
    <main className="page">
      {!local ? (
        <section className="appear" style={{ paddingTop: 24 }}>
          <div className="t-label">Clima</div>
          <h1 className="t-hero" style={{ margin: "10px 0 8px" }}>Onde você está?</h1>
          <p className="muted t-body" style={{ margin: 0 }}>Veja o tempo agora, as próximas horas e os próximos dias.</p>
          <div style={{ display: "grid", gap: 10, marginTop: 28 }}>
            <UsarLocalizacao onLocal={escolher} />
            <button className="btn btn-ghost" onClick={() => setEscolhendo(true)}><Search aria-hidden /> Pesquisar local</button>
          </div>
        </section>
      ) : (
        <>
          <button className="loc-btn" onClick={() => setEscolhendo(true)} aria-label={`Local: ${local.nome}. Trocar local`}>
            {local.gps && <Navigation size={16} aria-hidden style={{ color: "var(--accent)" }} />}
            {local.nome}<ChevronDown aria-hidden />
          </button>
          {local.detalhe && <div className="t-cap" style={{ marginTop: -6 }}>{local.detalhe}</div>}
          <Tempo tempo={tempo} chuva={chuva} local={local} recarregar={() => carregar(local)} />
        </>
      )}
      {escolhendo && <LocationPicker onEscolher={escolher} onFechar={() => setEscolhendo(false)} />}
    </main>
  );
}

function UsarLocalizacao({ onLocal }: { onLocal: (l: Local) => void }) {
  const [estado, setEstado] = useState<string | null>(null);
  return (
    <>
      <button className="btn btn-primary" disabled={estado === "…"} onClick={async () => {
        setEstado("…");
        const p = await minhaPosicao();
        if ("erro" in p) { setEstado(`${p.erro} Pesquise uma localização para continuar.`); return; }
        const r = await get(`/local-reverso?lat=${p.lat}&lng=${p.lng}`);
        onLocal({ id: "gps", nome: r.nome ?? "Minha localização", detalhe: r.nome ? r.detalhe : undefined, lat: p.lat, lng: p.lng, gps: true });
        setEstado(null);
      }}>
        <LocateFixed aria-hidden /> {estado === "…" ? "Obtendo localização…" : "Usar minha localização"}
      </button>
      {estado && estado !== "…" && <p className="t-cap" role="alert" style={{ margin: 0 }}>{estado}</p>}
    </>
  );
}

export function LocationPicker({ onEscolher, onFechar }: { onEscolher: (l: Local) => void; onFechar: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<J | null>(null);
  const recentes = ler<Local[]>(CHAVE_RECENTES, []);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(async () => {
      ctrl.current?.abort(); ctrl.current = new AbortController();
      const r = await get(`/locais?q=${encodeURIComponent(q.trim())}`, ctrl.current.signal);
      if (!r.cancelado) setRes(r);
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <SearchSheet titulo="Pesquisar localização" placeholder="Cidade, bairro ou endereço" q={q} setQ={setQ} onClose={onFechar}>
      {q.trim().length < 2 ? (
        <>
          <div style={{ marginTop: 8 }}><UsarLocalizacao onLocal={onEscolher} /></div>
          {recentes.length > 0 && (
            <>
              <div className="t-label group-label">Recentes</div>
              <ul className="list">
                {recentes.map((l) => (
                  <li key={l.id}><button className="list-item" onClick={() => onEscolher(l)}>
                    <span className="ico"><Clock aria-hidden /></span>
                    <span className="main"><div className="t-head">{l.nome}</div>{l.detalhe && <div className="t-cap">{l.detalhe}</div>}</span>
                  </button></li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : !res ? (
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>{[0, 1, 2].map((i) => <Skel key={i} h={44} />)}</div>
      ) : res.erro ? (
        <ErrorState texto="Não foi possível pesquisar agora." />
      ) : !res.locais?.length ? (
        <EmptyState titulo="Nenhum local encontrado." texto="Tente o nome da cidade, do bairro ou um endereço." />
      ) : (
        <ul className="list" style={{ marginTop: 8 }}>
          {res.locais.map((l: J) => (
            <li key={l.id}><button className="list-item" onClick={() => onEscolher({ id: l.id, nome: l.nome, detalhe: l.detalhe, lat: l.lat, lng: l.lng })}>
              <span className="ico"><MapPin aria-hidden /></span>
              <span className="main"><div className="t-head">{l.nome}</div>{l.detalhe && <div className="t-cap">{l.detalhe}</div>}</span>
            </button></li>
          ))}
        </ul>
      )}
    </SearchSheet>
  );
}

function Tempo({ tempo, chuva, local, recarregar }: { tempo: J | null; chuva: J | null; local: Local; recarregar: () => void }) {
  if (!tempo) return (
    <div style={{ marginTop: 24, display: "grid", gap: 12 }} aria-busy="true">
      <Skel h={88} w={180} /><Skel h={22} w={200} /><Skel h={160} r={16} /><Skel h={110} r={16} />
    </div>
  );
  if (tempo.erro) return <ErrorState texto="Não foi possível atualizar o clima agora." tentar={recarregar} />;
  const a = tempo.calculado?.agora;
  const horas: J[] = tempo.calculado?.proximasHoras ?? [];
  const dias: J[] = tempo.calculado?.proximosDias ?? [];
  const h1 = horas[1];
  const est = chuva?.observado?.[0];
  const estPerto = est && distKm(local, est) <= 15 ? est : null; // pluviômetros só fazem sentido no Rio
  const minD = Math.min(...dias.map((d) => d.minC ?? 99)), maxD = Math.max(...dias.map((d) => d.maxC ?? -99));

  return (
    <div className="appear" key={`${local.lat},${local.lng}`}>
      <WeatherHero agora={a} hoje={dias[0]} local={local.nome} />

      <section className="section stag" style={{ ["--i" as string]: 1 }} aria-label="Condições">
        <span className="t-label">Condições</span>
        <div className="metrics">
          <Metrica Icone={Droplets} rotulo="Umidade" v={a?.umidadePct} u="%" />
          <Metrica Icone={Wind} rotulo="Vento" v={a?.ventoKmh == null ? null : Math.round(a.ventoKmh)} u={a?.ventoDirecao != null ? `km/h ${pontoCardeal(a.ventoDirecao)}` : "km/h"} />
          <Metrica Icone={CloudRain} rotulo="Chuva (1 h)" v={h1?.probabilidadeChuvaPct} u="%" />
          <Metrica Icone={Eye} rotulo="Visibilidade" v={h1?.visibilidadeM == null ? null : h1.visibilidadeM >= 10000 ? "10+" : dec(h1.visibilidadeM / 1000)} u="km" />
        </div>
      </section>

      {estPerto && (
        <section className="section stag" style={{ ["--i" as string]: 2 }} aria-label="Chuva medida">
          <span className="t-label">Chuva medida agora</span>
          <div className="surface" style={{ padding: 16 }}>
            <div className="row">
              <Thermometer size={20} aria-hidden style={{ color: "var(--info)" }} />
              <div className="main" style={{ flex: 1 }}>
                <div className="t-head num">{estPerto.mm.h01 == null ? "Sem medição" : `${dec(estPerto.mm.h01)} mm na última hora`}</div>
                <div className="t-cap">{estPerto.mm.m15 != null && `${dec(estPerto.mm.m15)} mm em 15 min · `}Pluviômetro {estPerto.nome}, a {fmtDist(estPerto.distanciaM / 1000)}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}><LastUpdated em={estPerto.medidoEm} fonte="Alerta Rio" velhoS={1200} /></div>
          </div>
        </section>
      )}

      {horas.length > 0 && (
        <section className="section stag" style={{ ["--i" as string]: 3 }} aria-label="Próximas horas">
          <span className="t-label">Próximas horas</span>
          <div className="surface hours" role="list">
            {horas.slice(0, 24).map((h, i) => (
              <div className="hour" role="listitem" key={h.inicio} style={{ ["--i" as string]: Math.min(i, 10) }} aria-label={`${i === 0 ? "Agora" : horaLocal(h.inicio)}: ${h.temperaturaC == null ? "sem dado" : Math.round(h.temperaturaC) + " graus"}, ${h.descricao?.texto ?? ""}, chance de chuva ${h.probabilidadeChuvaPct ?? "sem dado"}%`}>
                <span className="t-meta">{i === 0 ? "Agora" : horaLocal(h.inicio).slice(0, 2) + "h"}</span>
                <IconeTempo icone={h.descricao?.icone} dia={h.dia} />
                <span className="p num">{h.probabilidadeChuvaPct >= 20 ? `${h.probabilidadeChuvaPct}%` : ""}</span>
                <span className="t-head num">{h.temperaturaC == null ? "—" : `${Math.round(h.temperaturaC)}°`}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {dias.length > 0 && (
        <section className="section stag" style={{ ["--i" as string]: 4 }} aria-label="Próximos dias">
          <span className="t-label">Próximos dias</span>
          <div className="surface">
            {dias.map((d) => {
              const ini = ((d.minC - minD) / Math.max(1, maxD - minD)) * 100, fim = ((d.maxC - minD) / Math.max(1, maxD - minD)) * 100;
              return (
                <div className="day" key={d.data} aria-label={`${diaSemana(d.data)}: ${d.descricao?.texto ?? ""}, mínima ${Math.round(d.minC)}, máxima ${Math.round(d.maxC)}, chance de chuva ${d.probabilidadeChuvaPct ?? "sem dado"}%`}>
                  <span className="t-head">{diaSemana(d.data)}</span>
                  <IconeTempo icone={d.descricao?.icone} />
                  <span className="t-cap num" style={{ color: "var(--info)", fontWeight: 600 }}>{d.probabilidadeChuvaPct >= 20 ? `${d.probabilidadeChuvaPct}%` : ""}</span>
                  <span className="range" aria-hidden><i style={{ left: `${ini}%`, right: `${100 - fim}%`, ["--i" as string]: dias.indexOf(d) }} /></span>
                  <span className="t-head num" style={{ textAlign: "right" }}>{Math.round(d.maxC)}°<span className="t-cap"> {Math.round(d.minC)}°</span></span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="t-meta" style={{ margin: "20px 4px 0" }}>
        Previsão de modelo numérico (Open-Meteo, CC BY 4.0). Chuva medida: pluviômetros do Alerta Rio. <a href="/mais" style={{ textDecoration: "underline" }}>Sobre os dados</a>
      </p>
    </div>
  );
}

function Metrica({ Icone, rotulo, v, u }: { Icone: React.ElementType; rotulo: string; v: number | string | null | undefined; u: string }) {
  return (
    <div className="metric">
      <div className="t-meta row" style={{ gap: 6 }}><Icone size={14} aria-hidden />{rotulo}</div>
      <div className="v num">{v == null ? <span className="t-cap">Indisponível</span> : <>{v}<small>{u}</small></>}</div>
    </div>
  );
}
