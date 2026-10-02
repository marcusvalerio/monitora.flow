import { distanciaM } from "./geo";

/**
 * Chuva medida pelos pluviômetros do Alerta Rio (COR / Prefeitura).
 * FONTE: https://alertario.rio.rj.gov.br/upload/xml/Chuvas.xml (pública, sem login; verificada em 02/10/2026).
 * Valores em mm acumulados na janela indicada. Horários no XML são de Brasília (sem fuso) — convertidos para UTC (−03:00).
 */
export const URL_CHUVA = "https://alertario.rio.rj.gov.br/upload/xml/Chuvas.xml";

export interface EstacaoChuva {
  id: string;
  nome: string;
  bacia: string | null;
  lat: number;
  lng: number;
  medidoEm: string | null; // ISO UTC
  mm: { m05: number | null; m10: number | null; m15: number | null; h01: number | null; h04: number | null; h24: number | null; h96: number | null; mes: number | null };
}

const attrs = (s: string) => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const n = (v: string | undefined) => (v === undefined || v === "" || v === "None" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const brtParaUtc = (v: string | undefined) => (v ? new Date(`${v}-03:00`).toISOString() : null);

/** Parser mínimo do XML (formato fixo e simples; não executa nada do documento). */
export function parseChuvas(xml: string): { geradoEm: string | null; estacoes: EstacaoChuva[] } {
  const raiz = xml.match(/<estacoes([^>]*)>/);
  const estacoes: EstacaoChuva[] = [];
  for (const m of xml.matchAll(/<estacao\b([^>]*)>([\s\S]*?)<\/estacao>/g)) {
    const e = attrs(m[1]);
    const loc = attrs(m[2].match(/<localizacao\b([^>]*)\/?>/)?.[1] ?? "");
    const c = attrs(m[2].match(/<chuvas\b([^>]*)\/?>/)?.[1] ?? "");
    const lat = n(loc.latitude), lng = n(loc.longitude);
    if (lat === null || lng === null) continue;
    estacoes.push({
      id: e.id, nome: e.nome, bacia: loc.bacia || null, lat, lng, medidoEm: brtParaUtc(c.hora),
      mm: { m05: n(c.m05), m10: n(c.m10), m15: n(c.m15), h01: n(c.h01), h04: n(c.h04), h24: n(c.h24), h96: n(c.h96), mes: n(c.mes) },
    });
  }
  return { geradoEm: brtParaUtc(raiz ? attrs(raiz[1]).hora : undefined), estacoes };
}

export function estacoesProximas(es: EstacaoChuva[], lat: number, lng: number, k = 3) {
  return es.map((e) => ({ ...e, distanciaM: Math.round(distanciaM(lat, lng, e.lat, e.lng)) }))
    .sort((a, b) => a.distanciaM - b.distanciaM).slice(0, k);
}

export async function buscarChuvas() {
  const r = await fetch(URL_CHUVA, { next: { revalidate: 120 }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Alerta Rio respondeu HTTP ${r.status}`);
  const t = await r.text();
  if (!t.includes("<estacoes")) throw new Error("Alerta Rio: resposta fora do formato esperado");
  return parseChuvas(t);
}
