"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Cena animada do clima atual (só decoração; aria-hidden). Escolhe camadas pela condição
 * descrita pelo código WMO (descreverWmo → icone) e por dia/noite informado pela previsão.
 * Sem dado de condição → só o céu neutro (não inventamos tempo).
 * Respeita prefers-reduced-motion via CSS (.wx * { animation: none }).
 */
export type Icone = "sol" | "parcial" | "nublado" | "neblina" | "garoa" | "chuva" | "tempestade" | "neve";

const rnd = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

export default function WeatherScene({ icone, dia, children }: { icone?: Icone | null; dia?: boolean | null; children: React.ReactNode }) {
  const noite = dia === false;
  const ic = icone ?? null;
  const ceu = ic === null ? "neutro" : noite ? (ic === "sol" || ic === "parcial" ? "noite" : "noite-nublada")
    : ic === "sol" ? "sol" : ic === "parcial" ? "parcial" : ic === "tempestade" ? "tempestade" : ic === "chuva" || ic === "garoa" ? "chuva" : ic === "neblina" ? "neblina" : ic === "neve" ? "neve" : "nublado";
  const chuva = ic === "chuva" || ic === "tempestade" ? 46 : ic === "garoa" ? 22 : 0;
  const nuvens = ic === "parcial" ? 2 : ic === "nublado" || ic === "chuva" || ic === "garoa" || ic === "tempestade" ? 4 : ic === "neblina" ? 1 : 0;

  const gotas = useMemo(() => Array.from({ length: chuva }, (_, i) => ({
    l: rnd(i + 1) * 100, d: 0.55 + rnd(i + 7) * 0.5, a: rnd(i + 13) * -2, o: 0.35 + rnd(i + 3) * 0.5, h: ic === "garoa" ? 8 : 14 + rnd(i) * 10,
  })), [chuva, ic]);
  const estrelas = useMemo(() => Array.from({ length: noite ? 26 : 0 }, (_, i) => ({ l: rnd(i + 31) * 100, t: rnd(i + 57) * 70, s: 1 + rnd(i + 5) * 1.6, a: rnd(i + 11) * 4 })), [noite]);

  return (
    <div className={`wx wx-${ceu}`}>
      <div className="wx-sky" aria-hidden>
        {!noite && (ic === "sol" || ic === "parcial") && <div className="wx-sun"><i /><b /></div>}
        {noite && (ic === "sol" || ic === "parcial") && <div className="wx-moon" />}
        {estrelas.map((s, i) => <span key={i} className="wx-star" style={{ left: `${s.l}%`, top: `${s.t}%`, width: s.s, height: s.s, animationDelay: `${s.a}s` }} />)}
        {Array.from({ length: nuvens }, (_, i) => (
          <div key={i} className={`wx-cloud c${i}`} style={{ top: `${8 + i * 14}%`, animationDuration: `${38 + i * 14}s`, animationDelay: `${-i * 11}s`, opacity: 0.55 + (i % 2) * 0.25 }} />
        ))}
        {ic === "neblina" && <><div className="wx-fog f0" /><div className="wx-fog f1" /><div className="wx-fog f2" /></>}
        {gotas.map((g, i) => <span key={i} className="wx-drop" style={{ left: `${g.l}%`, height: g.h, opacity: g.o, animationDuration: `${g.d}s`, animationDelay: `${g.a}s` }} />)}
        {ic === "neve" && Array.from({ length: 30 }, (_, i) => <span key={i} className="wx-flake" style={{ left: `${rnd(i + 2) * 100}%`, animationDuration: `${4 + rnd(i) * 4}s`, animationDelay: `${-rnd(i + 9) * 6}s` }} />)}
        {ic === "tempestade" && <div className="wx-flash" />}
      </div>
      <div className="wx-content">{children}</div>
    </div>
  );
}

/** Número que "conta" até o valor (ease-out ~700 ms). Respeita reduced-motion. */
export function ContaNumero({ valor, sufixo = "" }: { valor: number; sufixo?: string }) {
  const [v, setV] = useState(valor);
  const de = useRef(valor);
  const primeiro = useRef(true);
  useEffect(() => {
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ini = primeiro.current ? valor - Math.min(12, Math.max(4, Math.abs(valor) / 3)) : de.current;
    primeiro.current = false;
    if (reduzir || ini === valor) { setV(valor); de.current = valor; return; }
    let raf = 0; const t0 = performance.now(), D = 800;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(ini + (valor - ini) * e));
      if (k < 1) raf = requestAnimationFrame(passo); else de.current = valor;
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{v}{sufixo}</>;
}
