"use client";
/**
 * Atmosfera do clima: só decoração (aria-hidden), desacoplada do conteúdo.
 * Escolha pela condição WMO já calculada em src/lib/tempo.ts (descreverWmo → icone) e por dia/noite da previsão.
 * Sem condição → atmosfera neutra (não inventamos tempo). Movimento só em transform/opacity; desligado com prefers-reduced-motion.
 * Regra de composição: nada animado passa sobre o texto — partículas ficam mascaradas fora da zona da temperatura (canto superior esquerdo).
 */
import { useMemo } from "react";

export type Atmosfera = "clear" | "cloudy" | "rain" | "drizzle" | "storm" | "night" | "neutral";
type Icone = "sol" | "parcial" | "nublado" | "neblina" | "garoa" | "chuva" | "tempestade" | "neve";

export function atmosferaDe(icone: Icone | null | undefined, dia: boolean | null | undefined): Atmosfera {
  if (!icone) return "neutral";
  if (icone === "tempestade") return "storm";
  if (icone === "chuva") return "rain";
  if (icone === "garoa") return "drizzle";
  if (dia === false) return "night";
  if (icone === "sol" || icone === "parcial") return icone === "parcial" ? "cloudy" : "clear";
  return "cloudy"; // nublado, neblina, neve
}

/** Pseudo-aleatório determinístico (mesmo desenho no servidor e no cliente). */
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function Glow({ className }: { className: string }) { return <i className={`atm-glow ${className}`} />; }

function ClearAtmosphere() {
  return <><Glow className="g-sun" /><Glow className="g-haze" /></>;
}
function CloudyAtmosphere() {
  return <><Glow className="g-mass m1" /><Glow className="g-mass m2" /><Glow className="g-mass m3" /></>;
}
function Rain({ n, fina }: { n: number; fina?: boolean }) {
  const gotas = useMemo(() => Array.from({ length: n }, (_, i) => ({
    x: 30 + rnd(i) * 70, // só na metade direita/inferior (texto fica à esquerda)
    d: 1.7 + rnd(i + 9) * 1.4, a: -rnd(i + 3) * 3, o: 0.12 + rnd(i + 5) * 0.22, h: 10 + rnd(i + 7) * 16, perto: rnd(i + 11) > 0.65,
  })), [n]);
  return (
    <div className={`atm-rain${fina ? " fina" : ""}`}>
      {gotas.map((g, i) => (
        <span key={i} className={g.perto ? "perto" : "longe"} style={{ left: `${g.x}%`, height: g.h, opacity: g.o, animationDuration: `${g.d}s`, animationDelay: `${g.a}s` }} />
      ))}
    </div>
  );
}
function DrizzleAtmosphere() { return <><Glow className="g-mass m1 dim" /><Glow className="g-mass m3 dim" /><Rain n={14} fina /></>; }
function RainAtmosphere() { return <><Glow className="g-mass m1 dim" /><Glow className="g-mass m2 dim" /><Rain n={22} /></>; }
function StormAtmosphere() { return <><Glow className="g-mass m1 dim" /><Glow className="g-mass m3 dim" /><Rain n={18} /><i className="atm-flash" /></>; }
function NightAtmosphere() {
  const est = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: 40 + rnd(i + 40) * 58, y: 6 + rnd(i + 70) * 60, s: 1 + rnd(i + 2) * 1.2, a: -rnd(i + 8) * 9 })), []);
  return (
    <>
      <Glow className="g-moon" />
      {est.map((e, i) => <span key={i} className="atm-star" style={{ left: `${e.x}%`, top: `${e.y}%`, width: e.s, height: e.s, animationDelay: `${e.a}s` }} />)}
    </>
  );
}

export default function WeatherAtmosphere({ tipo }: { tipo: Atmosfera }) {
  return (
    <div className={`atm atm-${tipo}`} aria-hidden key={tipo}>
      {tipo === "clear" && <ClearAtmosphere />}
      {tipo === "cloudy" && <CloudyAtmosphere />}
      {tipo === "rain" && <RainAtmosphere />}
      {tipo === "drizzle" && <DrizzleAtmosphere />}
      {tipo === "storm" && <StormAtmosphere />}
      {tipo === "night" && <NightAtmosphere />}
      <i className="atm-grain" />
    </div>
  );
}
