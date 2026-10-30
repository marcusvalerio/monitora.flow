"use client";
/**
 * Home: abrir o app já responde "vai chover?" e "quanto falta pro meu ônibus?".
 * Dois cartões no material do app (atmosfera do clima + vidro) e um atalho discreto para a operação da cidade.
 * Só dados que já existem: local salvo do clima → /tempo; estação e linha salvas da Mobilidade → /chegada (+ /veiculos para o sentido).
 * Nada inventado: campo ausente some; a chegada é sempre "estimada" e mostra a fonte e a idade do dado.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { BusFront, ChevronRight, CloudSun, CloudLightning, Droplets, Info, ShieldAlert, Smile, Sun, Thermometer, Umbrella } from "lucide-react";
import { MarcaMonitora } from "./Geometria";
import { ErrorState, LastUpdated, Skel } from "./estados";
import { J, coord, distKm, get, gravarCache, horaLocal, ler, lerCache, minhaPosicao } from "./util";
import { resumoDoDia } from "../../src/lib/resumoDia";
import WeatherAtmosphere, { atmosferaDe } from "../clima/atmosfera/WeatherAtmosphere";
import { mesmoDestino } from "../../src/lib/trajeto";

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
    // Localização já liberada antes? Usa onde a pessoa está agora (sem pedir permissão de novo).
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((st) => {
      if (st.state !== "granted") return;
      minhaPosicao().then((p) => { if (!("erro" in p) && (!salvo || distKm(salvo as { lat: number; lng: number }, p) > 2)) setLocal({ nome: "Perto de você", lat: p.lat, lng: p.lng }); });
    }).catch(() => {});
  }, []);

  return (
    <main className="page home">
      <div className="home-marca"><MarcaMonitora size={26} /><span>Monitora</span></div>
      <div className="home-cards">
        {!pronto ? <><Skel h={188} r={24} /><Skel h={150} r={24} /></> : (
          <>
            {local ? <SeuDia local={local} /> : (
              <Link href="/clima" className="hc hc-convite appear" aria-label="Ver o clima perto de você">
                <CloudSun aria-hidden /><span><b>Como vai ser seu dia?</b><small>Escolha um local para ver avisos, clima e chuva</small></span><ChevronRight aria-hidden className="seta" />
              </Link>
            )}
            {mob.ponto && mob.linha ? <CartaoTransporte {...mob} ponto={mob.ponto} linha={mob.linha} /> : (
              <Link href="/mobilidade" className="hc hc-convite appear" style={{ animationDelay: "60ms" }} aria-label="Acompanhar um ônibus ou BRT">
                <BusFront aria-hidden /><span><b>Acompanhar um ônibus ou BRT</b><small>Chegada estimada na sua estação</small></span><ChevronRight aria-hidden className="seta" />
              </Link>
            )}
          </>
        )}
      </div>
      <Link href="/alertas" className="home-op">Ocorrências perto de você <ChevronRight aria-hidden /></Link>
    </main>
  );
}

const ICONE_DESTAQUE: Record<string, React.ElementType> = { estagio: ShieldAlert, calor: Thermometer, tempestade: CloudLightning, chuva: Umbrella, uv: Sun, sensacao: Droplets, ok: Smile };

/**
 * "Seu dia": o topo é UMA mensagem (estágio da cidade, calor, chuva, protetor…), escolhida por prioridade
 * em src/lib/resumoDia.ts. Abaixo, uma linha com o essencial do clima. Nada daqui usa o banco.
 */
