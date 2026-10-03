"use client";
/**
 * Home: abrir o app já responde "vai chover?" e "quanto falta pro meu ônibus?".
 * Dois cartões no material do app (atmosfera do clima + vidro) e um atalho discreto para a operação da cidade.
 * Só dados que já existem: local salvo do clima → /tempo; estação e linha salvas da Mobilidade → /chegada (+ /veiculos para o sentido).
 * Nada inventado: campo ausente some; a chegada é sempre "estimada" e mostra a fonte e a idade do dado.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { BusFront, ChevronRight, CloudSun } from "lucide-react";
import { MarcaMonitora } from "./Geometria";
import { ErrorState, LastUpdated, Skel } from "./estados";
import { J, get, horaLocal, ler } from "./util";
import WeatherAtmosphere, { atmosferaDe } from "../clima/atmosfera/WeatherAtmosphere";
import { mesmoDestino } from "../../src/lib/trajeto";

export default function Home() {
  const [pronto, setPronto] = useState(false);
  const [local, setLocal] = useState<J | null>(null);
  const [mob, setMob] = useState<{ ponto: J | null; linha: string | null; sentido: string | null; modo: string | null }>({ ponto: null, linha: null, sentido: null, modo: null });

  useEffect(() => {
    setLocal(ler<J | null>("monitora:clima:local", null));
    setMob({
      ponto: ler<J | null>("monitora:mob:ponto", null), linha: ler<string | null>("monitora:mob:linha", null),
      sentido: ler<string | null>("monitora:mob:sentido", null), modo: ler<string | null>("monitora:mob:modo", null),
    });
    setPronto(true);
  }, []);

  return (
    <main className="page home">
      <div className="home-marca"><MarcaMonitora size={26} /><span>Monitora</span></div>
      <div className="home-cards">
        {!pronto ? <><Skel h={188} r={24} /><Skel h={150} r={24} /></> : (
          <>
            {local ? <CartaoClima local={local} /> : (
              <Link href="/clima" className="hc hc-convite appear" aria-label="Ver o clima perto de você">
                <CloudSun aria-hidden /><span><b>Ver o clima perto de você</b><small>Agora, próximas horas e a semana</small></span><ChevronRight aria-hidden className="seta" />
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
      <Link href="/monitor" className="home-op">Operação da cidade <ChevronRight aria-hidden /></Link>
    </main>
  );
}

function CartaoClima({ local }: { local: J }) {
  const [t, setT] = useState<J | null>(null);
  useEffect(() => { get(`/tempo?lat=${local.lat}&lng=${local.lng}`, AbortSignal.timeout(15_000)).then(setT); }, [local]);
  if (!t) return <Skel h={188} r={24} />;
  if (t.erro) return <div className="hc"><ErrorState texto="Clima indisponível agora." /></div>;
  const a = t.calculado?.agora, temp = a?.temperaturaC;
  const tipo = atmosferaDe(a?.descricao?.icone, a?.dia);
  // contexto curto: só se a previsão trouxer chuva provável nas próximas 12 h
  const chuva = (t.calculado?.proximasHoras ?? []).slice(1, 13).find((h: J) => (h.probabilidadeChuvaPct ?? 0) >= 50);
  const texto = a?.descricao?.texto ?? null;
  return (
    <Link href="/clima" className={`hc hc-clima on-${tipo} appear`}
      aria-label={`Clima em ${local.nome}${temp != null ? `, ${Math.round(temp)} graus` : ""}${texto ? `, ${texto.toLowerCase()}` : ""}${chuva ? `, chuva prevista por volta das ${horaLocal(chuva.inicio).slice(0, 2)} horas` : ""}`}>
      <WeatherAtmosphere tipo={tipo} />
      <div className="hc-corpo">
        <span className="hc-rot">{local.nome}</span>
        <div className="hc-linha"><span className="hc-num num">{temp == null ? "—" : `${Math.round(temp)}°`}</span>{texto && <span className="hc-txt">{texto}</span>}</div>
        {chuva && <span className="hc-ctx">Chuva prevista ~{horaLocal(chuva.inicio).slice(0, 2)}h · {chuva.probabilidadeChuvaPct}%</span>}
      </div>
    </Link>
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
