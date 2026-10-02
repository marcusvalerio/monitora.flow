import { CATALOGO_BRT, linhaBrt, sentidosDaLinha } from "../../../../src/lib/brt";
import { CATALOGO_ONIBUS, linhaOnibus, trajetosOnibus } from "../../../../src/lib/onibus";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /linhas/{linha}/trajeto?modo=BRT|BUS — trajetos oficiais (GTFS SMTR) da linha: nome, sentidos e um trajeto por shape.
 * modo padrão: BRT se a linha está no catálogo do BRT, senão BUS. Linha desconhecida → trajetos: [] (sem dado).
 */
export function GET(req: Request, ctx: { params: Promise<{ linha: string }> }) {
  return tratar(async () => {
    const linha = decodeURIComponent((await ctx.params).linha).trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("linha inválida");
    const modo = new URL(req.url).searchParams.get("modo")?.toUpperCase() ?? (linhaBrt(linha) ? "BRT" : "BUS");
    if (modo === "BRT") {
      const l = linhaBrt(linha);
      return ok({
        linha, modo, brt: !!l, catalogo: CATALOGO_BRT, nome: l?.nome ?? null, servico: l?.servico ?? null,
        nota: "Trajeto planejado (GTFS). coords: [lng, lat]. sentido = direction_id; destino = trip_headsign.",
        sentidos: l ? sentidosDaLinha(linha) : [], trajetos: l?.trajetos ?? [],
      }, null, 86400);
    }
    const o = linhaOnibus(linha);
    const trajetos = trajetosOnibus(linha);
    return ok({
      linha, modo: "BUS", brt: false, catalogo: CATALOGO_ONIBUS, nome: o?.nome ?? null, servico: null,
      nota: "Trajeto planejado (GTFS). coords: [lng, lat]. Cada ônibus é comparado ao shape da própria viagem (shape_id do GPS).",
      sentidos: [...new Map(trajetos.map((t) => [t.destino, { sentido: t.sentido, destino: t.destino, shapeIds: trajetos.filter((x) => x.destino === t.destino).map((x) => x.shapeId) }])).values()],
      trajetos,
    }, null, 86400);
  });
}
