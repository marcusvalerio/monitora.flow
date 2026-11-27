/**
 * Pluviômetros do Cemaden (Centro Nacional de Monitoramento e Alertas de Desastres Naturais) — segunda fonte de chuva
 * medida, fora da Prefeitura. Usado quando o Alerta Rio não responde. FONTE: resources.cemaden.gov.br (público).
 * O JSON não traz coordenadas: lista por nome do pluviômetro. Horário em UTC (conferido em 27/11/2026: "27/11/26 02:00" às 01:51 UTC).
 */
export const URL_CEMADEN = "https://resources.cemaden.gov.br/graficos/interativo/getJson2.php?uf=RJ";
export const IBGE_RIO = 3304557;

export interface PluviometroCemaden { id: string; nome: string; mmUltimo: number | null; mm1h: number | null; mm24h: number | null; medidoEm: string | null }

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && v !== "-" && Number.isFinite(Number(v)) ? Number(v) : null);
/** "27/11/26 02:00" (UTC) → ISO. */
export function dataCemaden(s: unknown): string | null {
  const m = typeof s === "string" ? s.match(/^(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/) : null;
  return m ? new Date(Date.UTC(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]))).toISOString() : null;
}

export function parseCemaden(j: unknown, ibge = IBGE_RIO): PluviometroCemaden[] {
  if (!Array.isArray(j)) return [];
  return (j as Record<string, unknown>[]).filter((x) => Number(x.codibge) === ibge).map((x) => ({
    id: `cemaden-${x.idestacao}`, nome: String(x.nomeestacao ?? "Pluviômetro"),
    mmUltimo: n(x.ultimovalor), mm1h: n(x.acc1hr), mm24h: n(x.acc24hr), medidoEm: dataCemaden(x.datahoraUltimovalor),
  }));
}

export async function buscarCemaden() {
  const r = await fetch(URL_CEMADEN, { next: { revalidate: 300 }, signal: AbortSignal.timeout(12_000) } as RequestInit);
  if (!r.ok) throw new Error(`Cemaden respondeu HTTP ${r.status}`);
  return parseCemaden(JSON.parse(await r.text()));
}
