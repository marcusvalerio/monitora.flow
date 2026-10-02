import { estacaoPorId, FONTE_ESTACOES } from "../../../src/lib/estacoes";
import { linhasVistas, proximosVeiculos } from "../../../src/lib/transporte";
import { AVISO_CHEGADA } from "../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /estacoes/{id} — estação/terminal do BRT + linhas vistas nela + próximo veículo de cada linha.
 * Linhas: EXPERIMENTAL (BRT com GPS a até 300 m e ônibus a até 150 m, nos últimos 60 min). Chegada: estimativa EXPERIMENTAL.
 */
export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    const e = estacaoPorId(decodeURIComponent((await ctx.params).id));
    if (!e) throw new ErroParametro("estação desconhecida");
    // Ônibus comuns e alimentadores: raio menor (150 m), para pegar só os que passam na porta da estação.
    const [linhas, onibus] = await Promise.all([linhasVistas(e.lat, e.lng, "brt", 300, 60), linhasVistas(e.lat, e.lng, "sppo", 150, 60)]);
    const [pb, po] = await Promise.all([
      proximosVeiculos(e.lat, e.lng, "brt", linhas.map((l) => l.linha)),
      proximosVeiculos(e.lat, e.lng, "sppo", onibus.map((l) => l.linha)),
    ]);
    const proximos = pb.concat(po).sort((a, b) => a.etaMin - b.etaMin);
    return ok({
      fonteEstacao: FONTE_ESTACOES, estacao: e, consultadoEm: new Date(), avisoChegada: AVISO_CHEGADA,
      metodo: "Linhas: BRT com GPS a até 300 m e ônibus a até 150 m da estação nos últimos 60 min (não é a lista oficial). Chegada: linha reta + aproximação observada.",
      observado: { linhas: linhas.concat(onibus) }, calculado: { proximos },
    }, undefined, 5);
  });
}
