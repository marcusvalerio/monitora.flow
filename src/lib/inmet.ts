/**
 * Avisos meteorológicos do INMET (chuvas intensas, vendaval, onda de calor…) — fonte oficial federal, fora da Prefeitura.
 * FONTE: apiprevmet3.inmet.gov.br/avisos/ativos (conferido em 27/11/2026: { hoje, futuro }, geocodes, severidade,
 * inicio/fim "AAAA-MM-DD HH:MM" no horário de Brasília). A lista "ativos" ainda traz avisos já vencidos: filtramos pelo fim.
 * Se a API não responder ou mudar, a tela diz que o INMET não respondeu — nunca inventa aviso.
 */
import { IBGE_RIO } from "./cemaden";

export const URL_INMET_AVISOS = "https://apiprevmet3.inmet.gov.br/avisos/ativos";
export type Severidade = "potencial" | "perigo" | "grande perigo";
export interface AvisoInmet { id: string; titulo: string; severidade: Severidade; inicio: string | null; fim: string | null; riscos: string | null; instrucoes: string | null }

const txt = (...v: unknown[]) => { for (const x of v) if (typeof x === "string" && x.trim()) return x.trim(); return null; };
export function severidade(s: unknown, cor?: unknown): Severidade {
  const t = `${s ?? ""} ${cor ?? ""}`.toLowerCase();
  return /grande|vermelh|red|ff0000/.test(t) ? "grande perigo" : /potencial|amarel|yellow/.test(t) ? "potencial" : /perigo|laranj|orange/.test(t) ? "perigo" : "potencial";
}

/** Avisos ativos que incluem o município (geocódigo IBGE). Aceita { hoje: [], futuro: [] } ou uma lista simples. */
/** "2026-11-26 23:59" (Brasília) → ISO; null se não reconhecer. */
export function dataInmet(s: string | null): string | null {
  const m = s?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? new Date(`${m[1]}T${m[2]}:00-03:00`).toISOString() : null;
}

export function parseAvisosInmet(j: unknown, ibge = IBGE_RIO, agora = new Date()): AvisoInmet[] {
  const o = j as Record<string, unknown>;
  const lista = Array.isArray(j) ? j : [...((o?.hoje as unknown[]) ?? []), ...((o?.futuro as unknown[]) ?? [])];
  const out: AvisoInmet[] = [];
  for (const a of lista as Record<string, unknown>[]) {
    const geo = String(a.geocodes ?? a.geocodigos ?? a.municipios ?? "");
    if (!geo.includes(String(ibge))) continue;
    const fim = dataInmet(txt(a.fim, a.data_fim));
    if (fim && Date.parse(fim) < agora.getTime()) continue; // já terminou
    out.push({
      id: String(a.id ?? a.id_aviso ?? `${a.descricao}-${a.inicio}`),
      titulo: txt(a.descricao, a.evento, a.titulo) ?? "Aviso meteorológico",
      severidade: severidade(a.severidade, a.aviso_cor),
      inicio: dataInmet(txt(a.inicio, a.data_inicio)), fim,
      riscos: txt(Array.isArray(a.riscos) ? a.riscos.join(" ") : a.riscos), instrucoes: txt(Array.isArray(a.instrucoes) ? a.instrucoes.join(" ") : a.instrucoes),
    });
  }
  return out;
}

export async function buscarAvisosInmet() {
  const r = await fetch(URL_INMET_AVISOS, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) } as RequestInit);
  if (!r.ok) throw new Error(`INMET respondeu HTTP ${r.status}`);
  return parseAvisosInmet(await r.json());
}
