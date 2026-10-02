import { paradaPorId } from "../../../../src/lib/paradas";
import { lerPosicoes } from "../../../../src/lib/coletor";
import { dentroDoRaio } from "../../../../src/lib/agregar";
import { caixa } from "../../../../src/lib/geo";
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
    const desde = new Date(Date.now() - PARAMETROS.PARADA_LINHAS_JANELA_MIN * 60_000);
    const ls = dentroDoRaio(await lerPosicoes(desde, caixa(parada.lat, parada.lng, raio)), parada.lat, parada.lng, raio);
    const porLinha = new Map<string, { linha: string; fonte: string; veiculos: Set<string>; ultima: Date }>();
    for (const l of ls) {
      if (!l.linha) continue;
      const k = `${l.fonte}|${l.linha}`;
      const a = porLinha.get(k) ?? { linha: l.linha, fonte: l.fonte, veiculos: new Set<string>(), ultima: l.ts };
      a.veiculos.add(l.veiculo);
      if (l.ts > a.ultima) a.ultima = l.ts;
      porLinha.set(k, a);
    }
    return ok({
      parada,
      metodo: `EXPERIMENTAL: linhas com GPS a até ${raio} m da parada nos últimos ${PARAMETROS.PARADA_LINHAS_JANELA_MIN} min. Não é a lista oficial de linhas da parada.`,
      observado: [...porLinha.values()]
        .sort((a, b) => b.veiculos.size - a.veiculos.size || a.linha.localeCompare(b.linha, "pt-BR", { numeric: true }))
        .map((a) => ({ linha: a.linha, fonte: a.fonte, veiculos: a.veiculos.size, ultimaLeitura: a.ultima })),
    }, null, 60);
  });
}
