"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Search, LocateFixed, TrainFront, Warehouse, BusFront, MapPin, X, Clock, CloudRain, Gauge, ChevronRight, Info } from "lucide-react";
import BottomSheet from "./BottomSheet";
import SearchSheet from "../ui/SearchSheet";
import { EmptyState, ErrorState, LastUpdated, Skel } from "../ui/estados";
import { J, distKm, fmtDist, get, gravar, ha, horaLocal, lembrar, ler, minhaPosicao } from "../ui/util";
import type { Ponto, VeiculoMapa } from "./TransitMap";
import type { Trajeto } from "../../src/lib/trajeto";
import estacoesJson from "../../src/data/estacoes-brt.json";

const ESTACOES = estacoesJson.estacoes;

const TransitMap = dynamic(() => import("./TransitMap"), { ssr: false, loading: () => <div className="map-fill skeleton" style={{ borderRadius: 0 }} /> });

const K_PONTO = "monitora:mob:ponto", K_LINHA = "monitora:mob:linha", K_RECENTES = "monitora:mob:recentes";

const rotuloTipo = (p: Ponto & { status?: string }) => p.status === "planejada" ? "Planejada · ainda não opera" : (p.tipo === "terminal" ? `Terminal BRT${p.corredor ? ` · ${p.corredor}` : ""}` : p.tipo === "estacao" ? `BRT ${p.corredor ?? ""}`.trim() : [p.rua, p.bairro].filter(Boolean).join(" · ") || "Parada de ônibus");
const IconePonto = ({ p }: { p: Pick<Ponto, "tipo"> }) => (p.tipo === "terminal" ? <Warehouse aria-hidden /> : p.tipo === "estacao" ? <TrainFront aria-hidden /> : <BusFront aria-hidden />);
const eta = (min: number) => Math.max(1, Math.round(min));

