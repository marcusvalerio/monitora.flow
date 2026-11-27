import { z } from "zod";
import { configurado } from "../../src/lib/avisos";
import { salvarInscricao } from "../../src/lib/inscricoes";
import { ok, erro, tratar, ErroParametro } from "../../src/lib/api";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  assinatura: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), lugar: z.string().trim().min(1).max(80),
  chuva: z.boolean(), cidade: z.boolean(),
});

/** POST /inscricoes — liga/desliga as notificações de Ajustes. As duas desligadas = inscrição apagada. Ver src/lib/inscricoes.ts. */
export function POST(req: Request) {
  return tratar(async () => {
    if (!configurado()) return erro(503, "Notificações ainda não configuradas no servidor.");
    const p = Corpo.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new ErroParametro("corpo inválido");
    const id = await salvarInscricao(p.data);
    return ok({ id, chuva: p.data.chuva, cidade: p.data.cidade }, null, 0);
  });
}
