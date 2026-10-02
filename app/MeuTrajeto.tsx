"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Mapa = dynamic(() => import("./Mapa"), { ssr: false, loading: () => <div className="mapa" /> });

interface Favorito { id: string; nome: string; endereco: string; lat: number; lng: number; linha?: string }
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const CHAVE = "meu-trajeto:favoritos";
const EXEMPLO: Favorito = { id: "ex", nome: "Exemplo: Av. das Américas 2000", endereco: "Avenida das Américas 2000", lat: -23.000556, lng: -43.334167, linha: "22" };

function lerFavs(): Favorito[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function gravarFavs(f: Favorito[]) { try { localStorage.setItem(CHAVE, JSON.stringify(f)); } catch { /* aparelho sem armazenamento */ } }

function ha(iso?: string | null, agora = Date.now()) {
  if (!iso) return "sem horário";
  const s = Math.max(0, Math.round((agora - Date.parse(iso)) / 1000));
  return s < 60 ? `há ${s} s` : s < 3600 ? `há ${Math.round(s / 60)} min` : `há ${Math.round(s / 3600)} h`;
}
const fmt = (v: number | null | undefined, u = "") => (v === null || v === undefined ? "sem dado" : `${v}${u}`);

async function get(url: string): Promise<J | null> {
  try { const r = await fetch(url); return r.ok ? await r.json() : { erro: (await r.json().catch(() => ({}))).erro ?? `HTTP ${r.status}` }; }
  catch { return { erro: "sem conexão" }; }
}

export default function MeuTrajeto() {
  const [favs, setFavs] = useState<Favorito[]>([]);
  const [selId, setSelId] = useState<string>("ex");
  const [dados, setDados] = useState<{ agora?: J | null; chegada?: J | null; veiculos?: J | null; chuva?: J | null; tempo?: J | null; carregadoEm?: number }>({});
  const [editando, setEditando] = useState(false);
  const [, tique] = useState(0);

  useEffect(() => {
    const f = lerFavs(); setFavs(f); if (f[0]) setSelId(f[0].id);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const t = setInterval(() => tique((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const sel = favs.find((f) => f.id === selId) ?? (favs.length ? favs[0] : EXEMPLO);

  const carregar = useCallback(async () => {
    const { lat, lng, linha } = sel;
    const [agora, chuva, tempo, chegada, veiculos] = await Promise.all([
      get(`/agora?lat=${lat}&lng=${lng}`), get(`/chuva?lat=${lat}&lng=${lng}&k=3`), get(`/tempo?lat=${lat}&lng=${lng}`),
      linha ? get(`/chegada?linha=${encodeURIComponent(linha)}&lat=${lat}&lng=${lng}`) : Promise.resolve(null),
      linha ? get(`/linhas/${encodeURIComponent(linha)}/veiculos`) : Promise.resolve(null),
    ]);
    setDados({ agora, chuva, tempo, chegada, veiculos, carregadoEm: Date.now() });
  }, [sel]);

  useEffect(() => { setDados({}); carregar(); const t = setInterval(carregar, 30_000); return () => clearInterval(t); }, [carregar]);

  const salvar = (f: Favorito) => { const n = [...favs.filter((x) => x.id !== f.id), f]; setFavs(n); gravarFavs(n); setSelId(f.id); setEditando(false); };
  const remover = (id: string) => { const n = favs.filter((x) => x.id !== id); setFavs(n); gravarFavs(n); setSelId(n[0]?.id ?? "ex"); };

  const { agora, chegada, veiculos, chuva, tempo } = dados;
  const tot = agora?.calculado?.total;
  const interp = agora?.interpretado;

  return (
    <main>
      <div className="linha" style={{ justifyContent: "space-between" }}>
        <h1>🚏 Meu trajeto</h1>
        <a className="sub" href="/docs">API e metodologia</a>
      </div>

      <div className="chips">
        {(favs.length ? favs : [EXEMPLO]).map((f) => (
          <button key={f.id} className={f.id === sel.id ? "ativo" : ""} onClick={() => setSelId(f.id)}>{f.nome}</button>
        ))}
        <button onClick={() => setEditando((x) => !x)}>{editando ? "Cancelar" : "+ Adicionar"}</button>
      </div>
      {editando && <NovoFavorito onSalvar={salvar} />}
      {!favs.length && !editando && <p className="sub">Seus trajetos ficam salvos só neste aparelho. Nenhum cadastro é necessário.</p>}

      <p className="sub">
        {sel.endereco}{sel.linha ? ` · linha ${sel.linha}` : ""} · atualizado {ha(dados.carregadoEm ? new Date(dados.carregadoEm).toISOString() : null)}
        {favs.some((f) => f.id === sel.id) && <> · <a href="#" onClick={(e) => { e.preventDefault(); remover(sel.id); }}>remover</a></>}
      </p>

      {sel.linha && (
        <section className="card">
          <h2>🚌 Linha {sel.linha}</h2>
          {!chegada ? <p className="sub">carregando…</p> : chegada.erro ? <p className="sub">{chegada.erro}</p> : chegada.calculado?.proxima ? (
            <>
              <div className="grande">~{Math.max(1, Math.round(chegada.calculado.proxima.etaMin))} min</div>
              <div className="sub">
                a {(chegada.calculado.proxima.distanciaM / 1000).toFixed(1)} km em linha reta · GPS {ha(chegada.calculado.proxima.ultimaLeitura)}
                {chegada.calculado.chegadas.length > 1 && <> · depois: {chegada.calculado.chegadas.slice(1, 3).map((c: J) => `~${Math.max(1, Math.round(c.etaMin))} min`).join(", ")}</>}
              </div>
            </>
          ) : (
            <p>sem dado <span className="sub">— nenhum veículo da linha vindo em sua direção nos últimos 10 min ({chegada.observado?.veiculosNaLinha ?? 0} veículos da linha com GPS)</span></p>
          )}
          <p className="aviso">Estimativa experimental nossa (linha reta + velocidade de aproximação observada). Não é horário oficial. Fonte: GPS SMTR.</p>
        </section>
      )}

      <section className="card">
        <h2>🚗 Como está a rua (pelo GPS dos ônibus)</h2>
        {!agora ? <p className="sub">carregando…</p> : agora.erro ? <p className="sub">{agora.erro}</p> : (
          <>
            <div className="grande">{tot?.velocidadeMedia === null || tot?.velocidadeMedia === undefined ? "sem dado" : `${tot.velocidadeMedia} km/h`}</div>
            <div className="sub">
              {tot?.nVeiculos ?? 0} ônibus/BRT num raio de {agora.consulta?.raioM} m nos últimos {agora.consulta?.janelaMin} min · {tot?.nLeiturasMovimento ?? 0} leituras em movimento
              {tot?.proporcaoParados !== null && tot?.proporcaoParados !== undefined && <> · {Math.round(tot.proporcaoParados * 100)}% das leituras parados</>}
            </div>
            {interp && (() => {
              const fontes = (["sppo", "brt"] as const).filter((f) => interp[f]?.situacao?.includes("faixa"));
              if (!fontes.length) return <div className="sub">Comparação com o habitual ({interp.pontoReferencia?.nome}): ainda sem histórico suficiente (mínimo de dias anteriores no mesmo dia da semana e hora).</div>;
              return fontes.map((f) => {
                const c = interp[f]; const cls = c.situacao.startsWith("abaixo") ? "alerta" : c.situacao.startsWith("acima") ? "ok" : "";
                return <div key={f} className={cls}>{f === "brt" ? "BRT" : "Ônibus"}: {c.situacao.replaceAll("_", " ")} (habitual {c.habitual.p25}–{c.habitual.p75} km/h, {c.habitual.nDias} dias)</div>;
              });
            })()}
            <div className="sub">GPS mais recente: {ha(agora.leituraMaisRecente)}</div>
          </>
        )}
        <p className="aviso">Velocidade dos ônibus/BRTs (param em estações e usam faixa exclusiva). Indicador indireto: não é a velocidade dos carros nem a contagem de veículos. Fonte: GPS SMTR.</p>
      </section>

      <section className="card">
        <h2>🌧️ Tempo</h2>
        {!chuva ? <p className="sub">carregando…</p> : chuva.erro ? <p className="sub">Chuva medida: {chuva.erro}</p> : (() => {
          const e = chuva.observado?.[0];
          return e ? (
            <div>
              <div><b>{fmt(e.mm.h01, " mm")}</b> na última hora · {fmt(e.mm.m15, " mm")} em 15 min</div>
              <div className="sub">pluviômetro {e.nome} a {(e.distanciaM / 1000).toFixed(1)} km · medido {ha(e.medidoEm)} · Alerta Rio</div>
            </div>
          ) : <p>sem dado</p>;
        })()}
        {tempo && !tempo.erro && tempo.calculado && (
          <div style={{ marginTop: 8 }}>
            <div className="sub">Previsão (Open-Meteo, modelo — não é medição):</div>
            <div className="chips">
              {tempo.calculado.proximasHoras.slice(0, 6).map((h: J) => (
                <div key={h.inicio} className="card" style={{ margin: 0, padding: "6px 10px", minWidth: 74, textAlign: "center" }}>
                  <div className="sub">{new Date(h.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</div>
                  <div>{fmt(h.temperaturaC, "°")}</div>
                  <div className="sub">💧{fmt(h.probabilidadeChuvaPct, "%")}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>⚠️ Ocorrências</h2>
        <p className="sub">Ainda sem fonte aberta ao vivo do COR (a API pública está fora do ar). Nada é exibido para não inventar dado.</p>
      </section>

      <Mapa
        destino={{ lat: sel.lat, lng: sel.lng }}
        veiculos={(veiculos?.observado ?? []).map((v: J) => ({ id: `${v.fonte}${v.veiculo}`, lat: v.lat, lng: v.lng, rotulo: `${sel.linha} · ${v.velocidadeKmh} km/h · GPS ${ha(v.em)}` }))}
        chuva={(chuva?.observado ?? []).map((e: J) => ({ id: e.id, lat: e.lat, lng: e.lng, mm: e.mm.h01, nome: e.nome }))}
      />
      <p className="sub">Mapa © OpenStreetMap (OpenFreeMap). Dados: SMTR, Alerta Rio, IPP/Prefeitura do Rio, Open-Meteo.</p>
    </main>
  );
}

function NovoFavorito({ onSalvar }: { onSalvar: (f: Favorito) => void }) {
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

  async function buscar(e: React.FormEvent) {
    e.preventDefault(); setMsg("buscando…");
    const r = modo === "parada" ? await get(`/paradas?q=${encodeURIComponent(q)}`) : await get(`/geocodificar?q=${encodeURIComponent(q)}`);
    if (!r || r.erro) { setMsg(r?.erro ?? "erro"); return; }
    const lista = modo === "parada"
      ? r.paradas.map((p: J) => ({ nome: p.nome, endereco: p.nome, lat: p.lat, lng: p.lng, paradaId: p.id }))
      : r.candidatos.map((c: J) => ({ ...c, nota: c.nota }));
    setCands(lista); setMsg(lista.length ? "" : "nada encontrado");
  }

  function pertoDeMim() {
    setMsg("pegando sua localização…");
    navigator.geolocation?.getCurrentPosition(
      async (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        if (modo === "endereco") { escolher({ endereco: "Minha localização", lat, lng }); setMsg(""); return; }
        const r = await get(`/paradas?lat=${lat}&lng=${lng}&raio=800&limite=15`);
        const lista = (r?.paradas ?? []).map((x: J) => ({ nome: x.nome, endereco: x.nome, lat: x.lat, lng: x.lng, paradaId: x.id, distanciaM: x.distanciaM }));
        setCands(lista); setMsg(lista.length ? "" : "nenhuma parada a até 800 m");
      },
      () => setMsg("não foi possível obter a localização (permita o acesso no navegador)"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <section className="card">
      {!esc ? (
        <>
          <div className="chips" style={{ marginBottom: 8 }}>
            <button className={modo === "parada" ? "ativo" : ""} onClick={() => { setModo("parada"); setCands(null); setMsg(""); }}>🚏 Estação ou parada</button>
            <button className={modo === "endereco" ? "ativo" : ""} onClick={() => { setModo("endereco"); setCands(null); setMsg(""); }}>📍 Endereço</button>
          </div>
          <form onSubmit={buscar} className="linha">
            <input placeholder={modo === "parada" ? "Nome da estação/parada (ex.: Alvorada, Jardim Oceânico)" : "Endereço no Rio (ex.: Rua Jardim Botânico 746)"} value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="prim" type="submit">Buscar</button>
            <button type="button" onClick={pertoDeMim}>{modo === "parada" ? "📍 Paradas perto de mim" : "📍 Usar minha localização"}</button>
          </form>
          {msg && <p className="sub">{msg}</p>}
          {cands?.map((c) => (
            <div key={`${c.paradaId ?? ""}${c.lat},${c.lng},${c.endereco}`} style={{ padding: "4px 0" }}>
              <a href="#" onClick={(e) => { e.preventDefault(); escolher(c); }}>{c.nome ?? c.endereco}</a>{" "}
              <span className="sub">{c.distanciaM != null ? `${c.distanciaM} m` : c.nota != null ? `nota ${c.nota}` : ""}</span>
            </div>
          ))}
          <p className="sub">{modo === "parada" ? "Paradas e estações de ônibus e BRT: camada aberta da Prefeitura." : "Geocodificador oficial da Prefeitura (IPP)."}</p>
        </>
      ) : (
        <form className="grade" onSubmit={(e) => { e.preventDefault(); onSalvar({ id: String(Date.now()), nome: nome || esc.endereco, endereco: esc.endereco, lat: esc.lat, lng: esc.lng, linha: linha.trim().toUpperCase() || undefined }); }}>
          <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ponto do trabalho" /></label>
          <label>Linha (opcional)<input value={linha} onChange={(e) => setLinha(e.target.value)} placeholder="Ex.: 22 ou 917" /></label>
          {esc.paradaId && (
            <div style={{ gridColumn: "1/-1" }}>
              {linhasPerto === null ? <p className="sub">procurando linhas que passaram aqui…</p> : linhasPerto.length ? (
                <>
                  <p className="sub" style={{ margin: "4px 0" }}>Linhas com GPS perto desta parada na última hora (toque para escolher):</p>
                  <div className="chips">
                    {linhasPerto.map((l) => (
                      <button type="button" key={`${l.fonte}${l.linha}`} className={linha.toUpperCase() === String(l.linha).toUpperCase() ? "ativo" : ""} onClick={() => setLinha(String(l.linha))}>
                        {l.fonte === "brt" ? "BRT " : ""}{l.linha}
                      </button>
                    ))}
                  </div>
                  <p className="sub">Experimental: não é a lista oficial da parada.</p>
                </>
              ) : <p className="sub">Nenhum ônibus com GPS perto desta parada na última hora. Digite a linha, se souber.</p>}
            </div>
          )}
          <div style={{ gridColumn: "1/-1" }}>
            <p className="sub" style={{ margin: "4px 0" }}>Confira no mapa se é o lugar certo (há paradas com o mesmo nome em bairros diferentes):</p>
            <Mapa destino={{ lat: esc.lat, lng: esc.lng }} veiculos={[]} chuva={[]} />
          </div>
          <p className="sub" style={{ gridColumn: "1/-1" }}>{esc.endereco} ({esc.lat.toFixed(5)}, {esc.lng.toFixed(5)}) · salvo só neste aparelho</p>
          <div className="linha"><button className="prim" type="submit">Salvar</button><button type="button" onClick={() => setEsc(null)}>Voltar</button></div>
        </form>
      )}
    </section>
  );
}