export default function MobilidadeApp() {
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [linha, setLinha] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [nivel, setNivel] = useState<0 | 1 | 2>(1);
  const [padB, setPadB] = useState(0);
  const [eu, setEu] = useState<{ lat: number; lng: number } | null>(null);
  const [perto, setPerto] = useState<J | null>(null);
  const [info, setInfo] = useState<J | null>(null);
  const [chegada, setChegada] = useState<J | null>(null);
  const [veiculos, setVeiculos] = useState<J | null>(null);
  const [veiculoSel, setVeiculoSel] = useState<string | null>(null);
  const [clima, setClima] = useState<J | null>(null);
  const [rua, setRua] = useState<J | null>(null);
  const [trajeto, setTrajeto] = useState<Trajeto[] | null>(null);
  const [, tique] = useState(0);
  const desktop = useRef(false);
  const linhaSemPonto = useRef(false);

  useEffect(() => {
    desktop.current = window.matchMedia("(min-width: 960px)").matches;
    setPonto(ler<Ponto | null>(K_PONTO, null)); setLinha(ler<string | null>(K_LINHA, null));
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
  const acompanhar = (l: string | null) => { setLinha(l); gravar(K_LINHA, l); setChegada(null); setVeiculos(null); setVeiculoSel(null); setNivel(l ? 0 : 1); };
  const escolherLinha = (l: string) => {
    setBuscando(false); setVeiculoSel(null); setChegada(null); setVeiculos(null);
    setLinha(l); gravar(K_LINHA, l);
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
    setTrajeto(null);
    if (!linha) return;
    let vivo = true;
    get(`/linhas/${encodeURIComponent(linha)}/trajeto`).then((r) => { if (vivo && r.trajetos?.length) setTrajeto(r.trajetos); });
    return () => { vivo = false; };
  }, [linha]);

  // acompanhamento de linha: veículos + chegada (10 s)
  useEffect(() => {
    if (!linha) return;
    let vivo = true;
    const carregar = async () => {
      const [c, v] = await Promise.all([
        ponto ? get(`/chegada?linha=${encodeURIComponent(linha)}&lat=${ponto.lat}&lng=${ponto.lng}`) : Promise.resolve(null),
        get(`/linhas/${encodeURIComponent(linha)}/veiculos`),
      ]);
      if (vivo) { if (c) setChegada({ ...c, em: Date.now() }); setVeiculos({ ...v, em: Date.now() }); }
    };
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 10_000);
    const volta = () => { if (!document.hidden) carregar(); };
    document.addEventListener("visibilitychange", volta);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, [ponto, linha]);

  const pertoDeMim = async () => {
    setPerto({ carregando: true });
    const p = await minhaPosicao();
    if ("erro" in p) { setPerto({ erro: `${p.erro} Pesquise uma estação para continuar.` }); return; }
    setEu(p);
    const [e, pa] = await Promise.all([get(`/estacoes?lat=${p.lat}&lng=${p.lng}&raio=3000&limite=5`), get(`/paradas?lat=${p.lat}&lng=${p.lng}&raio=500&limite=5`)]);
    setPerto({ estacoes: e.estacoes ?? [], paradas: pa.paradas ?? [] });
  };

  const lista: J[] = veiculos?.observado ?? [];
  const veiculosMapa: VeiculoMapa[] = useMemo(() => lista.map((v) => ({
    id: v.id, fonte: v.fonte, linha: v.linha, destino: v.destino, lat: v.lat, lng: v.lng, rumo: v.rumo, parado: v.parado, idadeS: v.idadeS,
    rotulo: `Linha ${v.linha}, ${v.fonte === "brt" ? "BRT" : "ônibus"}${v.destino ? `, sentido ${v.destino}` : ""}, ${v.parado ? "parado" : `a ${v.velocidadeKmh} km/h`}, atualizado ${ha(v.em)}`,
  })), [veiculos]); // eslint-disable-line react-hooks/exhaustive-deps

  const prox: J | null = chegada?.calculado?.proxima ?? null;
  const ehBrt = ponto?.fonte === "brt" || lista.some((v) => v.fonte === "brt");
  const sel = lista.find((v) => v.id === veiculoSel) ?? null;

  // Contexto de clima: chuva prevista perto do ponto nas próximas 2 h (previsão Open-Meteo).
  const avisoChuva = useMemo(() => {
    const hs: J[] = clima?.calculado?.proximasHoras?.slice(0, 3) ?? [];
    const h = hs.find((x) => (x.probabilidadeChuvaPct ?? 0) >= 60 || x.descricao?.icone === "chuva" || x.descricao?.icone === "tempestade");
    return h ? { hora: horaLocal(h.inicio), p: h.probabilidadeChuvaPct, texto: h.descricao?.texto } : null;
  }, [clima]);

  // ---------- cabeçalho do painel (visível mesmo recolhido) ----------
  const cabecalho = !ponto && linha ? (
    <div className="list-item" style={{ padding: "0 20px 12px", border: 0, minHeight: 0, gap: 12 }}>
      <span className={`line-badge lg${ehBrt ? " brt" : ""}`}>{linha}</span>
      <div className="main">
        <div className="t-title">Linha {linha}</div>
        <div className="t-cap">{!veiculos ? "Carregando veículos…" : `${lista.length} ${lista.length === 1 ? "veículo" : "veículos"} com GPS agora`}</div>
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
            <div className="eta appear" aria-live="polite"><span className="n num">{eta(prox.etaMin)}</span><span className="u">min</span></div>
          ) : <div className="t-title" aria-live="polite">Sem estimativa agora</div>}
          <div className="t-cap" style={{ marginTop: 4 }}>{prox ? `Chegada estimada em ${ponto.nome}` : `Nenhum veículo da linha se aproximando de ${ponto.nome}`}</div>
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
        trajetos={trajeto}
        enquadrarChave={`${ponto?.id ?? ""}|${linha ?? ""}`} />

      <div className="map-top">
        <button className="map-search" onClick={() => setBuscando(true)} aria-label="Pesquisar estação ou parada">
          <Search aria-hidden /><span>{ponto ? ponto.nome : "Pesquisar estação ou terminal"}</span>
        </button>
        <button className="map-fab" onClick={pertoDeMim} aria-label="Usar minha localização"><LocateFixed /></button>
      </div>

      <BottomSheet resumo={ponto && linha ? 190 : 150} nivel={nivel} setNivel={setNivel} onAltura={setPadB} cabecalho={cabecalho}>
        {sel && <VeiculoCard v={sel} ponto={ponto} chegada={chegada} onFechar={() => setVeiculoSel(null)} />}

        {!ponto && linha && (
          <>
            <span className="t-label">Onde você vai embarcar?</span>
            <p className="t-cap" style={{ margin: "6px 0 12px" }}>Escolha a estação ou parada para ver a chegada estimada desta linha.</p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setBuscando(true)}><Search aria-hidden /> Escolher estação ou parada</button>
            {veiculos?.erro && <ErrorState texto="Não foi possível obter dados atualizados desta linha." />}
            {veiculos && !veiculos.erro && !lista.length && <EmptyState icone={BusFront} titulo="Nenhum veículo desta linha com GPS agora." texto="A localização pode voltar em instantes." />}
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
            {chegada?.calculado?.chegadas?.length > 1 && (
              <div className="t-cap" style={{ marginBottom: 12 }}>
                Depois: {chegada!.calculado.chegadas.slice(1, 3).map((c: J) => `~${eta(c.etaMin)} min`).join(" · ")}
              </div>
            )}
            {avisoChuva && (
              <div className="notice appear" style={{ marginBottom: 12 }}>
                <CloudRain className="sev-info" aria-hidden />
                <div><div className="t-head">{avisoChuva.texto ?? "Chuva"} prevista perto de {ponto.nome}</div>
                  <div className="t-cap">Por volta das {avisoChuva.hora}{avisoChuva.p != null ? ` · ${avisoChuva.p}% de chance` : ""} · previsão Open-Meteo</div></div>
              </div>
            )}
            <span className="t-label">Veículos da linha</span>
            {!veiculos ? <div style={{ display: "grid", gap: 12, marginTop: 10 }}><Skel h={52} /><Skel h={52} /></div>
              : veiculos.erro ? <ErrorState texto="Não foi possível obter dados atualizados desta linha." />
              : !lista.length ? <EmptyState icone={BusFront} titulo="Nenhum veículo desta linha com GPS agora." texto="A localização pode voltar em instantes." />
              : (
                <ul className="list">
                  {lista.map((v): J => ({ ...v, k: distKm(ponto, { lat: v.lat, lng: v.lng }) })).sort((a, b) => a.k - b.k).slice(0, 5).map((v) => (
                    <li key={v.id}><button className="list-item" onClick={() => { setVeiculoSel(v.id); setNivel(1); }} aria-label={`Veículo ${v.veiculo}, a ${fmtDist(v.k)}`}>
                      <span className="ico" style={{ color: v.fonte === "brt" ? "var(--brt)" : "var(--bus)" }}><BusFront aria-hidden /></span>
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
            {veiculos?.foraDeOperacao?.n > 0 && (
              <p className="t-meta" style={{ marginTop: 8 }}>
                {veiculos!.foraDeOperacao.n} {veiculos!.foraDeOperacao.n === 1 ? "veículo parado" : "veículos parados"} fora do trajeto (garagem ou pátio) não {veiculos!.foraDeOperacao.n === 1 ? "aparece" : "aparecem"} no mapa.
              </p>
            )}
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

function Estacao({ ponto, info, onLinha }: { ponto: Ponto; info: J | null; onLinha: (l: string) => void }) {
  const linhas: J[] = (ponto.fonte === "brt" ? info?.observado?.linhas : info?.observado) ?? [];
  const proximos: J[] = info?.calculado?.proximos ?? [];
  if (!info) return <div style={{ display: "grid", gap: 12 }} aria-busy="true"><Skel h={18} w={140} /><Skel h={60} /><Skel h={60} /></div>;
  if (info.erro) return <ErrorState texto="Não foi possível carregar esta estação agora." />;
  return (
    <div className="appear">
      {ponto.fonte === "brt" && (
        <>
          <span className="t-label">Próximos BRTs e ônibus</span>
          {!proximos.length ? (
            <p className="t-cap" style={{ margin: "8px 0 0" }}>Nenhum veículo se aproximando desta estação agora.</p>
          ) : (
            <ul className="list">
              {proximos.slice(0, 8).map((p) => (
                <li key={p.fonte + p.linha}><button className="list-item" onClick={() => onLinha(p.linha)} aria-label={`Acompanhar linha ${p.linha}, chega em cerca de ${eta(p.etaMin)} minutos`}>
                  <span className={`line-badge${p.fonte === "brt" ? " brt" : ""}`}>{p.linha}</span>
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
        <span className="t-label">Linhas vistas aqui na última hora</span>
        {!linhas.length ? <p className="t-cap" style={{ margin: 0 }}>Nenhum veículo com GPS passou por aqui na última hora. Se souber a linha, pesquise pela estação de novo mais tarde.</p> : (
          <div className="chip-row">
            {linhas.map((l) => (
              <button key={`${l.fonte}${l.linha}`} className="chip" onClick={() => onLinha(String(l.linha))} aria-label={`Acompanhar linha ${l.linha}`}>
                <span className={`line-badge${l.fonte === "brt" ? " brt" : ""}`} style={{ height: 22, minWidth: 30, fontSize: 12 }}>{l.linha}</span>
                {l.destinos?.[0] ? `→ ${l.destinos[0]}` : `${l.veiculos} veíc.`}
              </button>
            ))}
          </div>
        )}
        <p className="t-meta" style={{ marginTop: 10 }}>Linhas com GPS perto deste ponto. Não é a lista oficial da operação.</p>
      </div>
      <div style={{ marginTop: 14 }}><LastUpdated em={info.em} fonte="GPS SMTR" velhoS={60} /></div>
    </div>
  );
}

function VeiculoCard({ v, ponto, chegada, onFechar }: { v: J; ponto: Ponto | null; chegada: J | null; onFechar: () => void }) {
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
      <div style={{ marginTop: 10 }}><LastUpdated em={v.em} fonte="GPS SMTR" velhoS={60} /></div>
      {v.rumo === null && <div className="t-meta" style={{ marginTop: 6 }}>Direção indisponível para este veículo.</div>}
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
function TransitSearch({ onEscolher, onLinha, comLinhas, onFechar }: { onEscolher: (p: Ponto) => void; onLinha: (l: string) => void; comLinhas: boolean; onFechar: () => void }) {
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
        comLinhas && termo.length <= 8 ? get(`/linhas?q=${encodeURIComponent(termo)}&limite=12`, sinal) : Promise.resolve(null),
      ]);
      if (!r.cancelado) setRes({ ...r, linhas: l?.linhas ?? [] });
    }, 160);
    return () => clearTimeout(t);
  }, [q, modo]);

  const estacoes: J[] = modo === "brt" ? (res?.estacoes ?? []).filter((e: J) => e.tipo === "estacao") : [];
  const terminais: J[] = modo === "brt" ? (res?.estacoes ?? []).filter((e: J) => e.tipo === "terminal") : [];
  const paradas: J[] = modo === "sppo" ? res?.paradas ?? [] : [];
  // BRT e ônibus juntos; o tipo da aba atual vem primeiro
  const linhas: J[] = [...(res?.linhas ?? [])].sort((a: J, b: J) => Number(b.fonte === modo) - Number(a.fonte === modo));
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
          {linhas.length > 0 && <><div className="t-label group-label">Linhas com GPS agora</div><ul className="list">{linhas.map((l) => (
            <li key={l.fonte + l.linha}><button className="list-item" onClick={() => onLinha(l.linha)} aria-label={`Linha ${l.linha}${l.destinos[0] ? `, sentido ${l.destinos.join(" e ")}` : ""}, ${l.veiculosAgora} veículos agora`}>
              <span className={`line-badge${l.fonte === "brt" ? " brt" : ""}`}>{l.linha}</span>
              <span className="main"><div className="t-head">{l.destinos.length ? l.destinos.join(" ↔ ") : `Linha ${l.linha}`}</div><div className="t-cap">{l.fonte === "brt" ? "BRT" : "Ônibus"} · {l.veiculosAgora} {l.veiculosAgora === 1 ? "veículo" : "veículos"} com GPS agora</div></span>
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
