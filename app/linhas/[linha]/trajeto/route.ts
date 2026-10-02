import trajetos from "../../../../src/data/trajetos-brt.json";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

const T = trajetos as unknown as { fonte: string; versaoGtfs: string | null; validoAte: string | null; linhas: Record<string, { sentido: number; destino: string; viagens: number; coords: [number, number][] }[]> };

/**
 * GET /linhas/{linha}/trajeto — trajeto oficial da linha de BRT (GTFS da SMTR), um por variante/sentido.
 * Só BRT por enquanto; linha sem trajeto → trajetos: [] (sem dado, não inventamos).
 */
export function GET(_req: Request, ctx: { params: Promise<{ linha: string }> }) {
  return tratar(async () => {
    const linha = decodeURIComponent((await ctx.params).linha).trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("linha inválida");
    return ok({
      linha, fonteTrajeto: T.fonte, versaoGtfs: T.versaoGtfs, validoAte: T.validoAte,
      nota: "Trajeto planejado (GTFS). coords: [lng, lat]. sentido = direction_id do GTFS.",
      trajetos: T.linhas[linha] ?? [],
    }, null, 86400);
  });
}
