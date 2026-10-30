import { after } from "next/server";
import { configurado, pegarVez, rodada, soltarVez } from "../../../src/lib/avisos";
import { erro, ok, tratar } from "../../../src/lib/api";
import { acordarVigia } from "../route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PASSO_MS = 20_000, DURACAO_MS = 270_000;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /avisos/vigiar — confere os avisos ativos a cada 20 s por ~4,5 min. Se ainda houver avisos ativos
 * no fim, chama a si mesmo de novo (encadeado). A coleta do GitHub Actions também chama esta rota a cada
 * 10 min, como rede de segurança caso a corrente se quebre. Responde na hora e trabalha em `after()`,
 * para quem chamou não precisar esperar (nem derrubar o trabalho ao desconectar).
 */
export function POST(req: Request) {
  return tratar(async () => {
    if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return erro(401, "não autorizado");
    if (!configurado()) return erro(503, "avisos não configurados");
    if (!(await pegarVez(DURACAO_MS / 1000 + 20))) return ok({ vigia: "já há um vigia rodando" }, null, 0);
    const origem = new URL(req.url).origin;
    after(async () => {
      const fim = Date.now() + DURACAO_MS;
      let ativos = 0;
      try {
        do {
          ativos = await rodada().catch((e) => { console.error(e); return 1; });
          if (!ativos) break;
          await dormir(PASSO_MS);
        } while (Date.now() < fim);
      } finally { await soltarVez(); }
      if (ativos) await acordarVigia(origem);
    });
    return ok({ vigia: "iniciado" }, null, 0);
  });
}
