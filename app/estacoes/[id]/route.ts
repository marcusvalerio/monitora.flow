import { estacaoPorId, FONTE_ESTACOES } from "../../../src/lib/estacoes";
import { linhasVistas, proximosVeiculos } from "../../../src/lib/transporte";
import { CATALOGO_BRT, linhaBrt, linhasBrtDaEstacao, sentidosDaLinha } from "../../../src/lib/brt";
import { AVISO_CHEGADA } from "../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /estacoes/{id} — estação/terminal do BRT + linhas BRT que param nela (OFICIAL: stop_times do GTFS, catálogo src/lib/brt.ts)
 * + quais dessas tiveram veículo com GPS por perto na última hora (OBSERVADO) + próximo veículo de cada uma (ESTIMATIVA).
 * Só BRT: ônibus convencionais não entram aqui.
 */
export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    const e = estacaoPorId(decodeURIComponent((await ctx.params).id));
    if (!e) throw new ErroParametro("estação desconhecida");
    const oficiais = linhasBrtDaEstacao(e.id);
    const vistas = (await linhasVistas(e.lat, e.lng, "brt", 300, 60)).filter((l) => oficiais.includes(String(l.linha).toUpperCase()));
    const proximos = (await proximosVeiculos(e.lat, e.lng, "brt", oficiais)).filter((p) => oficiais.includes(String(p.linha).toUpperCase()));
    const linhas = oficiais.map((codigo) => {
      const l = linhaBrt(codigo)!;
      const v = vistas.find((x) => String(x.linha).toUpperCase() === codigo);
      return { linha: codigo, fonte: "brt", nome: l.nome, servico: l.servico, sentidos: sentidosDaLinha(codigo).map((s) => s.destino), veiculosUltimaHora: v?.veiculos ?? 0, ultimaLeitura: v?.ultimaLeitura ?? null };
    });
    return ok({
      fonteEstacao: FONTE_ESTACOES, catalogo: CATALOGO_BRT, estacao: e, consultadoEm: new Date(), avisoChegada: AVISO_CHEGADA,
      metodo: "Linhas: as que param nesta estação segundo o GTFS oficial (stop_times). Movimento: veículos com GPS a até 300 m na última hora. Chegada: estimativa (linha reta + aproximação observada).",
      oficial: { linhas }, calculado: { proximos },
    }, undefined, 5);
  });
}