function SeuDia({ local }: { local: J }) {
  const chave = `monitora:home:dia:${coord(local.lat)},${coord(local.lng)}`;
  const [t, setT] = useState<J | null>(null);
  const [c, setC] = useState<J | null>(null);
  useEffect(() => {
    setT(lerCache(chave, 3 * 3600_000)?.dado ?? null); // abre na hora com o último resultado
    get(`/tempo/completo?lat=${coord(local.lat)}&lng=${coord(local.lng)}`, AbortSignal.timeout(15_000)).then((r) => {
      if (!r.erro) gravarCache(chave, r);
      setT((ant) => (r.erro && ant && !ant.erro ? ant : r));
    });
    get("/cidade", AbortSignal.timeout(10_000)).then(setC);
  }, [local, chave]);
  if (!t) return <Skel h={188} r={24} />;
  if (t.erro) return <div className="hc"><ErrorState texto="Não foi possível montar o resumo do dia agora." /></div>;
  const k = t.calculado, a = k?.agora, hoje = k?.dias?.[0];
  const cid = c?.observado;
  const { destaque, dicas } = resumoDoDia({ estagio: cid?.estagio, calor: cid?.calor, hoje, horas: k?.horas, hora: (s) => horaLocal(s).slice(0, 2) + "h" });
  const Ic = ICONE_DESTAQUE[destaque.tipo] ?? Info;
  const tipo = atmosferaDe(a?.descricao?.icone, a?.dia);
  const pChuva = Math.max(0, ...((k?.horas ?? []) as J[]).slice(0, 12).map((h) => h.probabilidadeChuvaPct ?? 0));
  return (
    <section className="dia appear" aria-label={`Seu dia em ${local.nome}`}>
      <div className={`dia-head nv-${destaque.nivel}`} role={destaque.nivel === "critico" ? "alert" : undefined}>
        <Ic aria-hidden />
        <div><b>{destaque.titulo}</b><span>{destaque.texto}</span></div>
      </div>
      <Link href="/clima" className={`hc hc-clima on-${tipo} dia-clima`} aria-label={`Clima em ${local.nome}: ${a?.temperaturaC != null ? Math.round(a.temperaturaC) + " graus" : "sem dado"}`}>
        <WeatherAtmosphere tipo={tipo} />
        <div className="hc-corpo">
          <span className="hc-rot">{local.nome}</span>
          <div className="hc-linha"><span className="hc-num num">{a?.temperaturaC == null ? "—" : `${Math.round(a.temperaturaC)}°`}</span>{a?.descricao?.texto && <span className="hc-txt">{a.descricao.texto}</span>}</div>
          <div className="dia-chips">
            {hoje?.maxC != null && <span>↑{Math.round(hoje.maxC)}° ↓{Math.round(hoje.minC)}°</span>}
            <span><Umbrella aria-hidden />{pChuva}%</span>
            {hoje?.uvMax != null && <span><Sun aria-hidden />UV {Math.round(hoje.uvMax)}</span>}
            {cid?.estagio && <span>Estágio {cid.estagio.nivel}</span>}
          </div>
        </div>
      </Link>
      {dicas.length > 0 && (
        <ul className="dia-dicas">{dicas.map((d) => { const I = ICONE_DESTAQUE[d.tipo] ?? Info; return <li key={d.tipo}><I aria-hidden /><span><b>{d.titulo}.</b> {d.texto}</span></li>; })}</ul>
      )}
    </section>
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
  if (!d) return <Skel h={150} r={24} />;
  if (d.c?.erro) return <div className="hc"><ErrorState texto="Transporte indisponível agora." /></div>;
  // sentido salvo: só veículos daquele destino (mesma regra da Mobilidade)
  const ids = sentido && d.v?.observado ? new Set((d.v.observado as J[]).filter((x) => mesmoDestino(x.destino, sentido)).map((x) => `${x.fonte}:${x.veiculo}`)) : null;
  const chegadas: J[] = d.c?.calculado?.chegadas ?? [];
  const prox = ids ? chegadas.find((x) => ids.has(`${x.fonte}:${x.veiculo}`)) ?? null : d.c?.calculado?.proxima ?? null;
  const min = prox?.etaMin != null ? Math.max(1, Math.round(prox.etaMin)) : null;
  return (
    <Link href="/mobilidade" className="hc hc-mob appear" style={{ animationDelay: "60ms" }}
      aria-label={`Linha ${linha}${sentido ? `, sentido ${sentido}` : ""}, em ${ponto.nome}: ${min != null ? `chegada estimada em ${min} minutos` : "sem estimativa agora"}`}>
      <div className="hc-topo"><span className="line-badge">{linha}</span><span className="hc-rot">{sentido ? `→ ${sentido}` : ponto.nome}</span></div>
      <div className="hc-linha">
        {min != null ? <><span className="hc-num num">{min}</span><span className="hc-txt">min</span><span className="hc-sub">chegada estimada em {ponto.nome}</span></>
          : <span className="hc-txt hc-sem">Nenhum veículo se aproximando de {ponto.nome} agora</span>}
      </div>
      <LastUpdated em={prox?.ultimaLeitura ?? d.em} fonte="GPS SMTR" velhoS={60} />
    </Link>
  );
}
