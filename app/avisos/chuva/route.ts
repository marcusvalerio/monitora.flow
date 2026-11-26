import { after } from "next/server";
import { z } from "zod";
import { configurado } from "../../../src/lib/avisos";
import { apagarAvisoChuva, criarAvisoChuva } from "../../../src/lib/avisosChuva";
import { ok, erro, tratar, ErroParametro } from "../../../src/lib/api";
import { origemPublica, vigiar } from "../../../src/lib/vigia";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Corpo = z.object({
  assinatura: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  lugar: z.string().trim().min(1).max(80),
});

/**
 * POST /avisos/chuva — avisa uma vez se chover forte perto do ponto nos próximos 90 min (substitui o aviso anterior do aparelho).
 * Guarda só a assinatura de push e o ponto arredondado (~1 km); nada de IP. Ver src/lib/avisosChuva.ts.
 */
export function POST(req: Request) {
  return tratar(async () => {
    if (!configurado()) return erro(503, "Avisos ainda não configurados no servidor.");
    const p = Corpo.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new ErroParametro("corpo inválido");
    const id = await criarAvisoChuva(p.data.assinatura, p.data.lat, p.data.lng, p.data.lugar);
    after(() => vigiar(origemPublica(req)));
    return ok({ id, ativo: true, expiraEmMin: 90 }, null, 0);
  });
}

/** DELETE /avisos/chuva?id= — para de avisar e apaga o registro. */
export function DELETE(req: Request) {
  return tratar(async () => {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ErroParametro("id inválido");
    await apagarAvisoChuva(id);
    return ok({ id, ativo: false }, null, 0);
  });
}
