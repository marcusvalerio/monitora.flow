"use client";
import TempoView from "./TempoView";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, LocateFixed, Search, MapPin, Clock, Navigation } from "lucide-react";
import SearchSheet from "../ui/SearchSheet";
import { EmptyState, ErrorState, Skel } from "../ui/estados";
import { J, get, gravar, lembrar, ler, minhaPosicao } from "../ui/util";

export interface Local { id: string; nome: string; detalhe?: string; lat: number; lng: number; gps?: boolean }
const CHAVE_LOCAL = "monitora:clima:local";
const CHAVE_RECENTES = "monitora:clima:recentes";


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
  return <TempoView tempo={tempo} chuva={chuva} local={local} />;
}

