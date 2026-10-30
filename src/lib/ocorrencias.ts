/**
 * Ocorrências do COR (acidentes, bolsões d'água, obras, eventos) — FONTE: api.dados.rio (Prefeitura do Rio).
 * A API estava fora do ar (HTTP 503) em 02/10 e 30/10/2026; este leitor fica pronto e passa a funcionar
 * sozinho quando ela voltar. Nomes de campos variam entre versões: o parser aceita os mais comuns.
 */
import { distanciaM } from "./geo";

export const URL_COR = "https://api.dados.rio/v2/adm_cor_comando/ocorrencias_abertas/";

export interface Ocorrencia { id: string; titulo: string; tipo: string | null; gravidade: string | null; bairro: string | null; lat: number; lng: number; inicio: string | null; distanciaM?: number }

const num = (v: unknown) => { const x = typeof v === "string" ? Number(v.replace(",", ".")) : v; return typeof x === "number" && Number.isFinite(x) ? x : null; };
const txt = (...v: unknown[]) => { for (const x of v) if (typeof x === "string" && x.trim()) return x.trim(); return null; };

export function parseOcorrencias(j: unknown): Ocorrencia[] {
  const lista = Array.isArray(j) ? j : (j as { eventos?: unknown[]; results?: unknown[]; data?: unknown[] })?.eventos ?? (j as { results?: unknown[] })?.results ?? (j as { data?: unknown[] })?.data ?? [];
  const out: Ocorrencia[] = [];
  for (const o of lista as Record<string, unknown>[]) {
    const lat = num(o.latitude ?? o.lat), lng = num(o.longitude ?? o.lng ?? o.lon);
    if (lat == null || lng == null) continue; // sem local não dá para filtrar por distância
    out.push({
      id: String(o.id_evento ?? o.id ?? `${lat},${lng},${o.data_inicio ?? ""}`),
      titulo: txt(o.titulo, o.pop_titulo, o.descricao, o.tipo) ?? "Ocorrência",
      tipo: txt(o.tipo, o.pop_titulo), gravidade: txt(o.gravidade, o.prioridade), bairro: txt(o.bairro),
      lat, lng, inicio: txt(o.data_inicio, o.inicio, o.data),
    });
  }
  return out;
}

export function ocorrenciasPerto(os: Ocorrencia[], lat: number, lng: number, raioM: number) {
  return os.map((o) => ({ ...o, distanciaM: Math.round(distanciaM(lat, lng, o.lat, o.lng)) }))
    .filter((o) => o.distanciaM <= raioM).sort((a, b) => a.distanciaM - b.distanciaM);
}

export async function buscarOcorrencias() {
  const r = await fetch(URL_COR, { next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) } as RequestInit);
  if (!r.ok) throw new Error(`COR respondeu HTTP ${r.status}`);
  return parseOcorrencias(await r.json());
}
