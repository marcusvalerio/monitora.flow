import { posicoesAoVivo } from "../../src/lib/aoVivo";
import { destinoDoTrajeto } from "../../src/lib/veiculo";
import { ok, tratar, ErroParametro } from "../../src/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /linhas?q=22&fonte=brt|sppo — linhas com veículo transmitindo GPS agora (leitura ao vivo da SMTR).
 * Não é o catálogo oficial de linhas: linha sem veículo com GPS no momento não aparece.
 * Ordem: número igual ao pesquisado, depois os que começam com ele, depois os que o contêm.
 */
export function GET(req: Request) {
  return tratar(async () => {
    const u = new URL(req.url);
    const q = (u.searchParams.get("q") ?? "").trim().toUpperCase();
    const fonte = u.searchParams.get("fonte");
    if (!q || q.length > 20) throw new ErroParametro("q obrigatório (até 20 caracteres)");
    if (fonte && fonte !== "brt" && fonte !== "sppo") throw new ErroParametro("fonte deve ser brt ou sppo");
    const limite = Math.min(Number(u.searchParams.get("limite")) || 10, 30);
    const vivo = await posicoesAoVivo();
    const corte = Date.now() - 5 * 60_000;
    const g = new Map<string, { linha: string; fonte: string; veiculos: Set<string>; destinos: Set<string> }>();
    for (const l of vivo.leituras) {
      const linha = (l.linha ?? "").toUpperCase();
      if (!linha || !linha.includes(q) || (fonte && l.fonte !== fonte) || l.ts.getTime() < corte) continue;
      const k = `${l.fonte}|${linha}`;
      const x = g.get(k) ?? { linha, fonte: l.fonte, veiculos: new Set(), destinos: new Set() };
      x.veiculos.add(l.veiculo);
      const d = destinoDoTrajeto(l.trajeto, l.sentido);
      if (d) x.destinos.add(d);
      g.set(k, x);
    }
    const rank = (s: string) => (s === q ? 0 : s.startsWith(q) ? 1 : 2);
    const linhas = [...g.values()]
      .sort((a, b) => rank(a.linha) - rank(b.linha) || a.linha.length - b.linha.length || a.linha.localeCompare(b.linha))
      .slice(0, limite)
      .map((x) => ({ linha: x.linha, fonte: x.fonte, veiculosAgora: x.veiculos.size, destinos: [...x.destinos].slice(0, 2) }));
    return ok({
      q, consultadoEm: new Date(vivo.em),
      nota: "Linhas com veículo transmitindo GPS nos últimos 5 min. Não é a lista oficial de linhas.",
      errosFonte: vivo.erros.length ? vivo.erros : undefined,
      linhas,
    }, undefined, 15);
  });
}
