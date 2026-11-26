import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sql } from "../../src/lib/db";
import { configurado, enviar, garantirTabelas, mensagem } from "../../src/lib/avisos";
import { ok, erro, tratar, ErroParametro } from "../../src/lib/api";
import { origemPublica, vigiar } from "../../src/lib/vigia";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // a primeira execução do vigia roda junto do pedido (after)

const Corpo = z.object({
  assinatura: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  linha: z.string().trim().toUpperCase().regex(/^[A-Z0-9 -]{1,20}$/),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  ponto: z.string().trim().min(1).max(120), sentido: z.string().trim().max(120).nullish(),
  etaMin: z.number().min(0).max(300).nullish(),
});

/** GET /avisos — se os avisos estão ligados no servidor e a chave pública para assinar o push. */
export function GET() {
  return Promise.resolve(ok({ disponivel: configurado(), chavePublica: process.env.VAPID_PUBLIC_KEY ?? null }, null, 300));
}

/** POST /avisos — começa a avisar a chegada da linha no ponto (substitui o aviso anterior deste aparelho). */
export function POST(req: Request) {
  return tratar(async () => {
    if (!configurado()) return erro(503, "Avisos ainda não configurados no servidor.");
    const p = Corpo.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new ErroParametro("corpo inválido");
    await garantirTabelas();
    const b = p.data, id = randomUUID(), db = sql();
    await db`update avisos set ativo = false where ativo and assinatura->>'endpoint' = ${b.assinatura.endpoint}`;
    await db`insert into avisos (id, assinatura, linha, lat, lng, ponto_nome, sentido, etapa, ultimo_eta)
             values (${id}, ${db.json(b.assinatura)}, ${b.linha}, ${b.lat}, ${b.lng}, ${b.ponto}, ${b.sentido ?? null}, 1, ${b.etaMin ?? null})`;
    const enviado = await enviar({ id, assinatura: b.assinatura, linha: b.linha }, mensagem(1, b.linha, b.ponto, b.etaMin ?? null));
    after(() => vigiar(origemPublica(req)));
    return ok({ id, ativo: true, enviado }, null, 0);
  });
}

/** DELETE /avisos?id= — para de avisar. */
export function DELETE(req: Request) {
  return tratar(async () => {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ErroParametro("id inválido");
    await garantirTabelas();
    await sql()`delete from avisos where id = ${id}`; // dado mínimo: parou, apaga
    return ok({ id, ativo: false }, null, 0);
  });
}
