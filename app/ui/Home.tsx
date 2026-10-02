"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CloudSun, BusFront, ChevronRight, Radar, Activity } from "lucide-react";
import { IconeTempo } from "./estados";
import { J, get, ler } from "./util";

export default function Home() {
  const [local, setLocal] = useState<J | null>(null);
  const [tempo, setTempo] = useState<J | null>(null);
  const [mob, setMob] = useState<{ ponto: J | null; linha: string | null }>({ ponto: null, linha: null });

  useEffect(() => {
    const l = ler<J | null>("monitora:clima:local", null);
    setLocal(l);
    setMob({ ponto: ler<J | null>("monitora:mob:ponto", null), linha: ler<string | null>("monitora:mob:linha", null) });
    if (l) get(`/tempo?lat=${l.lat}&lng=${l.lng}`).then(setTempo);
  }, []);
  const a = tempo?.calculado?.agora;

  return (
    <main className="page">
      <div className="row" style={{ gap: 8, color: "var(--text-2)" }}><Radar size={18} aria-hidden /><span className="t-head">Monitora</span></div>
      <h1 className="t-hero" style={{ margin: "28px 0 6px" }}>O que você quer fazer?</h1>
      <p className="t-body muted" style={{ margin: 0 }}>Clima, transporte e a operação da cidade agora, com dados abertos.</p>

      <div className="actions">
        <Link href="/clima" className="action appear">
          <span className="ico" style={{ background: "color-mix(in srgb, var(--info) 14%, transparent)", color: "var(--info)" }}><CloudSun aria-hidden /></span>
          <span style={{ flex: 1 }}><div className="t-title">Ver o clima</div><div className="t-cap">Agora, próximas horas e próximos dias</div></span>
          <ChevronRight aria-hidden style={{ color: "var(--text-3)" }} />
        </Link>
        <Link href="/mobilidade" className="action appear">
          <span className="ico" style={{ background: "color-mix(in srgb, var(--brt) 14%, transparent)", color: "var(--brt)" }}><BusFront aria-hidden /></span>
          <span style={{ flex: 1 }}><div className="t-title">Acompanhar transporte</div><div className="t-cap">BRT e ônibus ao vivo, chegada estimada</div></span>
          <ChevronRight aria-hidden style={{ color: "var(--text-3)" }} />
        </Link>
        <Link href="/monitor" className="action appear">
          <span className="ico" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}><Activity aria-hidden /></span>
          <span style={{ flex: 1 }}><div className="t-title">Ver a operação agora</div><div className="t-cap">Frota observada, qualidade dos dados e chuva</div></span>
          <ChevronRight aria-hidden style={{ color: "var(--text-3)" }} />
        </Link>
      </div>

      {(local || mob.ponto) && (
        <section className="section">
          <span className="t-label">Na sua região</span>
          <div className="surface" style={{ padding: "4px 16px" }}>
            {local && (
              <Link href="/clima" className="list-item" aria-label={`Clima em ${local.nome}`}>
                <span className="ico"><IconeTempo icone={a?.descricao?.icone} dia={a?.dia} /></span>
                <span className="main"><div className="t-head">{local.nome}</div><div className="t-cap">{a ? a.descricao?.texto ?? "" : "Carregando clima…"}</div></span>
                <span className="t-title num">{a?.temperaturaC == null ? "" : `${Math.round(a.temperaturaC)}°`}</span>
              </Link>
            )}
            {mob.ponto && (
              <Link href="/mobilidade" className="list-item">
                <span className="ico" style={{ color: "var(--brt)" }}><BusFront aria-hidden /></span>
                <span className="main"><div className="t-head">{mob.linha ? `Continuar: linha ${mob.linha}` : mob.ponto.nome}</div><div className="t-cap">{mob.linha ? mob.ponto.nome : "Última estação consultada"}</div></span>
                <ChevronRight aria-hidden style={{ color: "var(--text-3)" }} />
              </Link>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
