import { lerPosicoesLinha } from "../../../../src/lib/coletor";
import { linhaAoVivo } from "../../../../src/lib/aoVivo";
import type { Leitura } from "../../../../src/lib/fontes";
import { normalizarFrota } from "../../../../src/lib/veiculo";
import trajetosJson from "../../../../src/data/trajetos-brt.json";
import { distanciaAoTrajeto, FORA_TRAJETO_M, type Coords } from "../../../../src/lib/trajeto";
import { estadoGeo } from "../../../../src/lib/estadoGeo";
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
    const trajetos = ((trajetosJson as unknown as { linhas: Record<string, { coords: Coords }[]> }).linhas[linha] ?? []);
    const todos = normalizarFrota(banco.concat(vivo.leituras), agora).sort((a, b) => a.idadeS - b.idadeS).map((v) => {
      const d = v.fonte === "brt" && trajetos.length ? distanciaAoTrajeto(v.lat, v.lng, trajetos) : null;
      const dist = d === null ? null : Math.round(d);
      return { ...v, distanciaTrajetoM: dist, estadoGeo: estadoGeo(v.idadeS, dist) };
    });
    // Parado longe do trajeto oficial = garagem/pátio (fora de operação): não entra na frota exibida.
    const foraDeOperacao = todos.filter((v) => v.parado && v.distanciaTrajetoM !== null && v.distanciaTrajetoM > FORA_TRAJETO_M);
    const frota = todos.filter((v) => !foraDeOperacao.includes(v));
    return ok({
      linha, janelaMin: PARAMETROS.JANELA_LINHA_MIN, consultadoEm: agora, fonteAoVivoEm: vivo.consultadoEm,
      nota: "Posições ao vivo da fonte da SMTR somadas às gravadas nos últimos 10 min. rumo: graus, 0 = norte, sentido horário.",
      errosFonte: vivo.erros.length ? vivo.erros : undefined,
      estados: "ON_ROUTE ≤ 60 m do trajeto oficial; UNCERTAIN ≤ 300 m; OFF_ROUTE > 300 m; STALE: posição com mais de 180 s; null: linha sem trajeto conhecido.",
      foraDeOperacao: { n: foraDeOperacao.length, criterio: `parado e a mais de ${FORA_TRAJETO_M} m do trajeto oficial (GTFS)` },
      observado: frota.map((v) => ({ ...v, velocidadeKmh: v.velocidadeKmh, em: v.em })),
    }, undefined, 5);
  });
}
