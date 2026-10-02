import { lerPosicoesLinha } from "../../../../src/lib/coletor";
import { linhaAoVivo } from "../../../../src/lib/aoVivo";
import type { Leitura } from "../../../../src/lib/fontes";
import { ultimasPosicoes } from "../../../../src/lib/chegada";
import { PARAMETROS } from "../../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /linhas/{linha}/veiculos — última posição de cada veículo da linha (sem placa).
 * Junta a leitura AO VIVO da fonte (segundos de atraso) com as posições gravadas nos últimos 10 min.
 */
export function GET(_req: Request, ctx: { params: Promise<{ linha: string }> }) {
  return tratar(async () => {
    const linha = decodeURIComponent((await ctx.params).linha).trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("linha inválida");
    const agora = new Date();
    const [vivo, banco] = await Promise.all([
      linhaAoVivo(linha),
      lerPosicoesLinha(linha, new Date(agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000)).catch((): Leitura[] => []),
    ]);
    const ls = ultimasPosicoes(banco.concat(vivo.leituras));
    return ok({
      linha, janelaMin: PARAMETROS.JANELA_LINHA_MIN, consultadoEm: agora, fonteAoVivoEm: vivo.consultadoEm,
      nota: "Posições ao vivo da fonte da SMTR (atualizadas a cada ~20 s) somadas às gravadas nos últimos 10 min.",
      errosFonte: vivo.erros.length ? vivo.erros : undefined,
      observado: ls.sort((a, b) => b.ts.getTime() - a.ts.getTime()).map((l) => ({
        fonte: l.fonte, veiculo: l.veiculo, sentido: l.sentido, lat: l.lat, lng: l.lng,
        velocidadeKmh: l.velocidade, em: l.ts, idadeS: Math.round((agora.getTime() - l.ts.getTime()) / 1000),
      })),
    }, undefined, 5);
  });
}
