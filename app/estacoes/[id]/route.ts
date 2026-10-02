import { estacaoPorId, FONTE_ESTACOES } from "../../../src/lib/estacoes";
import { linhasVistas, proximosVeiculos } from "../../../src/lib/transporte";
import { AVISO_CHEGADA } from "../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /estacoes/{id} — estação/terminal do BRT + linhas vistas nela + próximo veículo de cada linha.
 * Linhas: EXPERIMENTAL (BRT com GPS a até 300 m nos últimos 60 min). Chegada: estimativa EXPERIMENTAL.
 */
export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    const e = estacaoPorId(decodeURIComponent((await ctx.params).id));
    if (!e) throw new ErroParametro("estação desconhecida");
    const linhas = await linhasVistas(e.lat, e.lng, "brt", 300, 60);
    const proximos = await proximosVeiculos(e.lat, e.lng, "brt", linhas.map((l) => l.linha));
    return ok({
      fonteEstacao: FONTE_ESTACOES, estacao: e, consultadoEm: new Date(), avisoChegada: AVISO_CHEGADA,
      metodo: "Linhas: BRT com GPS a até 300 m da estação nos últimos 60 min (não é a lista oficial). Chegada: linha reta + aproximação observada.",
      observado: { linhas }, calculado: { proximos },
    }, undefined, 5);
  });
}
