"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Orbita } from "../ui/Geometria";
import { TriangleAlert, Search, LocateFixed, TrainFront, Warehouse, BusFront, MapPin, X, Clock, CloudRain, Gauge, ChevronRight, Info, Navigation } from "lucide-react";
import BottomSheet from "./BottomSheet";
import SearchSheet from "../ui/SearchSheet";
import { EmptyState, ErrorState, LastUpdated, Skel } from "../ui/estados";
import { J, distKm, fmtDist, get, gravar, ha, horaLocal, lembrar, ler, minhaPosicao } from "../ui/util";
import type { Ponto, VeiculoMapa } from "./TransitMap";
import { acumulado, mesmoDestino, projetar, type Trajeto } from "../../src/lib/trajeto";
import { NumeroRolante } from "../ui/Numero";
import estacoesJson from "../../src/data/estacoes-brt.json";

const ESTACOES = estacoesJson.estacoes;

const TransitMap = dynamic(() => import("./TransitMap"), { ssr: false, loading: () => <div className="map-carregando"><Orbita rotulo="Carregando o mapa" /></div> });

const K_PONTO = "monitora:mob:ponto", K_LINHA = "monitora:mob:linha", K_RECENTES = "monitora:mob:recentes", K_SENTIDO = "monitora:mob:sentido";

const rotuloTipo = (p: Ponto & { status?: string }) => p.status === "planejada" ? "Planejada · ainda não opera" : (p.tipo === "terminal" ? `Terminal BRT${p.corredor ? ` · ${p.corredor}` : ""}` : p.tipo === "estacao" ? `BRT ${p.corredor ?? ""}`.trim() : [p.rua, p.bairro].filter(Boolean).join(" · ") || "Parada de ônibus");
const IconePonto = ({ p }: { p: Pick<Ponto, "tipo"> }) => (p.tipo === "terminal" ? <Warehouse aria-hidden /> : p.tipo === "estacao" ? <TrainFront aria-hidden /> : <BusFront aria-hidden />);
const eta = (min: number) => Math.max(1, Math.round(min));

/** Memória da tela enquanto o app está aberto (sobrevive à troca de aba; recarregar a página volta ao que foi gravado no aparelho). */
const M: Partial<{ ponto: Ponto | null; linha: string | null; nivel: 0 | 1 | 2; info: J | null; chegada: J | null; veiculos: J | null; veiculoSel: string | null;
  seguindo: boolean; trajeto: Trajeto[] | null; sentido: string | null; modoLinha: "BRT" | "BUS" | null; linhaSemPonto: boolean; salvo: boolean; trajetoDe: string }> = {};
const K_MODO = "monitora:mob:modo";

