import { duracaoProgramadaS } from "../../../../src/lib/frequencia";
import { linhaBrt } from "../../../../src/lib/brt";
import { trajetosDaLinha } from "../../../../src/lib/catalogo";
import { acumulado, projetar } from "../../../../src/lib/trajeto";
import { ok, tratar, ErroParametro } from "../../../../src/lib/api";
import estacoesJson from "../../../../src/data/estacoes-brt.json";
import paradasJson from "../../../../src/data/paradas.json";

export const dynamic = "force-dynamic";

// EXPERIMENTAL / ESCOLHA DO SISTEMA: parada "no trajeto" se estiver a até esta distância do shape
const ESTACAO_M = 150, PARADA_M = 35;

/**
 * GET /linhas/{linha}/paradas?modo=BRT|BUS — estações (BRT) ou paradas (ônibus) ao longo de cada trajeto oficial, na ordem da viagem.
 * s = metros desde o início do shape; total = comprimento do shape; duracaoProgramadaS = viagem completa (GTFS stop_times).
 * Calculado por proximidade ao shape (não é a lista oficial de paradas da viagem).
 */
export function GET(req: Request, ctx: { params: Promise<{ linha: string }> }) {
  return tratar(async () => {
    const linha = decodeURIComponent((await ctx.params).linha).trim().toUpperCase();
    if (!/^[A-Z0-9 -]{1,20}$/.test(linha)) throw new ErroParametro("linha inválida");
    const modo = (new URL(req.url).searchParams.get("modo")?.toUpperCase() ?? (linhaBrt(linha) ? "BRT" : "BUS")) as "BRT" | "BUS";
    const pontos = modo === "BRT"
      ? (estacoesJson as { estacoes: { id: string; nome: string; lat: number; lng: number }[] }).estacoes.map((e) => ({ ...e, lim: ESTACAO_M }))
      : (paradasJson as { paradas: { id: string; nome: string; lat: number; lng: number }[] }).paradas.map((p) => ({ ...p, lim: PARADA_M }));
    const trajetos = trajetosDaLinha(linha, modo).map((t) => {
      const acc = acumulado(t.coords);
      const lista: { id: string; nome: string; s: number }[] = [];
      for (const p of pontos) {
        const e = projetar(p.lat, p.lng, t.coords, acc);
        if (e && e.distM <= p.lim) lista.push({ id: p.id, nome: p.nome, s: Math.round(e.s) });
      }
      lista.sort((a, b) => a.s - b.s);
      const paradas = lista.filter((p, i) => i === 0 || p.nome !== lista[i - 1].nome);
      return { shapeId: t.shapeId, destino: t.destino, total: Math.round(acc[acc.length - 1]), duracaoProgramadaS: duracaoProgramadaS(t.shapeId), paradas };
    });
    return ok({ linha, modo, nota: "Paradas por proximidade ao trajeto oficial (GTFS). s em metros desde o início do trajeto.", trajetos }, null, 86400);
  });
}
