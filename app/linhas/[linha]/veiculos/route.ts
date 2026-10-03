import { lerPosicoesLinha } from "../../../../src/lib/coletor";
import { linhaAoVivo } from "../../../../src/lib/aoVivo";
import type { Leitura } from "../../../../src/lib/fontes";
import { normalizarFrota } from "../../../../src/lib/veiculo";
import { linhaBrt, modoDaLinha, CATALOGO_BRT, type TransportMode } from "../../../../src/lib/brt";
import { casarVeiculo, diagnostico, ROUTE_MATCHING_TOLERANCE_METERS, ROUTE_OFF_THRESHOLD_METERS, HEADING_TOLERANCE_DEG, STALE_AFTER_S } from "../../../../src/lib/matching";
import { acumulado, projetar } from "../../../../src/lib/trajeto";
import { programacao, FONTE_FREQUENCIAS } from "../../../../src/lib/frequencia";
import { trajetosDaLinha } from "../../../../src/lib/catalogo";
import { CATALOGO_ONIBUS } from "../../../../src/lib/onibus";
import { PARAMETROS } from "../../../../src/lib/parametros";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /linhas/{linha}/veiculos?modo=BRT|BUS — última posição de cada veículo da linha (sem placa), normalizada.
 * modo: padrão = BRT se a linha está no catálogo oficial do BRT (GTFS route_type 702), senão BUS. Só entram veículos daquele modo
 *       (ex.: um alimentador "68" no GPS do BRT é BUS; um código desconhecido do GPS do BRT é OUTROS e não entra).
 * Cada veículo é validado contra o trajeto oficial (src/lib/matching.ts): routeState, confidence, distância, rumo do trecho e
 * diferença de rumo. Ônibus: pelo shape_id da viagem informado pelo GPS; BRT: pelo sentido (o feed do BRT não traz shape_id). Nada é escondido nem "colado" na via aqui — a posição devolvida é sempre a do GPS.
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
    const trajetos = trajetosDaLinha(linha, modo).map((t) => ({ ...t, acc: acumulado(t.coords) }));

    const frota = normalizarFrota(leituras, agora).sort((a, b) => a.idadeS - b.idadeS).map((v) => {
      const c = casarVeiculo(v, trajetos);
      if (diag || process.env.NODE_ENV !== "production") console.info(`[matching] ${diagnostico(v.veiculo, linha, c)}`);
      return { ...v, modo, ...c, ...(diag ? { diagnostico: diagnostico(v.veiculo, linha, c) } : {}) };
    });
    const conta = (s: string) => frota.filter((v) => v.routeState === s).length;

    // Operação: PROGRAMADO (GTFS frequencies, fonte externa) × OBSERVADO (GPS agora, calculado aqui).
    // Rodando = ON_ROUTE ou UNCERTAIN casado a um shape daquele sentido (garagem/fora/sem sinal não contam).
    // Espaçamento = distância média ao longo do trajeto entre veículos consecutivos do mesmo shape (km).
    const prog = modo === "OUTROS" ? null : programacao(modo, linha, agora);
    const sentidosIds = [...new Set(trajetos.map((t) => t.sentido))].sort();
    const operacao = trajetos.length ? {
      fonteProgramacao: FONTE_FREQUENCIAS,
      tipoDia: prog?.tipoDia ?? null,
      sentidos: sentidosIds.map((sid) => {
        const p = prog?.sentidos.find((x) => x.sentido === sid) ?? null;
        const tsDoSentido = trajetos.filter((t) => t.sentido === sid);
        const rodando = frota.filter((v) => (v.routeState === "ON_ROUTE" || v.routeState === "UNCERTAIN") && tsDoSentido.some((t) => t.shapeId === v.shapeId));
        const gaps: number[] = [];
        for (const t of tsDoSentido) {
          const ss = rodando.filter((v) => v.shapeId === t.shapeId).map((v) => projetar(v.lat, v.lng, t.coords, t.acc)?.s).filter((x): x is number => x != null).sort((a, b) => a - b);
          for (let i = 1; i < ss.length; i++) gaps.push(ss[i] - ss[i - 1]);
        }
        return {
          sentido: sid, destino: tsDoSentido[0]?.destino ?? p?.destino ?? null,
          programado: p ? { intervaloS: p.intervaloS, partidasPorHora: p.partidasPorHora, faixa: p.faixa, perfil: p.perfil } : null,
          observado: { rodando: rodando.length, espacamentoMedioKm: gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) / 100) / 10 : null },
        };
      }),
    } : undefined;
    return ok({
      linha, modo, janelaMin: PARAMETROS.JANELA_LINHA_MIN, consultadoEm: agora, fonteAoVivoEm: vivo.consultadoEm,
      nota: "Posições ao vivo da fonte da SMTR somadas às gravadas nos últimos 10 min. rumo: graus, 0 = norte, sentido horário. lat/lng = GPS como veio.",
      errosFonte: vivo.erros.length ? vivo.erros : undefined,
      ...(trajetos.length ? {
        catalogo: modo === "BRT" ? CATALOGO_BRT : CATALOGO_ONIBUS,
        matching: {
          toleranciaM: ROUTE_MATCHING_TOLERANCE_METERS, foraAcimaDeM: ROUTE_OFF_THRESHOLD_METERS, rumoToleranciaGraus: HEADING_TOLERANCE_DEG, staleAposS: STALE_AFTER_S,
          associacao: modo === "BRT" ? "GPS do BRT não traz trip_id/shape_id: linha → destino (campo trajeto) ↔ trip_headsign → shapes do sentido."
            : "GPS dos ônibus traz shape_id da viagem: comparação com o shape exato da viagem.",
        },
        resumo: { ON_ROUTE: conta("ON_ROUTE"), UNCERTAIN: conta("UNCERTAIN"), OFF_ROUTE: conta("OFF_ROUTE"), STALE: conta("STALE") },
      } : {}),
      operacao,
      observado: frota,
    }, undefined, 5);
  });
}
