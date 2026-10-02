"use client";
import { CloudOff, SearchX, Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning, Snowflake, Moon, CloudMoon } from "lucide-react";
import { Arcos } from "./Geometria";
import { ha } from "./util";

export function EmptyState({ titulo, texto, icone: Icone = SearchX, acao }: { titulo: string; texto?: string; icone?: React.ElementType; acao?: React.ReactNode }) {
  return (
    <div className="state empty appear" role="status">
      <span className="ico-wrap"><Arcos /><Icone aria-hidden /></span>
      <div className="t-head">{titulo}</div>
      {texto && <div className="t-cap" style={{ marginTop: 4 }}>{texto}</div>}
      {acao && <div style={{ marginTop: 14 }}>{acao}</div>}
    </div>
  );
}

export function ErrorState({ texto, tentar }: { texto: string; tentar?: () => void }) {
  return (
    <EmptyState icone={CloudOff} titulo={texto} acao={tentar && <button className="btn btn-ghost" onClick={tentar}>Tentar de novo</button>} />
  );
}

export function Skel({ h = 16, w = "100%", r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
}

export function LastUpdated({ em, fonte, velhoS = 90 }: { em?: string | number | Date | null; fonte?: string; velhoS?: number }) {
  const idade = em ? (Date.now() - new Date(em).getTime()) / 1000 : Infinity;
  return (
    <span className="t-meta row" style={{ gap: 6, display: "inline-flex" }} aria-live="polite">
      {/* key = instante do dado: a cada atualização real o ponto "pulsa" uma vez (nunca sem dado novo) */}
      <span key={em ? String(em) : "x"} className={`live-dot${idade > velhoS ? " stale" : " pulso"}`} aria-hidden />
      {em ? `Atualizado ${ha(em)}` : "Atualizando…"}{fonte ? ` · ${fonte}` : ""}
    </span>
  );
}

/** Ícone do tempo a partir da família devolvida pela API (descreverWmo). */
export function IconeTempo({ icone, dia = true, size = 22 }: { icone?: string | null; dia?: boolean | null; size?: number }) {
  const p = { size, "aria-hidden": true, strokeWidth: 1.7 } as const;
  switch (icone) {
    case "sol": return dia === false ? <Moon {...p} /> : <Sun {...p} />;
    case "parcial": return dia === false ? <CloudMoon {...p} /> : <CloudSun {...p} />;
    case "nublado": return <Cloud {...p} />;
    case "neblina": return <CloudFog {...p} />;
    case "garoa": return <CloudDrizzle {...p} />;
    case "chuva": return <CloudRain {...p} />;
    case "tempestade": return <CloudLightning {...p} />;
    case "neve": return <Snowflake {...p} />;
    default: return <Cloud {...p} />;
  }
}
