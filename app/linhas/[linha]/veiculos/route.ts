import { lerPosicoesLinha } from "../../../../src/lib/coletor";
import { linhaAoVivo } from "../../../../src/lib/aoVivo";
import type { Leitura } from "../../../../src/lib/fontes";
import { normalizarFrota } from "../../../../src/lib/veiculo";
import { linhaBrt, modoDaLinha, CATALOGO_BRT, type TransportMode } from "../../../../src/lib/brt";
import { casarVeiculo, diagnostico, ROUTE_MATCHING_TOLERANCE_METERS, ROUTE_OFF_THRESHOLD_METERS, HEADING_TOLERANCE_DEG, STALE_AFTER_S } from "../../../../src/lib/matching";
import { acumulado } from "../../../../src/lib/trajeto";
import { PARAMETROS } from "../../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /linhas/{linha}/veiculos?modo=BRT|BUS — última posição de cada veículo da linha (sem placa), normalizada.
 * modo: padrão = BRT se a linha está no catálogo oficial do BRT (GTFS route_type 702), senão BUS. Só entram veículos daquele modo
 *       (ex.: um alimentador "68" no GPS do BRT é BUS; um código desconhecido do GPS do BRT é OUTROS e não entra).
 * BRT: cada veículo é validado contra o trajeto oficial do sentido dele (src/lib/matching.ts): routeState, confidence,
 *      distância e diferença de rumo. Nada é escondido nem "colado" na via aqui — a posição devolvida é sempre a do GPS.
 * ?diag=1 inclui uma linha de diagnóstico por veículo.
 */
export function GET(req: Request, ctx: { params: Promise<{ linha: string }> }) {
  return tratar(async () => {
    const u = new URL(req.url);
    const linha = decodeURIComponent((await ctx.params).linha).trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("linha inválida");
    const brt = linhaBrt(linha);
    const modoQ = u.searchParams.get("modo")?.toUpperCase();
    if (modoQ && modoQ !== "BRT" && modoQ !== "BUS") throw new ErroParametro("modo deve ser BRT ou BUS");
    const modo: TransportMode = (modoQ as TransportMode) ?? (brt ? "BRT" : "BUS");
    const diag = u.searchParams.get("diag") === "1";

    const agora = new Date();
    const [vivo, banco] = await Promise.all([
      linhaAoVivo(linha),
      lerPosicoesLinha(linha, new Date(agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000)).catch((): Leitura[] => []),
    ]);
    const leituras = banco.concat(vivo.leituras).filter((l) => modoDaLinha(l.linha, l.fonte) === modo);
    const trajetos = modo === "BRT" && brt ? brt.trajetos.map((t) => ({ ...t, acc: acumulado(t.coords) })) : [];

    const frota = normalizarFrota(leituras, agora).sort((a, b) => a.idadeS - b.idadeS).map((v) => {
      if (modo !== "BRT") return { ...v, modo, routeState: null, confidence: null, distanciaTrajetoM: null, headingDeltaDeg: null, shapeId: null };
      const c = casarVeiculo(v, trajetos);
      if (diag || process.env.NODE_ENV !== "production") console.info(`[matching] ${diagnostico(v.veiculo, linha, c)}`);
      return { ...v, modo, ...c, ...(diag ? { diagnostico: diagnostico(v.veiculo, linha, c) } : {}) };
    });
    const conta = (s: string) => frota.filter((v) => v.routeState === s).length;
    return ok({
      linha, modo, janelaMin: PARAMETROS.JANELA_LINHA_MIN, consultadoEm: agora, fonteAoVivoEm: vivo.consultadoEm,
      nota: "Posições ao vivo da fonte da SMTR somadas às gravadas nos últimos 10 min. rumo: graus, 0 = norte, sentido horário. lat/lng = GPS como veio.",
      errosFonte: vivo.erros.length ? vivo.erros : undefined,
      ...(modo === "BRT" ? {
        catalogo: CATALOGO_BRT,
        matching: {
          toleranciaM: ROUTE_MATCHING_TOLERANCE_METERS, foraAcimaDeM: ROUTE_OFF_THRESHOLD_METERS, rumoToleranciaGraus: HEADING_TOLERANCE_DEG, staleAposS: STALE_AFTER_S,
          associacao: "GPS do BRT não traz trip_id/shape_id: linha → destino (campo trajeto) ↔ trip_headsign → shapes do sentido.",
        },
        resumo: { ON_ROUTE: conta("ON_ROUTE"), UNCERTAIN: conta("UNCERTAIN"), OFF_ROUTE: conta("OFF_ROUTE"), STALE: conta("STALE") },
      } : {}),
      observado: frota,
    }, undefined, 5);
  });
}
