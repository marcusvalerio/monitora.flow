import trajetosJson from "../../../src/data/trajetos-brt.json";
import { posicoesAoVivo } from "../../../src/lib/aoVivo";
import { buscarChuvas } from "../../../src/lib/chuva";
import { retrato, RECENTE_S } from "../../../src/lib/monitor";
import type { Coords } from "../../../src/lib/trajeto";
import { ok, tratar } from "../../../src/lib/api";

export const dynamic = "force-dynamic";

const T = (trajetosJson as unknown as { linhas: Record<string, { coords: Coords }[]> }).linhas;

/**
 * GET /monitor/dados — retrato da operação agora: frota observada (BRT e ônibus), estados geográficos do BRT,
 * qualidade dos dados, chuva medida (Alerta Rio) e ocorrências (sem fonte aberta no momento).
 */
export function GET() {
  return tratar(async () => {
    const agora = new Date();
    const [vivo, chuva] = await Promise.all([posicoesAoVivo(), buscarChuvas().catch(() => null)]);
    const r = retrato(vivo.leituras, agora, T);
    const est = chuva?.estacoes ?? [];
    const comChuva = est.filter((e) => (e.mm.h01 ?? 0) > 0).sort((a, b) => (b.mm.h01 ?? 0) - (a.mm.h01 ?? 0));
    return ok({
      consultadoEm: agora, fonteAoVivoEm: new Date(vivo.em), errosFonte: vivo.erros.length ? vivo.erros : undefined,
      metodo: {
        observados: "Veículos distintos com posição de GPS na leitura ao vivo + últimos 10 min em memória (sem placa). Não é a frota programada.",
        recente: `posição com até ${RECENTE_S} s`,
        estados: "Só BRT (trajeto oficial GTFS): ON_ROUTE ≤ 60 m; UNCERTAIN ≤ 300 m; OFF_ROUTE > 300 m; STALE > 180 s.",
      },
      observado: { total: r.total, recentes: r.recentes, brt: r.brt, onibus: r.onibus },
      chuva: chuva ? {
        fonte: "Alerta Rio (pluviômetros)", geradoEm: chuva.geradoEm, estacoes: est.length,
        comChuvaNaUltimaHora: comChuva.length,
        maior: comChuva[0] ? { nome: comChuva[0].nome, mmH01: comChuva[0].mm.h01 } : null,
      } : null,
      ocorrencias: { disponivel: false, motivo: "Sem fonte pública ao vivo do COR respondendo (api.dados.rio: HTTP 503)." },
      pontos: r.pontos,
    }, null, 15);
  });
}
