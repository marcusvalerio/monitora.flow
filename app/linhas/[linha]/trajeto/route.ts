import { CATALOGO_BRT, linhaBrt, sentidosDaLinha } from "../../../../src/lib/brt";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /linhas/{linha}/trajeto — linha de BRT do catálogo oficial (GTFS SMTR): nome, serviço, sentidos e trajetos (um por shape).
 * Linha que não é BRT → brt: false e trajetos: [] (sem dado, não inventamos).
 */
export function GET(_req: Request, ctx: { params: Promise<{ linha: string }> }) {
  return tratar(async () => {
    const linha = decodeURIComponent((await ctx.params).linha).trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("linha inválida");
    const l = linhaBrt(linha);
    return ok({
      linha, brt: !!l, catalogo: CATALOGO_BRT, nome: l?.nome ?? null, servico: l?.servico ?? null,
      nota: "Trajeto planejado (GTFS). coords: [lng, lat]. sentido = direction_id; destino = trip_headsign.",
      sentidos: l ? sentidosDaLinha(linha) : [],
      trajetos: l?.trajetos ?? [],
    }, null, 86400);
  });
}
