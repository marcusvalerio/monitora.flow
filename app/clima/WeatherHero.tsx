"use client";
import { useEffect, useRef, useState } from "react";
import WeatherAtmosphere, { atmosferaDe } from "./atmosfera/WeatherAtmosphere";
import { IconeTempo } from "../ui/estados";
import type { J } from "../ui/util";

/**
 * Hero do clima: janela atmosférica (WeatherAtmosphere) + conteúdo. Hierarquia: temperatura → condição → sensação/máx/mín → local.
 * Só exibe o que veio da previsão; campo ausente vira "—" / some.
 */
export default function WeatherHero({ agora, hoje, local }: { agora: J | null | undefined; hoje: J | null | undefined; local: string }) {
  const tipo = atmosferaDe(agora?.descricao?.icone, agora?.dia);
  const t = agora?.temperaturaC;
  return (
    <section className={`hero-atm on-${tipo}`} aria-label={`Agora em ${local}`}>
      <WeatherAtmosphere tipo={tipo} />
      <div className="hero-atm-body">
        <div className="hero-local t-meta">Agora</div>
        <div className="hero-temp num" aria-label={t == null ? "Temperatura indisponível" : `${Math.round(t)} graus`}>
          {t == null ? "—" : <ContaNumero valor={Math.round(t)} />}<span className="deg" aria-hidden>°</span>
        </div>
        <div className="hero-cond">
          <IconeTempo icone={agora?.descricao?.icone} dia={agora?.dia} size={20} />
          <span>{agora?.descricao?.texto ?? "Condição indisponível"}</span>
        </div>
        {(agora?.sensacaoC != null || hoje) && (
          <div className="hero-glass">
            {agora?.sensacaoC != null && <span><small>Sensação</small><b className="num">{Math.round(agora.sensacaoC)}°</b></span>}
            {hoje?.maxC != null && <span><small>Máx.</small><b className="num">{Math.round(hoje.maxC)}°</b></span>}
            {hoje?.minC != null && <span><small>Mín.</small><b className="num">{Math.round(hoje.minC)}°</b></span>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Número que "assenta" no valor (ease-out ~800 ms) na primeira exibição e em mudanças. Respeita reduced-motion. */
export function ContaNumero({ valor }: { valor: number }) {
  const [v, setV] = useState(valor);
  const de = useRef<number | null>(null);
  useEffect(() => {
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ini = de.current ?? valor - Math.min(8, Math.max(3, Math.abs(valor) / 4));
    if (reduzir || ini === valor) { setV(valor); de.current = valor; return; }
    let raf = 0; const t0 = performance.now(), D = 900;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 4);
      setV(Math.round(ini + (valor - ini) * e));
      if (k < 1) raf = requestAnimationFrame(passo); else de.current = valor;
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{v}</>;
}
