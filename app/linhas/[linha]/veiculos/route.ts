import { lerPosicoesLinha } from "../../../../src/lib/coletor";
import { ultimasPosicoes } from "../../../../src/lib/chegada";
import { PARAMETROS } from "../../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/** GET /linhas/{linha}/veiculos — última posição de cada veículo da linha nos últimos 10 min (sem placa). */
export function GET(_req: Request, ctx: { params: Promise<{ linha: string }> }) {
  return tratar(async () => {
    const linha = decodeURIComponent((await ctx.params).linha).trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("linha inválida");
    const agora = new Date();
    const ls = ultimasPosicoes(await lerPosicoesLinha(linha, new Date(agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000)));
    return ok({
      linha, janelaMin: PARAMETROS.JANELA_LINHA_MIN, consultadoEm: agora,
      observado: ls.sort((a, b) => b.ts.getTime() - a.ts.getTime()).map((l) => ({
        fonte: l.fonte, veiculo: l.veiculo, sentido: l.sentido, lat: l.lat, lng: l.lng,
        velocidadeKmh: l.velocidade, em: l.ts, idadeS: Math.round((agora.getTime() - l.ts.getTime()) / 1000),
      })),
    });
  });
}
