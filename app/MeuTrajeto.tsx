"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Mapa = dynamic(() => import("./Mapa"), { ssr: false, loading: () => <div className="mapa" style={{ height: "100%" }} /> });

interface Favorito { id: string; nome: string; endereco: string; lat: number; lng: number; linha?: string }
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const CHAVE = "meu-trajeto:favoritos";
const EXEMPLO: Favorito = { id: "ex", nome: "Av. das Américas, 2000", endereco: "Exemplo · Barra da Tijuca", lat: -23.000556, lng: -43.334167, linha: "22" };

function lerFavs(): Favorito[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function gravarFavs(f: Favorito[]) { try { localStorage.setItem(CHAVE, JSON.stringify(f)); } catch { /* aparelho sem armazenamento */ } }

function ha(iso?: string | number | null, agora = Date.now()) {
  if (iso === null || iso === undefined) return "—";
  const s = Math.max(0, Math.round((agora - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000));
  return s < 60 ? `há ${s} s` : s < 3600 ? `há ${Math.round(s / 60)} min` : `há ${Math.round(s / 3600)} h`;
}
function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180, R = 6371.0088;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
const km = (k: number) => (k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1).replace(".", ",")} km`);
const dec = (v: number) => String(v).replace(".", ",");
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

async function get(url: string): Promise<J | null> {
  try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : { erro: (await r.json().catch(() => ({}))).erro ?? `HTTP ${r.status}` }; }
  catch { return { erro: "sem conexão" }; }
}

export default function MeuTrajeto() {
  const [favs, setFavs] = useState<Favorito[]>([]);
  const [selId, setSelId] = useState<string>("ex");
  const [dados, setDados] = useState<{ agora?: J | null; chegada?: J | null; veiculos?: J | null; chuva?: J | null; tempo?: J | null; carregadoEm?: number }>({});
  const [adicionando, setAdicionando] = useState(false);
  const [, tique] = useState(0);

  useEffect(() => {
    const f = lerFavs(); setFavs(f); if (f[0]) setSelId(f[0].id);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const t = setInterval(() => tique((x) => x + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  const sel = favs.find((f) => f.id === selId) ?? (favs.length ? favs[0] : EXEMPLO);
  const ehExemplo = !favs.some((f) => f.id === sel.id);

  // Dois ritmos: ônibus/chegada a cada 10 s; rua, chuva e tempo a cada 60 s.
  const carregarOnibus = useCallback(async () => {
    const { lat, lng, linha } = sel;
    if (!linha) { setDados((d) => ({ ...d, chegada: null, veiculos: null, carregadoEm: Date.now() })); return; }
    const [chegada, veiculos] = await Promise.all([
      get(`/chegada?linha=${encodeURIComponent(linha)}&lat=${lat}&lng=${lng}`),
      get(`/linhas/${encodeURIComponent(linha)}/veiculos`),
    ]);
    setDados((d) => ({ ...d, chegada, veiculos, carregadoEm: Date.now() }));
  }, [sel]);

  const carregarEntorno = useCallback(async () => {
    const { lat, lng } = sel;
    const [agora, chuva, tempo] = await Promise.all([
      get(`/agora?lat=${lat}&lng=${lng}`), get(`/chuva?lat=${lat}&lng=${lng}&k=3`), get(`/tempo?lat=${lat}&lng=${lng}`),
    ]);
    setDados((d) => ({ ...d, agora, chuva, tempo }));
  }, [sel]);

  useEffect(() => {
    setDados({});
    carregarOnibus(); carregarEntorno();
    const t1 = setInterval(() => { if (!document.hidden) carregarOnibus(); }, 10_000);
    const t2 = setInterval(() => { if (!document.hidden) carregarEntorno(); }, 60_000);
    // Ao voltar para o app (trocar de aba, desbloquear o celular), atualiza na hora.
    const volta = () => { if (!document.hidden) { carregarOnibus(); carregarEntorno(); } };
    document.addEventListener("visibilitychange", volta);
    return () => { clearInterval(t1); clearInterval(t2); document.removeEventListener("visibilitychange", volta); };
  }, [carregarOnibus, carregarEntorno]);

  const salvar = (f: Favorito) => { const n = [...favs.filter((x) => x.id !== f.id), f]; setFavs(n); gravarFavs(n); setSelId(f.id); setAdicionando(false); };
  const remover = (id: string) => {
    if (!confirm("Remover este trajeto?")) return;
    const n = favs.filter((x) => x.id !== id); setFavs(n); gravarFavs(n); setSelId(n[0]?.id ?? "ex");
  };
  const trocarLinha = (linha: string | undefined) => {
    if (ehExemplo) { salvar({ ...sel, id: String(Date.now()), linha }); return; }
    salvar({ ...sel, linha });
  };

  const { agora, chegada, veiculos, chuva, tempo } = dados;
  const ehBrt = (veiculos?.observado ?? []).some((v: J) => v.fonte === "brt");
  const veiculosMapa = (veiculos?.observado ?? []).map((v: J) => ({
    id: `${v.fonte}${v.veiculo}`, lat: v.lat, lng: v.lng, brt: v.fonte === "brt", idadeS: v.idadeS, texto: String(sel.linha ?? ""),
    rotulo: `${v.fonte === "brt" ? "BRT" : "Ônibus"} ${sel.linha} · veículo ${v.veiculo} · ${dec(v.velocidadeKmh)} km/h · GPS ${ha(v.em)}`,
  }));

  return (
    <>
      <div className="topo">
        <Mapa preencher destino={{ lat: sel.lat, lng: sel.lng }} veiculos={veiculosMapa}
          chuva={(chuva?.observado ?? []).map((e: J) => ({ id: e.id, lat: e.lat, lng: e.lng, mm: e.mm.h01, nome: e.nome }))} />
        <div className="cabecalho">
          <a className="marca" href="/docs" aria-label="API e metodologia">🚏</a>
          <div className="chips">
            {(favs.length ? favs : [EXEMPLO]).map((f) => (
              <button key={f.id} className={`chip${f.id === sel.id ? " ativo" : ""}`} onClick={() => setSelId(f.id)}>{f.nome}</button>
            ))}
            <button className="chip mais" onClick={() => setAdicionando(true)} aria-label="Adicionar trajeto">＋ Adicionar</button>
          </div>
        </div>
      </div>

      <main className="painel">
        <div className="alca" />
        <div className="local">
          <div style={{ minWidth: 0 }}>
            <h1>{sel.nome}</h1>
            <div className="sub">
              {sel.endereco !== sel.nome ? `${sel.endereco} · ` : ""}
              <span className="vivo">{dados.carregadoEm ? `ao vivo · ${ha(dados.carregadoEm)}` : "carregando…"}</span>
            </div>
          </div>
          {!ehExemplo && <button className="icone-botao" onClick={() => remover(sel.id)} aria-label="Remover trajeto">🗑</button>}
        </div>

        <Chegada sel={sel} chegada={chegada} veiculos={veiculos} ehBrt={ehBrt} onLinha={trocarLinha} />

        <div className="blocos">
          <Rua agora={agora} />
          <Chuva chuva={chuva} />
          <Tempo tempo={tempo} />
        </div>

        <Habitual agora={agora} />

        {tempo?.calculado?.proximasHoras?.length > 0 && (
          <section className="card">
            <h2>Próximas horas</h2>
            <div className="horas">
              {tempo!.calculado.proximasHoras.slice(0, 6).map((h: J) => (
                <div key={h.inicio} className="hora">
                  <div className="t">{hora(h.inicio)}</div>
                  <div className="g num">{h.temperaturaC === null ? "–" : `${Math.round(h.temperaturaC)}°`}</div>
                  <div className="p num">💧{h.probabilidadeChuvaPct ?? "–"}%</div>
                </div>
              ))}
            </div>
            <div className="fraco" style={{ marginTop: 8 }}>Previsão de modelo (Open-Meteo), não é medição.</div>
          </section>
        )}

        <section className="card linha-info">
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div><b>Ocorrências</b><div className="sub">Ainda sem fonte aberta ao vivo do COR. Nada é exibido para não inventar dado.</div></div>
        </section>

        <details className="sobre">
          <summary>ⓘ Sobre os dados</summary>
          <p><b>Velocidade:</b> é a dos ônibus e BRTs (GPS da frota, SMTR). Eles param em estações e usam faixa exclusiva, então é um indicador indireto — não é a velocidade dos carros nem a contagem de veículos.</p>
          <p><b>Chegada:</b> estimativa experimental nossa (distância em linha reta e velocidade de aproximação observada). Não é horário oficial.</p>
          <p><b>Fontes:</b> GPS SMTR (ao vivo), pluviômetros Alerta Rio, previsão Open-Meteo, paradas e endereços IPP/Prefeitura do Rio, mapa © OpenStreetMap (OpenFreeMap). Seus trajetos ficam só neste aparelho.</p>
          <p><a href="/docs">API e metodologia →</a></p>
        </details>
      </main>

      {adicionando && <NovoFavorito onSalvar={salvar} onFechar={() => setAdicionando(false)} />}
    </>
  );
}

function Chegada({ sel, chegada, veiculos, ehBrt, onLinha }: { sel: Favorito; chegada?: J | null; veiculos?: J | null; ehBrt: boolean; onLinha: (l: string | undefined) => void }) {
  const [editando, setEditando] = useState(false);
  const [linha, setLinha] = useState(sel.linha ?? "");
  useEffect(() => { setLinha(sel.linha ?? ""); setEditando(false); }, [sel.id, sel.linha]);

  if (!sel.linha || editando) {
    return (
      <section className="card">
        <h2>Seu ônibus</h2>
        <div className="sub">{sel.linha ? "Trocar a linha deste trajeto:" : "Escolha a linha para ver onde ela está e quando chega."}</div>
        <form className="campo" onSubmit={(e) => { e.preventDefault(); onLinha(linha.trim().toUpperCase() || undefined); setEditando(false); }}>
          <input placeholder="Linha (ex.: 22, 917, SV866)" value={linha} onChange={(e) => setLinha(e.target.value)} inputMode="text" autoCapitalize="characters" />
          <button className="prim" type="submit">OK</button>
        </form>
      </section>
    );
  }

  const prox: J | null = chegada?.calculado?.proxima ?? null;
  const seguintes: J[] = (chegada?.calculado?.chegadas ?? []).slice(1, 3);
  const vs: J[] = veiculos?.observado ?? [];
  const perto: J[] = vs.map((v): J => ({ ...v, k: distKm(sel, { lat: v.lat, lng: v.lng }) })).sort((a, b) => a.k - b.k).slice(0, 3);

  return (
    <section className="card">
      <div className="chegada-topo">
        <div>
          <h2 style={{ marginBottom: 6 }}>Seu ônibus</h2>
          {!chegada ? <div className="eta-vazio sub">carregando…</div>
            : prox ? <div className="eta num">~{Math.max(1, Math.round(prox.etaMin))}<small>min</small></div>
            : <div className="eta-vazio">Sem estimativa agora</div>}
        </div>
        <button className={`badge-linha${ehBrt ? " brt" : ""}`} style={{ border: 0 }} onClick={() => setEditando(true)} aria-label="Trocar linha">
          {ehBrt ? "BRT" : "🚌"} {sel.linha}
        </button>
      </div>
      {prox && (
        <div className="sub" style={{ marginTop: 6 }}>
          a {km(prox.distanciaM / 1000)} · vindo a {dec(prox.velocidadeAproximacaoKmh)} km/h
          {seguintes.length > 0 && <> · depois ~{seguintes.map((c) => Math.max(1, Math.round(c.etaMin))).join(" e ~")} min</>}
        </div>
      )}
      {chegada && !prox && <div className="sub" style={{ marginTop: 6 }}>Nenhum veículo da linha está se aproximando de você neste momento.</div>}

      {veiculos && (
        perto.length ? (
          <ul className="veiculos">
            {perto.map((v) => (
              <li key={`${v.fonte}${v.veiculo}`}>
                <span className="ponto">{v.fonte === "brt" ? "🚍" : "🚌"}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="principal num">{km(v.k)}</div>
                  <div className="fraco">veículo {v.veiculo}{v.sentido ? ` · ${v.sentido}` : ""}</div>
                </div>
                <div className="direita">
                  <div className="num" style={{ fontWeight: 700 }}>{v.velocidadeKmh > 0 ? `${Math.round(v.velocidadeKmh)} km/h` : "parado"}</div>
                  <div className="fraco">GPS {ha(v.em)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : <div className="sub" style={{ marginTop: 10 }}>Nenhum veículo desta linha com GPS nos últimos 10 min.</div>
      )}
      <div className="fraco" style={{ marginTop: 10 }}>Estimativa experimental · não é horário oficial · GPS SMTR</div>
    </section>
  );
}

function Rua({ agora }: { agora?: J | null }) {
  const t = agora?.calculado?.total;
  return (
    <div className="bloco">
      <div className="rotulo">Rua</div>
      <div className="valor num">{!agora ? "…" : t?.velocidadeMedia == null ? "—" : <>{Math.round(t.velocidadeMedia)}<small>km/h</small></>}</div>
      <div className="detalhe">{!agora ? "" : t?.velocidadeMedia == null ? "sem ônibus por perto" : `${t.nVeiculos} ônibus · 15 min`}</div>
    </div>
  );
}

function Chuva({ chuva }: { chuva?: J | null }) {
  const e = chuva?.observado?.[0];
  return (
    <div className="bloco">
      <div className="rotulo">Chuva</div>
      <div className="valor num">{!chuva ? "…" : !e || e.mm.h01 == null ? "—" : <>{dec(e.mm.h01)}<small>mm/h</small></>}</div>
      <div className="detalhe">{e ? `${e.nome} · ${km(e.distanciaM / 1000)}` : chuva?.erro ?? ""}</div>
    </div>
  );
}

function Tempo({ tempo }: { tempo?: J | null }) {
  const a = tempo?.calculado?.agora;
  const p = tempo?.calculado?.proximasHoras?.[1];
  return (
    <div className="bloco">
      <div className="rotulo">Tempo</div>
      <div className="valor num">{!tempo ? "…" : a?.temperaturaC == null ? "—" : `${Math.round(a.temperaturaC)}°`}</div>
      <div className="detalhe">{p?.probabilidadeChuvaPct != null ? `${p.probabilidadeChuvaPct}% de chuva na próxima hora` : ""}</div>
    </div>
  );
}

function Habitual({ agora }: { agora?: J | null }) {
  const it = agora?.interpretado;
  if (!it) return null;
  const fontes = (["sppo", "brt"] as const).filter((f) => it[f]?.situacao?.includes("faixa"));
  return (
    <section className="card">
      <h2>Comparado ao habitual</h2>
      {!fontes.length ? (
        <div className="sub">Ainda juntando histórico para {it.pontoReferencia?.nome}. A comparação aparece depois de alguns dias de coleta.</div>
      ) : fontes.map((f) => {
        const c = it[f]; const cls = c.situacao.startsWith("abaixo") ? "abaixo" : c.situacao.startsWith("acima") ? "acima" : "";
        return (
          <div key={f} style={{ margin: "4px 0" }}>
            <span className={`situacao ${cls}`}>{f === "brt" ? "BRT" : "Ônibus"}: {c.situacao.replaceAll("_", " ")}</span>
            <div className="fraco">habitual {c.habitual.p25}–{c.habitual.p75} km/h · {c.habitual.nDias} dias</div>
          </div>
        );
      })}
    </section>
  );
}

function NovoFavorito({ onSalvar, onFechar }: { onSalvar: (f: Favorito) => void; onFechar: () => void }) {
  const [modo, setModo] = useState<"parada" | "endereco">("parada");
  const [q, setQ] = useState("");
  const [cands, setCands] = useState<J[] | null>(null);
  const [esc, setEsc] = useState<J | null>(null);
  const [nome, setNome] = useState("");
  const [linha, setLinha] = useState("");
  const [linhasPerto, setLinhasPerto] = useState<J[] | null>(null);
  const [msg, setMsg] = useState("");

  function escolher(c: J) {
    setEsc(c); setNome(c.nome ?? c.endereco); setCands(null); setLinhasPerto(null);
    if (c.paradaId) get(`/paradas/${encodeURIComponent(c.paradaId)}/linhas`).then((r) => setLinhasPerto(r?.observado ?? []));
  }
  const paraItem = (p: J) => ({ nome: p.nome, endereco: [p.rua, p.bairro].filter(Boolean).join(" · ") || p.nome, bairro: p.bairro, rua: p.rua, lat: p.lat, lng: p.lng, paradaId: p.id, distanciaM: p.distanciaM });

  async function buscar(e: React.FormEvent) {
    e.preventDefault(); setMsg("buscando…");
    const r = modo === "parada" ? await get(`/paradas?q=${encodeURIComponent(q)}`) : await get(`/geocodificar?q=${encodeURIComponent(q)}`);
    if (!r || r.erro) { setMsg(r?.erro ?? "erro"); return; }
    const lista = modo === "parada" ? r.paradas.map(paraItem) : r.candidatos.map((c: J) => ({ ...c, nome: c.endereco }));
    setCands(lista); setMsg(lista.length ? "" : "nada encontrado");
  }

  function pertoDeMim() {
    setMsg("pegando sua localização…");
    navigator.geolocation?.getCurrentPosition(
      async (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        if (modo === "endereco") { escolher({ nome: "Minha localização", endereco: "Minha localização", lat, lng }); setMsg(""); return; }
        const r = await get(`/paradas?lat=${lat}&lng=${lng}&raio=800&limite=15`);
        const lista = (r?.paradas ?? []).map(paraItem);
        setCands(lista); setMsg(lista.length ? "" : "nenhuma parada a até 800 m");
      },
      () => setMsg("não foi possível obter a localização (permita o acesso no navegador)"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="fundo-folha" onClick={onFechar}>
      <div className="folha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Adicionar trajeto">
        <div className="alca" />
        {!esc ? (
          <>
            <div className="local" style={{ alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Adicionar trajeto</h3>
              <button className="icone-botao" onClick={onFechar} aria-label="Fechar">✕</button>
            </div>
            <div className="segmentos">
              <button className={modo === "parada" ? "ativo" : ""} onClick={() => { setModo("parada"); setCands(null); setMsg(""); }}>🚏 Estação ou parada</button>
              <button className={modo === "endereco" ? "ativo" : ""} onClick={() => { setModo("endereco"); setCands(null); setMsg(""); }}>📍 Endereço</button>
            </div>
            <form onSubmit={buscar} className="campo" style={{ marginTop: 0 }}>
              <input autoFocus placeholder={modo === "parada" ? "Ex.: Alvorada, Mato Alto, Jardim Oceânico" : "Ex.: Rua Jardim Botânico 746"} value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="prim" type="submit">Buscar</button>
            </form>
            <button className="sec" style={{ width: "100%", marginTop: 8 }} onClick={pertoDeMim}>📍 {modo === "parada" ? "Paradas perto de mim" : "Usar minha localização"}</button>
            {msg && <p className="sub">{msg}</p>}
            {cands?.map((c) => (
              <button type="button" className="lista-item" key={`${c.paradaId ?? ""}${c.lat},${c.lng},${c.nome}`} onClick={() => escolher(c)}>
                <b>{c.nome}</b>
                <div className="sub">
                  {[c.bairro, c.rua, c.distanciaM != null ? `${c.distanciaM} m de você` : null, c.nota != null && !c.paradaId ? `nota ${c.nota}` : null].filter(Boolean).join(" · ")}
                </div>
              </button>
            ))}
            <p className="fraco">{modo === "parada" ? "Paradas e estações de ônibus e BRT: camada aberta da Prefeitura." : "Geocodificador oficial da Prefeitura (IPP)."}</p>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); onSalvar({ id: String(Date.now()), nome: nome || esc.nome, endereco: esc.endereco, lat: esc.lat, lng: esc.lng, linha: linha.trim().toUpperCase() || undefined }); }}>
            <div className="local" style={{ alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{esc.nome}</h3>
              <button type="button" className="icone-botao" onClick={() => setEsc(null)} aria-label="Voltar">←</button>
            </div>
            <div className="sub" style={{ margin: "-6px 2px 10px" }}>{esc.endereco}</div>
            <Mapa destino={{ lat: esc.lat, lng: esc.lng }} veiculos={[]} chuva={[]} altura={160} zoom={15} />

            <label className="rotulo-campo">Linha</label>
            {esc.paradaId && (linhasPerto === null ? <p className="sub">procurando linhas que passaram aqui…</p> : linhasPerto.length ? (
              <>
                <div className="chips-linhas">
                  {linhasPerto.map((l) => (
                    <button type="button" key={`${l.fonte}${l.linha}`}
                      className={`chip-linha${l.fonte === "brt" ? " brt" : ""}${linha.toUpperCase() === String(l.linha).toUpperCase() ? " ativo" : ""}`}
                      onClick={() => setLinha(String(l.linha))}>
                      {l.fonte === "brt" ? "BRT " : ""}{l.linha}
                    </button>
                  ))}
                </div>
                <p className="fraco">Linhas com GPS perto desta parada na última hora (experimental, não é a lista oficial).</p>
              </>
            ) : <p className="sub">Nenhum ônibus com GPS aqui na última hora.</p>)}
            <input value={linha} onChange={(e) => setLinha(e.target.value)} placeholder="ou digite a linha (opcional)" />

            <label className="rotulo-campo">Nome do trajeto</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ponto do trabalho" />
            <button className="prim" type="submit" style={{ width: "100%", marginTop: 14, padding: 13 }}>Salvar trajeto</button>
            <p className="fraco" style={{ textAlign: "center" }}>Salvo só neste aparelho.</p>
          </form>
        )}
      </div>
    </div>
  );
}