export default function MobilidadeApp() {
  const [jaRestaurado] = useState(() => !!M.salvo);
  const [ponto, setPonto] = useState<Ponto | null>(() => M.ponto ?? null);
  const [linha, setLinha] = useState<string | null>(() => M.linha ?? null);
  const [buscando, setBuscando] = useState(false);
  const [nivel, setNivel] = useState<0 | 1 | 2>(() => M.nivel ?? 1);
  const [padB, setPadB] = useState(0);
  const [eu, setEu] = useState<{ lat: number; lng: number } | null>(null);
  const [perto, setPerto] = useState<J | null>(null);
  const [info, setInfo] = useState<J | null>(() => M.info ?? null);
  const [chegada, setChegada] = useState<J | null>(() => M.chegada ?? null);
  const [veiculos, setVeiculos] = useState<J | null>(() => M.veiculos ?? null);
  const [veiculoSel, setVeiculoSelS] = useState<string | null>(() => M.veiculoSel ?? null);
  const [seguindo, setSeguindo] = useState(() => M.seguindo ?? false);
  const [recentrar, setRecentrar] = useState(0);
  const setVeiculoSel = (id: string | null) => { setVeiculoSelS(id); setSeguindo(false); };
  const [clima, setClima] = useState<J | null>(null);
  const [rua, setRua] = useState<J | null>(null);
  const [trajeto, setTrajeto] = useState<Trajeto[] | null>(() => M.trajeto ?? null);
  // sentido escolhido = destino do trajeto oficial (trip_headsign do GTFS); null = todos
  const [sentido, setSentidoS] = useState<string | null>(() => M.sentido ?? null);
  // modo da linha acompanhada (vem do catálogo, via busca/estação): BRT ou BUS; null = o servidor decide pelo catálogo
  const [modoLinha, setModoLinha] = useState<"BRT" | "BUS" | null>(() => M.modoLinha ?? null);
  const setSentido = (s: string | null) => { setSentidoS(s); gravar(K_SENTIDO, s); setVeiculoSel(null); };
  useEffect(() => { gravar(K_MODO, modoLinha); }, [modoLinha]);
  const [, tique] = useState(0);
  const desktop = useRef(false);
  // Diagnóstico: ?debug=1 (qualquer ambiente) ou desenvolvimento local
  const [debug, setDebug] = useState(false);
  useEffect(() => { setDebug(process.env.NODE_ENV !== "production" || new URLSearchParams(location.search).get("debug") === "1"); }, []);
  const linhaSemPonto = useRef(M.linhaSemPonto ?? false);
  // continuidade entre abas: o estado vive na memória do app enquanto ele está aberto (trocar para Clima e voltar não zera nada)
  Object.assign(M, { ponto, linha, nivel, info, chegada, veiculos, veiculoSel, seguindo, trajeto, sentido, modoLinha, linhaSemPonto: linhaSemPonto.current, salvo: true });

  useEffect(() => {
    desktop.current = window.matchMedia("(min-width: 960px)").matches;
    if (!jaRestaurado) { setPonto(ler<Ponto | null>(K_PONTO, null)); setLinha(ler<string | null>(K_LINHA, null)); setSentidoS(ler<string | null>(K_SENTIDO, null)); setModoLinha(ler<"BRT" | "BUS" | null>(K_MODO, null)); }
    const t = setInterval(() => tique((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const escolherPonto = useCallback((p: Ponto) => {
    setPonto(p); setInfo(null); setChegada(null); setVeiculoSel(null);
    const manter = linhaSemPonto.current;
    linhaSemPonto.current = false;
    setLinha((l) => { const fica = manter ? l : null; gravar(K_LINHA, fica); return fica; });
    if (!manter) setVeiculos(null);
    gravar(K_PONTO, p); lembrar(K_RECENTES, p); setBuscando(false); setNivel(1);
  }, []);
  const acompanhar = (l: string | null, destino?: string | null) => { setModoLinha(l && ponto ? (ponto.fonte === "brt" ? "BRT" : "BUS") : null); setSentidoS(destino ?? null); gravar(K_SENTIDO, destino ?? null); setLinha(l); gravar(K_LINHA, l); setChegada(null); setVeiculos(null); setVeiculoSel(null); setNivel(l ? 0 : 1); };
  const escolherLinha = (l: string, modo?: "BRT" | "BUS") => {
    setModoLinha(modo ?? null);
    setBuscando(false); setVeiculoSel(null); setChegada(null); setVeiculos(null);
    setLinha(l); gravar(K_LINHA, l); setSentido(null);
    if (!ponto) { linhaSemPonto.current = true; setNivel(1); } else setNivel(0);
  };
  const limpar = () => { linhaSemPonto.current = false; setPonto(null); setLinha(null); gravar(K_PONTO, null); gravar(K_LINHA, null); setInfo(null); setVeiculos(null); setChegada(null); setNivel(1); };

  // estação/parada: linhas e próximos veículos (20 s)
  useEffect(() => {
    if (!ponto) return;
    let vivo = true;
    const carregar = async () => {
      const r = ponto.fonte === "brt" ? await get(`/estacoes/${encodeURIComponent(ponto.id)}`) : await get(`/paradas/${encodeURIComponent(ponto.id)}/linhas`);
      if (vivo) setInfo({ ...r, em: Date.now() });
    };
    carregar();
    get(`/tempo?lat=${ponto.lat}&lng=${ponto.lng}`).then((r) => vivo && setClima(r));
    get(`/agora?lat=${ponto.lat}&lng=${ponto.lng}`).then((r) => vivo && setRua(r));
    const t = setInterval(() => { if (!document.hidden && !linha) carregar(); }, 20_000);
    return () => { vivo = false; clearInterval(t); };
  }, [ponto, linha]);

  // trajeto oficial da linha (GTFS; hoje só BRT)
  useEffect(() => {
    const k = `${linha}|${modoLinha}`;
    if (M.trajetoDe !== k) setTrajeto(null); // voltando de outra aba com a mesma linha: mantém o desenho enquanto atualiza
    if (!linha) return;
    let vivo = true;
    get(`/linhas/${encodeURIComponent(linha)}/trajeto${modoLinha ? `?modo=${modoLinha}` : ""}`).then((r) => { if (vivo && r.trajetos?.length) { setTrajeto(r.trajetos); M.trajetoDe = k; } });
    return () => { vivo = false; };
  }, [linha, modoLinha]);

  // acompanhamento de linha: veículos + chegada (10 s)
  useEffect(() => {
    if (!linha) return;
    let vivo = true;
    const carregar = async () => {
      const [c, v] = await Promise.all([
        ponto ? get(`/chegada?linha=${encodeURIComponent(linha)}&lat=${ponto.lat}&lng=${ponto.lng}`) : Promise.resolve(null),
        get(`/linhas/${encodeURIComponent(linha)}/veiculos${modoLinha ? `?modo=${modoLinha}` : ""}`),
      ]);
      if (vivo) { if (c) setChegada({ ...c, em: Date.now() }); setVeiculos({ ...v, em: Date.now() }); }
    };
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 10_000);
    const volta = () => { if (!document.hidden) carregar(); };
    document.addEventListener("visibilitychange", volta);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, [ponto, linha, modoLinha]);

  const pertoDeMim = async () => {
    setPerto({ carregando: true });
    const p = await minhaPosicao();
    if ("erro" in p) { setPerto({ erro: `${p.erro} Pesquise uma estação para continuar.` }); return; }
    setEu(p);
    const [e, pa] = await Promise.all([get(`/estacoes?lat=${p.lat}&lng=${p.lng}&raio=3000&limite=5`), get(`/paradas?lat=${p.lat}&lng=${p.lng}&raio=500&limite=5`)]);
    setPerto({ estacoes: e.estacoes ?? [], paradas: pa.paradas ?? [] });
  };

  // sentidos da linha: destinos distintos do trajeto oficial
  const sentidos: string[] = useMemo(() => [...new Set((trajeto ?? []).map((t) => t.destino))], [trajeto]);
  const sentidoValido = sentido ? sentidos.find((d) => d === sentido) ?? sentidos.find((d) => mesmoDestino(d, sentido)) ?? null : null;
  const todos: J[] = veiculos?.observado ?? [];
  const lista: J[] = sentidoValido ? todos.filter((v) => mesmoDestino(v.destino, sentidoValido)) : todos;
  const trajetoVisivel = useMemo(() => (trajeto && sentidoValido ? trajeto.filter((t) => t.destino === sentidoValido) : trajeto), [trajeto, sentidoValido]);
  const veiculosMapa: VeiculoMapa[] = useMemo(() => lista.map((v) => ({
    id: v.id, fonte: v.fonte, linha: v.linha, destino: v.destino, lat: v.lat, lng: v.lng, rumo: v.rumo, parado: v.parado, idadeS: v.idadeS, estado: v.routeState ?? null, shapeId: v.shapeId ?? null,
    rotulo: `${v.fonte === "brt" ? "BRT" : "Ônibus"} da linha ${v.linha}${v.destino ? `, sentido ${v.destino}` : ""}, ${v.parado ? "parado" : `a ${v.velocidadeKmh} km/h`}${v.routeState === "OFF_ROUTE" ? ", fora do trajeto esperado" : v.routeState === "UNCERTAIN" ? ", posição incerta" : v.routeState === "STALE" ? ", posição desatualizada" : ""}, atualizado ${ha(v.em)}`,
  })), [veiculos, sentidoValido]); // eslint-disable-line react-hooks/exhaustive-deps

  // chegadas do sentido escolhido (a estimativa é por veículo; filtramos pelos veículos do sentido)
  const idsSentido = new Set(lista.map((v) => v.id));
  const chegadas: J[] = (chegada?.calculado?.chegadas ?? []).filter((c: J) => !sentidoValido || idsSentido.has(`${c.fonte}:${c.veiculo}`));
  const prox: J | null = sentidoValido ? chegadas[0] ?? null : chegada?.calculado?.proxima ?? null;
  const ehBrt = ponto?.fonte === "brt" || lista.some((v) => v.fonte === "brt");
  const sel = lista.find((v) => v.id === veiculoSel) ?? null;
  // ritmo pelo GPS: progresso real do veículo ao longo do trajeto (s) entre leituras distintas, últimos 10 min
  const amostras = useRef<{ id: string; pts: { t: number; s: number }[] }>({ id: "", pts: [] });
  const falta = useMemo(() => {
    const f = faltaDoTrajeto(sel, trajetoVisivel);
    if (!f || !sel) return f;
    const a = amostras.current;
    if (a.id !== sel.id) { a.id = sel.id; a.pts = []; }
    const t = Date.parse(sel.em);
    if (!a.pts.length || a.pts[a.pts.length - 1].t !== t) a.pts.push({ t, s: f.s });
    a.pts = a.pts.filter((p) => t - p.t <= 600_000);
    const p0 = a.pts[0], dt = (t - p0.t) / 1000, ds = f.s - p0.s;
    const etaGpsMin = dt >= 120 && ds > 50 ? (f.restM / (ds / dt)) / 60 : null;
    return { ...f, etaGpsMin };
  }, [sel, trajetoVisivel]);

  // Contexto de clima: chuva prevista perto do ponto nas próximas 2 h (previsão Open-Meteo).
  const avisoChuva = useMemo(() => {
    const hs: J[] = clima?.calculado?.proximasHoras?.slice(0, 3) ?? [];
    const h = hs.find((x) => (x.probabilidadeChuvaPct ?? 0) >= 60 || x.descricao?.icone === "chuva" || x.descricao?.icone === "tempestade");
    return h ? { hora: horaLocal(h.inicio), p: h.probabilidadeChuvaPct, texto: h.descricao?.texto } : null;
  }, [clima]);

  // ---------- cabeçalho do painel (visível mesmo recolhido) ----------
  const cabecalho = linha && seguindo && sel && falta ? (
    <div style={{ padding: "0 20px 14px" }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {etaFinal(falta) != null ? (
            <div className="eta appear" aria-live="polite"><span className="n num"><NumeroRolante valor={eta(etaFinal(falta)!)} /></span><span className="u">min</span></div>
          ) : <div className="t-title" aria-live="polite">{dec1(falta.km)} km</div>}
          <div className="t-cap" style={{ marginTop: 4 }}><b style={{ fontWeight: 600, color: "var(--text)" }}>Até {falta.destino}</b> · {falta.etaGpsMin != null ? "pelo ritmo atual (GPS)" : falta.etaProgMin != null ? "pelo ritmo programado da linha" : "sem ritmo para estimar ainda"} · veículo {sel.veiculo}</div>
        </div>
        <span className={`line-badge lg${ehBrt ? " brt" : ""}`} aria-label={`Linha ${linha}`}>{linha}</span>
      </div>
      <div style={{ marginTop: 8 }}><LastUpdated em={sel.em} fonte="GPS SMTR" velhoS={60} /></div>
    </div>
  ) : !ponto && linha ? (
    <div className="list-item" style={{ padding: "0 20px 12px", border: 0, minHeight: 0, gap: 12 }}>
      <span className={`line-badge lg${ehBrt ? " brt" : ""}`}>{linha}</span>
      <div className="main">
        <div className="t-title">Linha {linha}</div>
        <div className="t-cap">{sentidoValido ? `→ ${sentidoValido} · ` : ""}{!veiculos ? "Carregando veículos…" : `${lista.length} ${lista.length === 1 ? "veículo" : "veículos"} com GPS agora`}</div>
      </div>
      <button className="btn btn-icon" onClick={limpar} aria-label="Fechar linha"><X /></button>
    </div>
  ) : !ponto ? (
    <div style={{ padding: "0 20px 12px" }}>
      <div className="t-title">Onde você vai embarcar?</div>
      <div className="t-cap" style={{ marginTop: 2 }}>Escolha uma estação de BRT ou parada de ônibus.</div>
    </div>
  ) : linha ? (
    <div style={{ padding: "0 20px 14px" }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {!chegada ? <Skel h={48} w={140} /> : prox ? (
            <div className="eta appear" aria-live="polite"><span className="n num"><NumeroRolante valor={eta(prox.etaMin)} /></span><span className="u">min</span></div>
          ) : <div className="t-title" aria-live="polite">Sem estimativa agora</div>}
          <div className="t-cap" style={{ marginTop: 4 }}>{sentidoValido ? <b style={{ fontWeight: 600, color: "var(--text)" }}>→ {sentidoValido} · </b> : null}{prox ? `Chegada estimada em ${ponto.nome}` : `Nenhum veículo ${sentidoValido ? "neste sentido" : "da linha"} se aproximando de ${ponto.nome}`}</div>
        </div>
        <span className={`line-badge lg${ehBrt ? " brt" : ""}`} aria-label={`Linha ${linha}`}>{linha}</span>
      </div>
      <div style={{ marginTop: 8 }}><LastUpdated em={veiculos?.em} fonte="GPS SMTR" velhoS={45} /></div>
    </div>
  ) : (
    <div className="list-item" style={{ padding: "0 20px 12px", border: 0, minHeight: 0, gap: 12 }}>
      <span className={`ico ${ponto.tipo}`}><IconePonto p={ponto} /></span>
      <div className="main">
        <div className="t-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ponto.nome}</div>
        <div className="t-cap">{rotuloTipo(ponto)}</div>
      </div>
      <button className="btn btn-icon" onClick={limpar} aria-label="Fechar estação"><X /></button>
    </div>
  );

  return (
    <div className="mob">
      <TransitMap ponto={ponto} veiculos={veiculosMapa} veiculoSel={veiculoSel} eu={eu}
        onVeiculo={(id) => { setVeiculoSel(id); if (id) setNivel((n) => (n === 0 ? 1 : n)); }}
        onEstacao={(id) => {
          const e = ESTACOES.find((x) => x.id === id);
          if (e) escolherPonto({ id: e.id, nome: e.nome, tipo: e.tipo as "estacao" | "terminal", fonte: "brt", lat: e.lat, lng: e.lng, corredor: e.corredor });
        }}
        pad={{ bottom: desktop.current ? 0 : padB, left: desktop.current ? 416 : 0 }}
        trajetos={trajetoVisivel}
        debug={debug && sel ? { gps: [sel.lng, sel.lat], proj: sel.projecao ?? null, shapeId: sel.shapeId ?? null } : null}
        enquadrarChave={`${ponto?.id ?? ""}|${linha ?? ""}`}
        seguir={seguindo && !!sel} recentrar={recentrar} />

      {seguindo && sel && <DialSeguindo v={sel} falta={falta} onParar={() => setSeguindo(false)} onCentrar={() => setRecentrar((n) => n + 1)} />}

      <div className="map-top">
        <button className="map-search" onClick={() => setBuscando(true)} aria-label="Pesquisar estação, terminal ou linha">
          <Search aria-hidden /><span>{ponto ? ponto.nome : "Estação, terminal ou linha"}</span>
        </button>
        <button className={`map-fab${perto?.carregando ? " buscando" : ""}`} onClick={pertoDeMim} aria-label="Usar minha localização" aria-busy={!!perto?.carregando}><LocateFixed /></button>
      </div>

      <BottomSheet resumo={ponto && linha ? 190 : 150} nivel={nivel} setNivel={setNivel} onAltura={setPadB} cabecalho={cabecalho}>
        {sel && <VeiculoCard v={sel} ponto={ponto} chegada={chegada} falta={falta} seguindo={seguindo} onSeguir={() => { setSeguindo((x) => !x); setNivel(0); }} onFechar={() => setVeiculoSel(null)} />}
        {sel && debug && <PainelDebug v={sel} />}

        {!ponto && linha && (
          <>
            {sentidos.length > 1 && <SeletorSentido sentidos={sentidos} valor={sentidoValido} onChange={setSentido} />}
            <span className="t-label">Onde você vai embarcar?</span>
            <p className="t-cap" style={{ margin: "6px 0 12px" }}>Escolha a estação ou parada para ver a chegada estimada desta linha.</p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setBuscando(true)}><Search aria-hidden /> Escolher estação ou parada</button>
            {veiculos?.erro && <ErrorState texto="Não foi possível obter dados atualizados desta linha." />}
            {veiculos && !veiculos.erro && !lista.length && <EmptyState icone={BusFront} titulo="Nenhum veículo desta linha com GPS agora." texto="A localização pode voltar em instantes." />}
            {veiculos?.operacao && <div style={{ marginTop: 18 }}><Operacao op={veiculos.operacao} sentido={sentidoValido} /></div>}
            <div style={{ marginTop: 14 }}><LastUpdated em={veiculos?.em} fonte="GPS SMTR" velhoS={45} /></div>
          </>
        )}

        {!ponto && !linha && (
          <>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setBuscando(true)}><Search aria-hidden /> Pesquisar estação ou terminal</button>
            {!perto && <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={pertoDeMim}><LocateFixed aria-hidden /> Estações perto de mim</button>}
            {perto?.carregando && <div style={{ marginTop: 16, display: "grid", gap: 12 }}><Skel h={52} /><Skel h={52} /></div>}
            {perto?.erro && <p className="t-cap" role="alert">{perto.erro}</p>}
            {perto?.estacoes && (
              <div className="section">
                <span className="t-label">Perto de você</span>
                {perto.estacoes.length + perto.paradas.length === 0 ? <EmptyState titulo="Nenhuma estação por perto." texto="Pesquise pelo nome da estação ou terminal." /> : (
                  <ul className="list">
                    {[...perto.estacoes.map((e: J) => ({ ...e, fonte: "brt" })), ...perto.paradas.slice(0, 3).map((p: J) => ({ ...p, tipo: "parada", fonte: "sppo" }))].map((p: J) => (
                      <li key={p.id}><button className="list-item" onClick={() => escolherPonto(p as Ponto)}>
                        <span className={`ico ${p.tipo}`}><IconePonto p={p as Ponto} /></span>
                        <span className="main"><div className="t-head">{p.nome}</div><div className="t-cap">{rotuloTipo(p as Ponto)}</div></span>
                        <span className="t-cap num">{fmtDist(p.distanciaM / 1000)}</span>
                      </button></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Recentes onEscolher={escolherPonto} />
          </>
        )}

        {ponto && !linha && <Estacao ponto={ponto} info={info} onLinha={acompanhar} />}

        {ponto && linha && (
          <>
            {sentidos.length > 1 && <SeletorSentido sentidos={sentidos} valor={sentidoValido} onChange={setSentido} />}
            {chegadas.length > 1 && (
              <div className="t-cap" style={{ marginBottom: 12 }}>
                Depois: {chegadas.slice(1, 3).map((c: J) => `~${eta(c.etaMin)} min`).join(" · ")}
              </div>
            )}
            {avisoChuva && (
              <div className="notice appear" style={{ marginBottom: 12 }}>
                <CloudRain className="sev-info" aria-hidden />
                <div><div className="t-head">{avisoChuva.texto ?? "Chuva"} prevista perto de {ponto.nome}</div>
                  <div className="t-cap">Por volta das {avisoChuva.hora}{avisoChuva.p != null ? ` · ${avisoChuva.p}% de chance` : ""} · previsão Open-Meteo</div></div>
              </div>
            )}
            {veiculos?.operacao && <Operacao op={veiculos.operacao} sentido={sentidoValido} />}
            <span className="t-label">Veículos da linha</span>
            {!veiculos ? <div style={{ display: "grid", gap: 12, marginTop: 10 }}><Skel h={52} /><Skel h={52} /></div>
              : veiculos.erro ? <ErrorState texto="Não foi possível obter dados atualizados desta linha." />
              : !lista.length ? <EmptyState icone={BusFront} titulo="Nenhum veículo desta linha com GPS agora." texto="A localização pode voltar em instantes." />
              : (
                <ul className="list">
                  {lista.map((v): J => ({ ...v, k: distKm(ponto, { lat: v.lat, lng: v.lng }) })).sort((a, b) => a.k - b.k).slice(0, 5).map((v) => (
                    <li key={v.id}><button className="list-item" onClick={() => { setVeiculoSel(v.id); setNivel(1); }} aria-label={`Veículo ${v.veiculo}, a ${fmtDist(v.k)}`}>
                      <span className="ico" style={{ color: v.fonte === "brt" ? "var(--text)" : "var(--text-2)" }}><BusFront aria-hidden /></span>
                      <span className="main">
                        <div className="t-head num">{fmtDist(v.k)} <span className="t-cap">de {ponto.nome}</span></div>
                        <div className="t-cap">{v.destino ? `Sentido ${v.destino} · ` : ""}Veículo {v.veiculo}</div>
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <div className="t-head num">{v.parado ? "Parado" : `${v.velocidadeKmh} km/h`}</div>
                        <div className="t-meta">{ha(v.em)}</div>
                      </span>
                    </button></li>
                  ))}
                </ul>
              )}
            {veiculos?.resumo && (veiculos.resumo.OFF_ROUTE + veiculos.resumo.UNCERTAIN + veiculos.resumo.STALE) > 0 && (
              <p className="t-meta" style={{ marginTop: 8 }}>
                Comparado ao trajeto oficial: {[
                  veiculos.resumo.OFF_ROUTE && `${veiculos.resumo.OFF_ROUTE} fora do trajeto`,
                  veiculos.resumo.UNCERTAIN && `${veiculos.resumo.UNCERTAIN} com posição incerta`,
                  veiculos.resumo.STALE && `${veiculos.resumo.STALE} sem atualização recente`,
                ].filter(Boolean).join(" · ")}. Eles aparecem no mapa onde o GPS informou, com contorno tracejado.
              </p>
            )}
            <div className="section">
              <span className="t-label">No caminho</span>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <TriangleAlert size={20} aria-hidden style={{ color: "var(--text-3)", flex: "none", marginTop: 2 }} />
                <div><div className="t-head">Ocorrências indisponíveis</div>
                  <div className="t-cap">Acidentes e interdições dependem da fonte aberta do COR, que não está respondendo. Quando voltar, mostramos as que ficarem a até 800 m do trajeto.</div></div>
              </div>
            </div>
            <div className="section">
              <span className="t-label">Na região</span>
              <Rua rua={rua} />
            </div>
            <div className="row" style={{ marginTop: 20, gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => acompanhar(null)}>Trocar linha</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={limpar}>Encerrar</button>
            </div>
            <p className="t-meta" style={{ marginTop: 16 }}>
              <Info size={12} aria-hidden style={{ verticalAlign: "-2px" }} /> A chegada é uma estimativa calculada pelo Monitora com base nos dados disponíveis e não representa um horário oficial da operação. <a href="/mais" style={{ textDecoration: "underline" }}>Metodologia</a>
            </p>
          </>
        )}
      </BottomSheet>

      {buscando && <TransitSearch onEscolher={escolherPonto} onLinha={escolherLinha} comLinhas={!(linha && !ponto)} onFechar={() => setBuscando(false)} />}
    </div>
  );
}

function SeletorSentido({ sentidos, valor, onChange }: { sentidos: string[]; valor: string | null; onChange: (s: string | null) => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <span className="t-label">Sentido</span>
      <div className="sentidos" role="radiogroup" aria-label="Sentido da linha">
        {sentidos.map((d) => (
          <button key={d} role="radio" aria-checked={valor === d} className={`sentido${valor === d ? " on" : ""}`} onClick={() => onChange(valor === d ? null : d)}>
            <span aria-hidden>→</span> {d}
          </button>
        ))}
      </div>
      {!valor && <p className="t-meta" style={{ margin: "6px 2px 0" }}>Mostrando os dois sentidos. Toque para escolher.</p>}
    </div>
  );
}

function Estacao({ ponto, info, onLinha }: { ponto: Ponto; info: J | null; onLinha: (l: string, destino?: string | null) => void }) {
  const brt = ponto.fonte === "brt";
  const linhas: J[] = (brt ? info?.oficial?.linhas : info?.observado) ?? [];
  const proximos: J[] = info?.calculado?.proximos ?? [];
  if (!info) return <div style={{ display: "grid", gap: 12 }} aria-busy="true"><Skel h={18} w={140} /><Skel h={60} /><Skel h={60} /></div>;
  if (info.erro) return <ErrorState texto={brt ? "Não foi possível carregar esta estação agora." : "Não foi possível carregar esta parada agora."} />;
  return (
    <div className="appear">
      {brt && (
        <>
          <span className="t-label">Próximos BRTs</span>
          {!proximos.length ? (
            <p className="t-cap" style={{ margin: "8px 0 0" }}>Nenhum BRT se aproximando desta estação agora.</p>
          ) : (
            <ul className="list">
              {proximos.slice(0, 6).map((p) => (
                <li key={p.linha + p.veiculo}><button className="list-item" onClick={() => onLinha(p.linha, p.destino ?? null)} aria-label={`Acompanhar BRT da linha ${p.linha}${p.destino ? `, sentido ${p.destino}` : ""}, chega em cerca de ${eta(p.etaMin)} minutos`}>
                  <span className="line-badge brt">{p.linha}</span>
                  <span className="main"><div className="t-head">{p.destino ? `→ ${p.destino}` : `Linha ${p.linha}`}</div><div className="t-cap">a {fmtDist(p.distanciaM / 1000)} · GPS {ha(p.ultimaLeitura)}</div></span>
                  <span className="t-head num">{eta(p.etaMin)} min</span>
                  <ChevronRight size={18} aria-hidden style={{ color: "var(--text-3)" }} />
                </button></li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="section">
        <span className="t-label">{brt ? "Linhas que param aqui" : "Linhas vistas aqui na última hora"}</span>
        {!linhas.length ? <p className="t-cap" style={{ margin: 0 }}>{brt ? "O GTFS oficial não lista linhas de BRT parando nesta estação." : "Nenhum veículo com GPS passou por aqui na última hora."}</p>
        : brt ? (
          <ul className="list">
            {linhas.map((l) => (
              <li key={l.linha} className="linha-est">
                <div className="row" style={{ gap: 10 }}>
                  <span className="line-badge brt">{l.linha}</span>
                  <div style={{ minWidth: 0, flex: 1 }}><div className="t-head">{l.nome}</div>
                    <div className="t-cap">{l.servico ?? "BRT"}{l.veiculosUltimaHora ? ` · ${l.veiculosUltimaHora} com GPS aqui na última hora` : ""}</div></div>
                </div>
                <div className="sentidos-mini">
                  {l.sentidos.map((d: string) => (
                    <button key={d} className="sentido mini" onClick={() => onLinha(l.linha, d)} aria-label={`Acompanhar linha ${l.linha}, sentido ${d}`}><span aria-hidden>→</span> {d}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="chip-row">
            {linhas.map((l) => (
              <button key={`${l.fonte}${l.linha}`} className="chip" onClick={() => onLinha(String(l.linha), l.destinos?.[0] ?? null)} aria-label={`Acompanhar linha ${l.linha}`}>
                <span className="line-badge" style={{ height: 22, minWidth: 30, fontSize: 12 }}>{l.linha}</span>
                {l.destinos?.[0] ? `→ ${l.destinos[0]}` : `${l.veiculos} veíc.`}
              </button>
            ))}
          </div>
        )}
        <p className="t-meta" style={{ marginTop: 10 }}>{brt ? "Lista oficial do GTFS da SMTR (paradas programadas)." : "Linhas com GPS perto deste ponto. Não é a lista oficial da operação."}</p>
      </div>
      <div style={{ marginTop: 14 }}><LastUpdated em={info.em} fonte={brt ? "GTFS + GPS SMTR" : "GPS SMTR"} velhoS={60} /></div>
    </div>
  );
}

/** Diagnóstico do veículo selecionado (modo debug): tudo que explica por que ele está onde está. */
function PainelDebug({ v }: { v: J }) {
  const linhas: [string, unknown][] = [
    ["vehicle_id", v.veiculo], ["mode", v.modo], ["route", v.linha], ["route_id", v.routeId], ["trip_id", v.tripId], ["shape_id (GPS)", v.shapeIdGps],
    ["associação", v.associacao], ["shape usado", v.shapeId], ["destino", v.destino], ["sentido", v.sentido],
    ["lat, lng", `${v.lat}, ${v.lng}`], ["velocidade", `${v.velocidadeKmh} km/h`], ["rumo GPS", v.rumo == null ? "—" : `${v.rumo}° (${v.rumoOrigem})`],
    ["rumo do trecho", v.rumoTrecho == null ? "—" : `${v.rumoTrecho}° (trecho ${v.trecho})`], ["Δ rumo", v.headingDeltaDeg == null ? "—" : `${v.headingDeltaDeg}°`],
    ["distância ao shape", v.distanciaTrajetoM == null ? "—" : `${v.distanciaTrajetoM} m`], ["estado", `${v.routeState} (${v.confidence})`], ["motivo", v.motivo],
    ["GPS em", new Date(v.em).toLocaleTimeString("pt-BR")], ["idade", `${v.idadeS} s`], ["ignição desligada", v.ignicaoDesligada == null ? "—" : String(v.ignicaoDesligada)],
  ];
  return (
    <details className="debug" open>
      <summary className="t-label">Diagnóstico</summary>
      <dl>{linhas.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val == null || val === "" ? "—" : String(val)}</dd></div>)}</dl>
      <p className="t-meta">Mapa: ponto vermelho = GPS real; ponto teal = projeção no shape; tracejado = distância; amarelo = shape usado.</p>
    </details>
  );
}

function VeiculoCard({ v, ponto, chegada, falta, seguindo, onSeguir, onFechar }: { v: J; ponto: Ponto | null; chegada: J | null; falta: Falta | null; seguindo: boolean; onSeguir: () => void; onFechar: () => void }) {
  const c = (chegada?.calculado?.chegadas ?? []).find((x: J) => `${x.fonte}:${x.veiculo}` === v.id);
  return (
    <div className="surface appear" style={{ padding: 16, marginBottom: 16 }} role="dialog" aria-label={`Veículo da linha ${v.linha}`}>
      <div className="row">
        <span className={`line-badge${v.fonte === "brt" ? " brt" : ""}`}>{v.linha}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-head">{v.destino ? `Sentido ${v.destino}` : v.fonte === "brt" ? "BRT" : "Ônibus"}</div>
          <div className="t-cap">Veículo {v.veiculo}</div>
        </div>
        <button className="btn btn-icon" onClick={onFechar} aria-label="Fechar"><X /></button>
      </div>
      <div className="row" style={{ marginTop: 14, gap: 20 }}>
        {c && ponto && <div><div className="t-hero num" style={{ fontSize: 32 }}>{eta(c.etaMin)} min</div><div className="t-cap">até {ponto.nome}</div></div>}
        <div><div className="t-head num"><Gauge size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> {v.parado ? "Parado" : `${v.velocidadeKmh} km/h`}</div>
          {ponto && <div className="t-cap">{fmtDist(distKm(ponto, { lat: v.lat, lng: v.lng }))} de {ponto.nome}</div>}</div>
      </div>
      {falta && (
        <div className="viagem" aria-label={`Faltam ${dec1(falta.km)} km até ${falta.destino}`}>
          <div className="viagem-barra" aria-hidden><i style={{ width: `${Math.round(falta.pct * 100)}%` }} /><b style={{ left: `${Math.round(falta.pct * 100)}%` }} /></div>
          <div className="t-cap">Faltam <b className="num">{dec1(falta.km)} km</b> até {falta.destino} · {Math.round(falta.pct * 100)}% do trajeto</div>
          {(falta.etaGpsMin != null || falta.etaProgMin != null) && (
            <div className="t-cap">Chegada ao terminal: {[
              falta.etaGpsMin != null && <span key="g"><b className="num">~{eta(falta.etaGpsMin)} min</b> pelo ritmo atual (GPS)</span>,
              falta.etaProgMin != null && <span key="p"><b className="num">~{eta(falta.etaProgMin)} min</b> pelo programado</span>,
            ].filter(Boolean).reduce((acc: React.ReactNode[], x, i) => (i ? [...acc, " · ", x] : [x]), [])}</div>
          )}
        </div>
      )}
      <button className={`btn ${seguindo ? "btn-ghost" : "btn-primary"}`} style={{ width: "100%", marginTop: 12 }} onClick={onSeguir} aria-pressed={seguindo}>
        <Navigation aria-hidden /> {seguindo ? "Parar de acompanhar" : "Acompanhar no mapa"}
      </button>
      <div style={{ marginTop: 10 }}><LastUpdated em={v.em} fonte="GPS SMTR" velhoS={60} /></div>
      {v.rumo === null && <div className="t-meta" style={{ marginTop: 6 }}>Direção indisponível para este veículo.</div>}
      {v.routeState === "OFF_ROUTE" && <div className="notice" style={{ marginTop: 10, boxShadow: "none", background: "var(--surface-2)" }}><span className="t-cap">Fora do trajeto esperado: a {fmtDist(v.distanciaTrajetoM / 1000)} do trajeto oficial. Mostramos a posição do GPS como veio.</span></div>}
      {v.routeState === "UNCERTAIN" && <div className="t-meta" style={{ marginTop: 6 }}>Posição incerta: {v.motivo}.</div>}
    </div>
  );
}

function Rua({ rua }: { rua: J | null }) {
  const t = rua?.calculado?.total;
  if (!rua) return <Skel h={44} />;
  if (rua.erro || t?.velocidadeMedia == null) return <p className="t-cap" style={{ margin: 0 }}>Sem ônibus suficientes por perto para estimar o ritmo da via.</p>;
  return (
    <div className="row">
      <Gauge size={20} aria-hidden style={{ color: "var(--text-2)" }} />
      <div><div className="t-head num">Ônibus a {Math.round(t.velocidadeMedia)} km/h em média</div>
        <div className="t-cap">{t.nVeiculos} veículos num raio de 400 m · últimos 15 min · indicador indireto, não é a velocidade dos carros</div></div>
    </div>
  );
}

function Recentes({ onEscolher }: { onEscolher: (p: Ponto) => void }) {
  const [r, setR] = useState<Ponto[]>([]);
  useEffect(() => { setR(ler<Ponto[]>(K_RECENTES, [])); }, []);
  if (!r.length) return null;
  return (
    <div className="section">
      <span className="t-label">Recentes</span>
      <ul className="list">
        {r.map((p) => (
          <li key={p.id}><button className="list-item" onClick={() => onEscolher(p)}>
            <span className="ico"><Clock aria-hidden /></span>
            <span className="main"><div className="t-head">{p.nome}</div><div className="t-cap">{rotuloTipo(p)}</div></span>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

/** Busca especializada: BRT consulta SÓ o catálogo de estações/terminais; Ônibus consulta SÓ a camada de paradas. */
function TransitSearch({ onEscolher, onLinha, comLinhas, onFechar }: { onEscolher: (p: Ponto) => void; onLinha: (l: string, modo: "BRT" | "BUS") => void; comLinhas: boolean; onFechar: () => void }) {
  const [q, setQ] = useState("");
  const [modo, setModo] = useState<"brt" | "sppo">("brt");
  const [res, setRes] = useState<J | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    const termo = q.trim();
    if (termo.length < (/^\d/.test(termo) ? 1 : 2)) { setRes(null); return; }
    const t = setTimeout(async () => {
      ctrl.current?.abort(); ctrl.current = new AbortController();
      const sinal = ctrl.current.signal;
      const [r, l] = await Promise.all([
        modo === "brt" ? get(`/estacoes?q=${encodeURIComponent(termo)}&limite=30`, sinal) : get(`/paradas?q=${encodeURIComponent(termo)}&limite=20`, sinal),
        comLinhas && termo.length <= 8 ? get(`/linhas?q=${encodeURIComponent(termo)}&modo=${modo === "brt" ? "BRT" : "BUS"}&limite=12`, sinal) : Promise.resolve(null),
      ]);
      if (!r.cancelado) setRes({ ...r, linhas: l?.linhas ?? [] });
    }, 160);
    return () => clearTimeout(t);
  }, [q, modo]);

  const estacoes: J[] = modo === "brt" ? (res?.estacoes ?? []).filter((e: J) => e.tipo === "estacao") : [];
  const terminais: J[] = modo === "brt" ? (res?.estacoes ?? []).filter((e: J) => e.tipo === "terminal") : [];
  const paradas: J[] = modo === "sppo" ? res?.paradas ?? [] : [];
  // só linhas do modo da aba (classificação oficial feita no servidor)
  const linhas: J[] = (res?.linhas ?? []).filter((l: J) => l.modo === (modo === "brt" ? "BRT" : "BUS"));
  const vazio = res && !res.erro && !linhas.length && !estacoes.length && !terminais.length && !paradas.length;

  const Item = ({ p, ponto }: { p: J; ponto: Ponto }) => (
    <li><button className="list-item" onClick={() => onEscolher(ponto)}>
      <span className={`ico ${ponto.tipo}`}><IconePonto p={ponto} /></span>
      <span className="main"><div className="t-head">{p.nome}</div><div className="t-cap">{rotuloTipo(ponto)}</div></span>
    </button></li>
  );

  return (
    <SearchSheet titulo={modo === "brt" ? "Pesquisar estação ou terminal" : "Pesquisar parada de ônibus"} placeholder={modo === "brt" ? "Estação, terminal ou linha (ex.: 22)" : "Parada ou linha (ex.: 474)"} q={q} setQ={setQ} onClose={onFechar}>
      <div className="chip-row" role="tablist" aria-label="Tipo de transporte" style={{ marginTop: 6 }}>
        <button role="tab" aria-selected={modo === "brt"} className={`chip${modo === "brt" ? " on" : ""}`} onClick={() => setModo("brt")}><TrainFront size={16} aria-hidden /> BRT</button>
        <button role="tab" aria-selected={modo === "sppo"} className={`chip${modo === "sppo" ? " on" : ""}`} onClick={() => setModo("sppo")}><BusFront size={16} aria-hidden /> Ônibus</button>
      </div>
      {!q.trim() ? (
        <EmptyState icone={MapPin} titulo={modo === "brt" ? "Digite o nome da estação ou terminal" : "Digite o nome da parada"} texto={modo === "brt" ? "156 estações e terminais dos corredores Transoeste, Transcarioca, Transolímpica e Transbrasil." : "Paradas de ônibus municipais da Prefeitura."} />
      ) : !res ? (
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>{[0, 1, 2].map((i) => <Skel key={i} h={44} />)}</div>
      ) : res.erro ? <ErrorState texto="Não foi possível pesquisar agora." />
      : vazio ? <EmptyState titulo={modo === "brt" ? "Nenhuma estação ou terminal encontrado." : "Nenhuma parada encontrada."} texto={modo === "brt" ? "Tente pesquisar pelo nome da estação ou terminal." : "Tente o nome da parada ou do bairro."} />
      : (
        <>
          {linhas.length > 0 && <><div className="t-label group-label">{modo === "brt" ? "Linhas de BRT" : "Linhas de ônibus"}</div><ul className="list">{linhas.map((l) => (
            <li key={l.modo + l.linha}><button className="list-item" onClick={() => onLinha(l.linha, l.modo)} aria-label={`Linha ${l.linha}${l.nome ? `, ${l.nome}` : ""}, ${l.veiculosAgora} veículos agora`}>
              <span className={`line-badge${l.modo === "BRT" ? " brt" : ""}`}>{l.linha}</span>
              <span className="main"><div className="t-head">{l.nome ?? (l.destinos.length ? l.destinos.join(" ↔ ") : `Linha ${l.linha}`)}</div><div className="t-cap">{l.modo === "BRT" ? (l.servico ? `BRT ${l.servico}` : "BRT") : "Ônibus"} · {l.veiculosAgora} {l.veiculosAgora === 1 ? "veículo" : "veículos"} com GPS agora</div></span>
              <ChevronRight size={18} aria-hidden style={{ color: "var(--text-3)" }} />
            </button></li>))}</ul></>}
          {estacoes.length > 0 && <><div className="t-label group-label">Estações</div><ul className="list">{estacoes.map((e) => <Item key={e.id} p={e} ponto={{ id: e.id, nome: e.nome, tipo: "estacao", fonte: "brt", lat: e.lat, lng: e.lng, corredor: e.corredor, status: e.status } as Ponto} />)}</ul></>}
          {terminais.length > 0 && <><div className="t-label group-label">Terminais</div><ul className="list">{terminais.map((e) => <Item key={e.id} p={e} ponto={{ id: e.id, nome: e.nome, tipo: "terminal", fonte: "brt", lat: e.lat, lng: e.lng, corredor: e.corredor, status: e.status } as Ponto} />)}</ul></>}
          {paradas.length > 0 && <><div className="t-label group-label">Paradas</div><ul className="list">{paradas.map((p) => <Item key={p.id} p={p} ponto={{ id: p.id, nome: p.nome, tipo: "parada", fonte: "sppo", lat: p.lat, lng: p.lng, bairro: p.bairro, rua: p.rua }} />)}</ul></>}
        </>
      )}
    </SearchSheet>
  );
}

const dec1 = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: x < 10 ? 1 : 0 });
const fmtIntervalo = (s: number) => s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;

/** Operação da linha: PROGRAMADO (GTFS frequencies, fonte externa) × RODANDO AGORA (GPS, calculado). */
function Operacao({ op, sentido }: { op: J; sentido: string | null }) {
  const sentidos: J[] = (op.sentidos ?? []).filter((s: J) => !sentido || mesmoDestino(s.destino, sentido));
  if (!sentidos.length) return null;
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return (
    <section className="operacao" aria-label="Operação da linha agora">
      <span className="t-label">Operação agora{op.tipoDia ? ` · ${op.tipoDia}` : ""}</span>
      {sentidos.map((s: J) => {
        const p = s.programado, o = s.observado;
        const perfil: (number | null)[] = p?.perfil ?? [];
        const max = Math.max(1, ...perfil.map((x) => x ?? 0));
        return (
          <div className="op-sentido" key={s.sentido}>
            {sentidos.length > 1 && <div className="t-cap op-dest">→ {s.destino}</div>}
            <div className="op-nums">
              <div><span className="op-n num">{o.rodando}</span><span className="t-cap">rodando agora<br />no trajeto (GPS)</span></div>
              <div><span className="op-n num">{p?.intervaloS ? fmtIntervalo(p.intervaloS) : "—"}</span><span className="t-cap">{p?.intervaloS ? <>intervalo programado<br />{p.partidasPorHora}/h até {p.faixa?.fim}</> : <>sem partidas<br />programadas agora</>}</span></div>
              <div><span className="op-n num">{o.espacamentoMedioKm == null ? "—" : `${dec1(o.espacamentoMedioKm)} km`}</span><span className="t-cap">entre um ônibus<br />e outro (média)</span></div>
            </div>
            {perfil.some((x) => x != null) && (
              <div className="op-perfil" aria-label={`Partidas programadas por hora ao longo do dia; agora ${perfil[hora] ?? 0} por hora`}>
                {perfil.map((x, h) => <i key={h} className={h === hora ? "agora" : ""} style={{ height: `${x == null ? 0 : Math.max(6, (x / max) * 100)}%`, ["--i" as string]: h }} title={`${h}h: ${x ?? 0}/h`} />)}
                <div className="op-eixo t-meta"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
              </div>
            )}
          </div>
        );
      })}
      <p className="t-meta" style={{ marginTop: 6 }}>Programado: GTFS da SMTR (frequencies.txt). Rodando: veículos com GPS casados ao trajeto oficial agora — garagem e sem sinal não contam.</p>
    </section>
  );
}

interface Falta { km: number; pct: number; destino: string; s: number; restM: number; etaProgMin: number | null; etaGpsMin?: number | null }
/** Calculado: quanto falta do trajeto oficial até o fim da viagem (só para veículo casado ao trajeto). */
function faltaDoTrajeto(v: J | null, trajetos: Trajeto[] | null | undefined): Falta | null {
  if (!v || (v.routeState !== "ON_ROUTE" && v.routeState !== "UNCERTAIN")) return null;
  const t = (trajetos ?? []).find((x) => x.shapeId && x.shapeId === v.shapeId);
  if (!t) return null;
  const acc = acumulado(t.coords), e = projetar(v.lat, v.lng, t.coords, acc);
  if (!e) return null;
  const total = acc[acc.length - 1], restM = total - e.s;
  // ritmo programado: duração da viagem no GTFS distribuída ao longo do shape
  const etaProgMin = t.duracaoProgramadaS ? (restM / total) * t.duracaoProgramadaS / 60 : null;
  return { km: restM / 1000, pct: e.s / total, destino: t.destino, s: e.s, restM, etaProgMin };
}

/** Mostrador do acompanhamento: número da linha no centro, anel que esvazia até o destino final; bolinha × para parar. */
function DialSeguindo({ v, falta, onParar, onCentrar }: { v: J; falta: Falta | null; onParar: () => void; onCentrar: () => void }) {
  const R = 25, C = 2 * Math.PI * R, resta = falta ? 1 - falta.pct : null;
  return (
    <div className="dial-seg appear" role="status" aria-label={`Acompanhando linha ${v.linha}, veículo ${v.veiculo}${falta ? `; faltam ${dec1(falta.km)} km até ${falta.destino}` : ""}`}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={R} className="trilha" />
        {resta != null && <circle cx="32" cy="32" r={R} className="resta" strokeDasharray={C} strokeDashoffset={C * (1 - resta)} />}
      </svg>
      <button className="centrar" onClick={onCentrar} aria-label="Centralizar no veículo" />
      <b className="num">{v.linha}</b>
      {falta && <span className="km num">{etaFinal(falta) != null ? `~${eta(etaFinal(falta)!)} min` : `${dec1(falta.km)} km`}</span>}
      <button className="parar" onClick={onParar} aria-label="Parar de acompanhar"><X aria-hidden /></button>
    </div>
  );
}

/** Estimativa até o terminal final: ritmo real do GPS quando já há 2+ min de progresso observado; senão o ritmo programado (GTFS). */
const etaFinal = (f: Falta) => f.etaGpsMin ?? f.etaProgMin ?? null;
