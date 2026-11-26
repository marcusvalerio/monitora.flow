"use client";
/**
 * Agora: só resume — uma linha/cartão de cada assunto, e cada um leva à aba completa (docs/REFORMULACAO.md).
 *   1. o aviso do dia (estágio da cidade, calor, chuva…) → Atenção
 *   2. temperatura, céu, chance de chuva e as próximas horas → Tempo
 *   3. o próximo ônibus/BRT salvo → Trajeto
 * Padrão de painel: fundo neutro, número grande, fonte e horário ao lado. Campo ausente some; nada inventado.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { BusFront, ChevronRight, Droplets } from "lucide-react";
import { ErrorState, IconeTempo, LastUpdated, Skel } from "./estados";
import { NumeroRolante } from "./Numero";
import { J, coord, distKm, get, gravarCache, horaLocal, ler, lerCache, minhaPosicao } from "./util";
import { resumoDoDia } from "../../src/lib/resumoDia";
import { mesmoDestino } from "../../src/lib/trajeto";
import { useEnche } from "./useEnche";

const LOCAL_PADRAO = { nome: "Centro", lat: -22.9068, lng: -43.1729 };

export default function Home() {
  const [pronto, setPronto] = useState(false);
  const [local, setLocal] = useState<J | null>(null);
  const [mob, setMob] = useState<{ ponto: J | null; linha: string | null; sentido: string | null; modo: string | null }>({ ponto: null, linha: null, sentido: null, modo: null });

  useEffect(() => {
    const salvo = ler<J | null>("monitora:clima:local", null);
    setLocal(salvo);
    setMob({
      ponto: ler<J | null>("monitora:mob:ponto", null), linha: ler<string | null>("monitora:mob:linha", null),
      sentido: ler<string | null>("monitora:mob:sentido", null), modo: ler<string | null>("monitora:mob:modo", null),
    });
    setPronto(true);
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((st) => {
      if (st.state !== "granted") return;
      minhaPosicao().then((p) => { if (!("erro" in p) && (!salvo || distKm(salvo as { lat: number; lng: number }, p) > 2)) setLocal({ nome: "Perto de você", lat: p.lat, lng: p.lng }); });
    }).catch(() => {});
  }, []);

  const [ola, setOla] = useState<{ t: string; d: string } | null>(null);
  useEffect(() => {
    const f = () => {
      const h = Number(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).slice(0, 2));
      const d = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
      setOla({ t: h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite", d: d.charAt(0).toUpperCase() + d.slice(1).replace(/-feira/, "") });
    };
    f(); const i = setInterval(f, 60_000); return () => clearInterval(i);
  }, []);

  const lugar = local ?? LOCAL_PADRAO;
  return (
    <main className="page agora">
      <header className="aba-cab">
        <p className="aba-sub">{ola?.d ?? " "}{pronto ? ` · ${lugar.nome}` : ""}</p>
        <h1 className="t-titulo">{ola?.t ?? " "}</h1>
      </header>
      <div className="agora-cards cascata">
        {!pronto ? <><Skel h={96} r={18} /><Skel h={220} r={18} /><Skel h={120} r={18} /></> : (
          <>
            {/* Sem local salvo, abre já com o Centro do Rio: a primeira tela mostra dado, não um convite vazio. */}
            <ResumoTempo local={lugar} semLocal={!local} />
            {mob.ponto && mob.linha ? <CartaoTransporte {...mob} ponto={mob.ponto} linha={mob.linha} /> : (
              <Link href="/mobilidade" className="cartao cartao-convite" aria-label="Acompanhar um ônibus ou BRT na aba Trajeto">
                <BusFront aria-hidden /><span><b>Acompanhar ônibus ou BRT</b><small>Chegada estimada na sua estação</small></span><ChevronRight aria-hidden className="seta" />
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/** Aviso do dia (vai para Atenção) + resumo do tempo (vai para Tempo). Um só pedido de cada fonte. */
function ResumoTempo({ local, semLocal }: { local: J; semLocal: boolean }) {
  const chave = `monitora:home:dia:${coord(local.lat)},${coord(local.lng)}`;
  const [t, setT] = useState<J | null>(null);
  const [c, setC] = useState<J | null>(null);
  const enche = useEnche();
  useEffect(() => {
    setT(lerCache(chave, 3 * 3600_000)?.dado ?? null);
    get(`/tempo/completo?lat=${coord(local.lat)}&lng=${coord(local.lng)}`, AbortSignal.timeout(15_000)).then((r) => {
      if (!r.erro) gravarCache(chave, r);
      setT((ant) => (r.erro && ant && !ant.erro ? ant : r));
    });
    get("/cidade", AbortSignal.timeout(10_000)).then(setC);
  }, [local, chave]);
  if (!t) return <><Skel h={96} r={18} /><Skel h={220} r={18} /></>;
  const k = t.erro ? null : t.calculado, a = k?.agora, hoje = k?.dias?.[0];
  const cid = c?.observado;
  const horas: J[] = (k?.horas ?? []) as J[];
  const { destaque } = resumoDoDia({ estagio: cid?.estagio, calor: cid?.calor, hoje, horas: k?.horas, hora: (s) => horaLocal(s).slice(0, 2) + "h" });
  const pChuva = Math.max(0, ...horas.slice(0, 12).map((h) => h.probabilidadeChuvaPct ?? 0));
  const alerta = destaque.nivel === "critico" || destaque.nivel === "atencao";
  return (
    <>
      <Link href="/atencao" className={`cartao aviso${alerta ? " aviso-alerta" : ""}`} role={destaque.nivel === "critico" ? "alert" : undefined}
        aria-label={`${destaque.titulo}. ${destaque.texto} Abrir Atenção.`}>
        <span className="aviso-corpo"><b>{destaque.titulo}</b><span>{destaque.texto}</span></span>
        <ChevronRight aria-hidden className="seta" />
      </Link>
      {t.erro ? <div className="cartao"><ErrorState texto="Não foi possível montar o resumo do tempo agora." /></div> : (
        <Link href="/clima" ref={enche as React.Ref<HTMLAnchorElement>} className="cartao resumo-tempo"
          aria-label={`Tempo em ${local.nome}: ${a?.temperaturaC != null ? Math.round(a.temperaturaC) + " graus" : "sem dado"}, chance de chuva até ${pChuva}% nas próximas 12 horas. Abrir Tempo.`}>
          <div className="rt-linha">
            <span className="rt-num num"><NumeroRolante valor={a?.temperaturaC == null ? "—" : `${Math.round(a.temperaturaC)}°`} /></span>
            <span className="rt-txt">{a?.descricao?.texto ?? "—"}<br />chance de chuva {pChuva}% nas próximas 12 h</span>
          </div>
          {hoje?.maxC != null && <p className="rt-meta">Máx. {Math.round(hoje.maxC)}° · mín. {Math.round(hoje.minC)}°{hoje?.uvMax != null ? ` · UV ${Math.round(hoje.uvMax)}` : ""}</p>}
          <span className="rt-sec">Hora a hora</span>
          <div className="gh-rolo rt-horas" aria-hidden>
            {horas.slice(0, 5).map((h, j) => {
              const p = h.probabilidadeChuvaPct ?? 0;
              return (
                <span key={h.inicio} className="gh-h">
                  <span className="gh-hora">{j === 0 ? "Agora" : horaLocal(h.inicio).slice(0, 2) + "h"}</span>
                  <span className={`gh-cartao${h.dia === false ? " noite" : ""}`} style={{ ["--k" as string]: j }}>
                    <i className="gh-agua" style={{ transform: `scaleY(${Math.min(100, p) / 100})` }} />
                    <IconeTempo icone={h.descricao?.icone} dia={h.dia} size={20} />
                    <b className="num">{h.temperaturaC == null ? "—" : `${Math.round(h.temperaturaC)}°`}</b>
                    <small className={`gh-p${p >= 60 ? " alto" : ""}`}>{p >= 20 ? <><Droplets />{p}%</> : " "}</small>
                  </span>
                </span>
              );
            })}
          </div>
          <span className="rt-rodape">{semLocal ? "Centro do Rio · toque para escolher seu bairro" : "Previsão Open-Meteo"}<ChevronRight aria-hidden /></span>
        </Link>
      )}
    </>
  );
}

function CartaoTransporte({ ponto, linha, sentido, modo }: { ponto: J; linha: string; sentido: string | null; modo: string | null }) {
  const [d, setD] = useState<J | null>(null);
  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      const [c, v] = await Promise.all([
        get(`/chegada?linha=${encodeURIComponent(linha)}&lat=${ponto.lat}&lng=${ponto.lng}`, AbortSignal.timeout(15_000)),
        sentido ? get(`/linhas/${encodeURIComponent(linha)}/veiculos${modo ? `?modo=${modo}` : ""}`, AbortSignal.timeout(15_000)) : Promise.resolve(null),
      ]);
      if (vivo) setD({ c, v, em: Date.now() });
    };
    carregar();
    const i = setInterval(() => { if (!document.hidden) carregar(); }, 20_000);
    return () => { vivo = false; clearInterval(i); };
  }, [ponto, linha, sentido, modo]);
  if (!d) return <Skel h={120} r={18} />;
  if (d.c?.erro) return <div className="cartao"><ErrorState texto="Transporte indisponível agora." /></div>;
  const ids = sentido && d.v?.observado ? new Set((d.v.observado as J[]).filter((x) => mesmoDestino(x.destino, sentido)).map((x) => `${x.fonte}:${x.veiculo}`)) : null;
  const chegadas: J[] = d.c?.calculado?.chegadas ?? [];
  const prox = ids ? chegadas.find((x) => ids.has(`${x.fonte}:${x.veiculo}`)) ?? null : d.c?.calculado?.proxima ?? null;
  // Mesma regra do Trajeto: desconta a idade do GPS e não mostra estimativa com GPS velho (> 5 min).
  const idade = prox?.ultimaLeitura ? (Date.now() - Date.parse(prox.ultimaLeitura)) / 60000 : 0;
  const min = prox?.etaMin != null && idade <= 5 ? Math.max(1, Math.round(prox.etaMin - Math.max(0, idade))) : null;
  return (
    <Link href="/mobilidade" className="cartao cartao-mob"
      aria-label={`Linha ${linha}${sentido ? `, sentido ${sentido}` : ""}, em ${ponto.nome}: ${min != null ? `chegada estimada em ${min} minutos` : "sem estimativa agora"}. Abrir Trajeto.`}>
      <div className="cm-topo"><span className="line-badge">{linha}</span><span className="cm-rot">{sentido ? `→ ${sentido}` : ponto.nome}</span></div>
      <div className="cm-linha">
        {min != null ? <><span className="cm-num num"><NumeroRolante valor={min} /></span><span className="cm-min">min</span><span className="cm-sub">chegada estimada em {ponto.nome} · pode variar ±25%</span></>
          : <span className="cm-sem">Nenhum veículo se aproximando de {ponto.nome} agora</span>}
      </div>
      <LastUpdated em={prox?.ultimaLeitura ?? d.em} fonte="GPS SMTR" velhoS={60} />
    </Link>
  );
}
