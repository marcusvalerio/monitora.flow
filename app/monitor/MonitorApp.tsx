"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Orbita } from "../ui/Geometria";
import { CloudRain, TriangleAlert } from "lucide-react";
import { ErrorState, LastUpdated, Skel } from "../ui/estados";
import { J, dec, get } from "../ui/util";
import type { PontoFrota } from "./MonitorMap";
import { COR_ESTADO } from "./MonitorMap";

const MonitorMap = dynamic(() => import("./MonitorMap"), { ssr: false, loading: () => <div className="map-carregando"><Orbita rotulo="Carregando o mapa" /></div> });

const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR"));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const ROTULO: Record<string, string> = { ON_ROUTE: "No trajeto", UNCERTAIN: "Posição incerta", OFF_ROUTE: "Fora do trajeto", STALE: "Sem atualização recente" };

export default function MonitorApp() {
  const [d, setD] = useState<J | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "BRT" | "BUS">("todos");
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    let vivo = true;
    const carregar = async () => { const r = await get("/monitor/dados"); if (vivo) setD({ ...r, em: Date.now() }); };
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 30_000);
    setAgora(new Date());
    const r = setInterval(() => setAgora(new Date()), 15_000);
    return () => { vivo = false; clearInterval(t); clearInterval(r); };
  }, []);

  const pontos: PontoFrota[] = useMemo(() => (d?.pontos ?? []).filter((p: PontoFrota) => filtro === "todos" || p[2] === filtro), [d, filtro]);
  const o = d?.observado;
  const brt = o?.brt, bus = o?.onibus, est = brt?.estados;
  const hora = agora?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <div className="monitor">
      <main className="monitor-col">
        <header>
          <div className="t-label">Monitor</div>
          <div className="row" style={{ gap: 10, marginTop: 6, alignItems: "baseline" }}>
            <span className="t-title num">{hora}</span><span className="t-cap">Rio de Janeiro</span>
          </div>
        </header>

        {!d ? (
          <div style={{ display: "grid", gap: 14, marginTop: 28 }} aria-busy="true"><Skel h={84} w={220} /><Skel h={18} w={160} /><Skel h={120} /><Skel h={120} /></div>
        ) : d.erro ? <ErrorState texto="Não foi possível carregar a operação agora." />
        : (
          <>
            <section className="m-hero appear" aria-label="Veículos observados">
              <div className="t-display num">{n(o.total)}</div>
              <div className="t-head">veículos observados agora</div>
              <div className="t-cap" style={{ marginTop: 4 }}>com GPS nos últimos 10 min · BRT e ônibus municipais</div>
              <div style={{ marginTop: 10 }}><LastUpdated em={d.fonteAoVivoEm} fonte="GPS SMTR" velhoS={90} /></div>
            </section>

            <section className="m-sec stag" style={{ ["--i" as string]: 1 }} aria-label="Qualidade dos dados">
              <div className="t-label">Qualidade dos dados</div>
              <div className="m-big"><span className="num">{pct(o.recentes, o.total) ?? "—"}</span><small>%</small></div>
              <div className="t-cap">com posição recente (até 2 min)</div>
              <div className="m-row">
                <M v={n(o.recentes)} r="recentes" /><M v={n((brt?.velhos ?? 0) + (bus?.velhos ?? 0))} r="desatualizados" /><M v={n((brt?.parados ?? 0) + (bus?.parados ?? 0))} r="parados" />
              </div>
            </section>

            <section className="m-sec stag" style={{ ["--i" as string]: 2 }} aria-label="BRT">
              <div className="t-label">BRT</div>
              <div className="m-row">
                <M v={n(brt?.veiculos)} r="veículos" grande /><M v={n(brt?.linhas)} r="linhas" grande />
              </div>
              {est && <Estados est={est} />}
            </section>

            <section className="m-sec stag" style={{ ["--i" as string]: 3 }} aria-label="Ônibus">
              <div className="t-label">Ônibus municipais</div>
              <div className="m-row"><M v={n(bus?.veiculos)} r="veículos" grande /><M v={n(bus?.linhas)} r="linhas" grande /></div>
              {bus?.estados && <Estados est={bus.estados} nota="Cada ônibus comparado ao shape da própria viagem (shape_id informado pelo GPS). Inclui os alimentadores do BRT, que no GTFS são ônibus." />}
              {o.outros?.veiculos > 0 && <p className="t-meta">{n(o.outros.veiculos)} veículos do GPS do BRT com código de linha que o GTFS não reconhece ficam fora das contas de BRT e ônibus.</p>}
            </section>

            <section className="m-sec stag" style={{ ["--i" as string]: 4 }} aria-label="Impactos">
              <div className="t-label">Impactos</div>
              <div className="m-line">
                <CloudRain aria-hidden />
                {d.chuva ? (
                  <div><div className="t-head">{d.chuva.comChuvaNaUltimaHora ? `Chuva em ${d.chuva.comChuvaNaUltimaHora} de ${d.chuva.estacoes} pluviômetros` : "Sem chuva medida na última hora"}</div>
                    <div className="t-cap">{d.chuva.maior ? `Maior: ${d.chuva.maior.nome}, ${dec(d.chuva.maior.mmH01)} mm na última hora` : ""}</div>
                    <div style={{ marginTop: 4 }}><LastUpdated em={d.chuva.geradoEm} fonte="Alerta Rio" velhoS={1800} /></div></div>
                ) : <div className="t-cap">Chuva medida indisponível agora.</div>}
              </div>
              <div className="m-line">
                <TriangleAlert aria-hidden />
                <div><div className="t-head">Ocorrências indisponíveis</div>
                  <div className="t-cap">Acidentes, interdições e alagamentos dependem de fonte aberta do COR, que não está respondendo. Não mostramos números sem fonte.</div></div>
              </div>
            </section>
          </>
        )}
      </main>

      <section className="monitor-map" aria-label="Mapa operacional">
        <MonitorMap pontos={pontos} />
        <div className="glass m-filtros" role="tablist" aria-label="Filtrar veículos">
          {([["todos", "Todos"], ["BRT", "BRT"], ["BUS", "Ônibus"]] as const).map(([k, r]) => (
            <button key={k} role="tab" aria-selected={filtro === k} className={`seg${filtro === k ? " on" : ""}`} onClick={() => setFiltro(k)}>{r}</button>
          ))}
          <span className="t-meta num" style={{ padding: "0 8px" }}>{n(pontos.length)}</span>
        </div>
      </section>
    </div>
  );
}

function Estados({ est, nota }: { est: Record<string, number>; nota?: string }) {
  return (
    <>
      <div className="m-bar" role="img" aria-label={Object.entries(ROTULO).map(([k, r]) => `${r}: ${est[k]}`).join(", ")}>
        {Object.keys(ROTULO).map((k) => est[k] > 0 && <i key={k} style={{ flex: est[k], background: COR_ESTADO[k] }} />)}
      </div>
      <ul className="m-legend">
        {Object.entries(ROTULO).map(([k, r]) => (
          <li key={k}><i style={{ background: COR_ESTADO[k] }} /><span>{r}</span><b className="num">{n(est[k])}</b></li>
        ))}
      </ul>
      <p className="t-meta">{nota ?? "Comparado ao trajeto oficial (GTFS): no trajeto até 60 m e rumo compatível, incerta até 300 m, fora acima disso; sem atualização: mais de 3 min."}</p>
    </>
  );
}

function M({ v, r, grande }: { v: string; r: string; grande?: boolean }) {
  return <div className="m-metric"><div className={`num ${grande ? "m-v-g" : "m-v"}`}>{v}</div><div className="t-cap">{r}</div></div>;
}
