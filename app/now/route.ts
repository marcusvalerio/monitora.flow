import { resumir, dentroDoRaio } from "../../src/lib/agregar";
import { caixa } from "../../src/lib/geo";
import { lerPosicoes } from "../../src/lib/coletor";
import { compararComHabitual, diaHoraLocal } from "../../src/lib/habitual";
import { habitualDoBanco, ultimaColeta } from "../../src/lib/consultas";
import { PARAMETROS } from "../../src/lib/parametros";
import { pontoPorId } from "../../src/config/pontos";
import { ok, numero, tratar, ErroParametro } from "../../src/lib/api";
import type { Fonte } from "../../src/lib/fontes";

export const dynamic = "force-dynamic";

/** GET /now?lat=&lng=&raio=  ou  GET /now?ponto=<id>  (opcional: janela=min) */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const ponto = q.get("ponto") ? pontoPorId(q.get("ponto")!) : undefined;
    if (q.get("ponto") && !ponto) throw new ErroParametro("ponto desconhecido (veja /pontos)");
    const lat = ponto ? ponto.lat : numero(q.get("lat"), "lat", { min: -90, max: 90 });
    const lng = ponto ? ponto.lng : numero(q.get("lng"), "lng", { min: -180, max: 180 });
    const raio = numero(q.get("raio"), "raio", { min: 10, max: PARAMETROS.RAIO_MAX_M, padrao: ponto?.raioM ?? PARAMETROS.RAIO_PADRAO_M });
    const janela = numero(q.get("janela"), "janela", { min: 1, max: PARAMETROS.RETENCAO_BRUTO_MIN, padrao: PARAMETROS.JANELA_NOW_MIN });

    const agora = new Date();
    const desde = new Date(agora.getTime() - janela * 60_000);
    const ls = dentroDoRaio(await lerPosicoes(desde, caixa(lat, lng, raio)), lat, lng, raio);
    const porFonte = (f: Fonte) => ls.filter((l) => l.fonte === f);
    const maisRecente = ls.reduce<Date | null>((m, l) => (!m || l.ts > m ? l.ts : m), null);

    const calculado = { brt: resumir(porFonte("brt")), sppo: resumir(porFonte("sppo")), total: resumir(ls) };

    let interpretado: unknown = null;
    if (ponto) {
      const { dia, hora } = diaHoraLocal(agora);
      const comp = async (f: Fonte) => {
        const h = await habitualDoBanco(ponto.id, f, dia, hora, PARAMETROS.HABITUAL_DIAS_PADRAO, agora);
        const atual = calculado[f].velocidadeMedia;
        return { velocidadeMediaAgora: atual, habitual: { mediana: h.mediana, p25: h.p25, p75: h.p75, nDias: h.nDias }, situacao: compararComHabitual(atual, h) };
      };
      interpretado = {
        metodo: "EXPERIMENTAL / ESCOLHA DO SISTEMA: velocidade média agora comparada com a faixa p25–p75 do mesmo dia da semana e hora nos últimos dias. Não é classificação de congestionamento.",
        diaSemana: dia, hora, brt: await comp("brt"), sppo: await comp("sppo"),
      };
    }

    return ok({
      consulta: { lat, lng, raioM: raio, janelaMin: janela, ponto: ponto?.id ?? null },
      atualizadoEm: (await ultimaColeta())?.em ?? null,
      leituraMaisRecente: maisRecente,
      // compatibilidade com o formato pedido pelo MOVA (total das duas fontes)
      nVeiculos: calculado.total.nVeiculos,
      velocidadeMedia: calculado.total.velocidadeMedia,
      observado: { nLeituras: ls.length, leituraMaisRecente: maisRecente },
      calculado,
      interpretado,
    });
  });
}
