import { lerPosicoesLinha } from "../../../../src/lib/coletor";
import { linhaAoVivo } from "../../../../src/lib/aoVivo";
import type { Leitura } from "../../../../src/lib/fontes";
import { normalizarFrota } from "../../../../src/lib/veiculo";
import { PARAMETROS } from "../../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /linhas/{linha}/veiculos — última posição de cada veículo da linha (sem placa), já normalizada:
 * rumo (GPS da fonte → deslocamento ≥ 30 m → último rumo em movimento → null), parado (< 3 km/h), destino.
 * Junta a leitura AO VIVO da fonte com as posições gravadas nos últimos 10 min.
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
    const frota = normalizarFrota(banco.concat(vivo.leituras), agora).sort((a, b) => a.idadeS - b.idadeS);
    return ok({
      linha, janelaMin: PARAMETROS.JANELA_LINHA_MIN, consultadoEm: agora, fonteAoVivoEm: vivo.consultadoEm,
      nota: "Posições ao vivo da fonte da SMTR somadas às gravadas nos últimos 10 min. rumo: graus, 0 = norte, sentido horário.",
      errosFonte: vivo.erros.length ? vivo.erros : undefined,
      observado: frota.map((v) => ({ ...v, velocidadeKmh: v.velocidadeKmh, em: v.em })),
    }, undefined, 5);
  });
}
