import { pontoPorId } from "../../src/config/pontos";
import { habitualDoBanco } from "../../src/lib/consultas";
import { diaHoraLocal } from "../../src/lib/habitual";
import { PARAMETROS } from "../../src/lib/parametros";
import { ok, numero, tratar, ErroParametro } from "../../src/lib/api";

export const dynamic = "force-dynamic";

/** GET /habitual?ponto=&diaSemana=0..6&hora=0..23&dias=N — distribuição dos últimos N dias. */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const ponto = pontoPorId(q.get("ponto") ?? "");
    if (!ponto) throw new ErroParametro("ponto desconhecido ou ausente (veja /pontos)");
    const agoraLocal = diaHoraLocal(new Date());
    const diaSemana = numero(q.get("diaSemana"), "diaSemana", { min: 0, max: 6, inteiro: true, padrao: agoraLocal.dia });
    const hora = numero(q.get("hora"), "hora", { min: 0, max: 23, inteiro: true, padrao: agoraLocal.hora });
    const dias = numero(q.get("dias"), "dias", { min: 7, max: PARAMETROS.RETENCAO_AGREGADO_DIAS, inteiro: true, padrao: PARAMETROS.HABITUAL_DIAS_PADRAO });

    return ok({
      ponto, diaSemana, hora, fuso: PARAMETROS.FUSO, dias,
      metodo: "Para cada dia: média das velocidades em movimento naquela hora (ponderada por nº de leituras). " +
        "Depois: mediana, p25 e p75 entre os dias (percentil tipo 7). Dias sem dado ficam de fora. " +
        "N padrão = 28 dias (EXPERIMENTAL / ESCOLHA DO SISTEMA).",
      calculado: {
        brt: await habitualDoBanco(ponto.id, "brt", diaSemana, hora, dias),
        sppo: await habitualDoBanco(ponto.id, "sppo", diaSemana, hora, dias),
      },
    });
  });
}
