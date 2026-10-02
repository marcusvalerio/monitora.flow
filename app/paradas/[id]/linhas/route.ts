import { paradaPorId } from "../../../../src/lib/paradas";
import { linhasVistas } from "../../../../src/lib/transporte";
import { PARAMETROS } from "../../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /paradas/{id}/linhas — linhas cujos veículos tiveram GPS a até 100 m da parada na última hora.
 * EXPERIMENTAL / ESCOLHA DO SISTEMA: não é a lista oficial de linhas da parada (isso viria do GTFS);
 * pode incluir linhas que só passam na rua sem parar e deixar de fora linhas sem veículo na última hora.
 */
export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    const parada = paradaPorId(decodeURIComponent((await ctx.params).id));
    if (!parada) throw new ErroParametro("parada desconhecida");
    const raio = PARAMETROS.PARADA_LINHAS_RAIO_M;
    const [sppo, brt] = await Promise.all([linhasVistas(parada.lat, parada.lng, "sppo", raio), linhasVistas(parada.lat, parada.lng, "brt", raio)]);
    return ok({
      parada,
      metodo: `EXPERIMENTAL: linhas com GPS a até ${raio} m da parada nos últimos ${PARAMETROS.PARADA_LINHAS_JANELA_MIN} min. Não é a lista oficial de linhas da parada.`,
      observado: [...sppo, ...brt],
    }, null, 60);
  });
}
