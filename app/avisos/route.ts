import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sql } from "../../src/lib/db";
import { configurado, enviar, mensagem } from "../../src/lib/avisos";
import { ok, erro, tratar, ErroParametro } from "../../src/lib/api";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  assinatura: z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }),
  linha: z.string().trim().toUpperCase().regex(/^[A-Z0-9 -]{1,20}$/),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  ponto: z.string().trim().min(1).max(120), sentido: z.string().trim().max(120).nullish(),
  etaMin: z.number().min(0).max(300).nullish(),
});

/** Acorda o vigia (ele mesmo garante que só um roda por vez). */
export function acordarVigia(origem: string) {
  return fetch(`${origem}/avisos/vigiar`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` }, signal: AbortSignal.timeout(5000) }).catch(() => null);
}

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
    const b = p.data, id = randomUUID(), db = sql();
    await db`update avisos set ativo = false where ativo and assinatura->>'endpoint' = ${b.assinatura.endpoint}`;
    await db`insert into avisos (id, assinatura, linha, lat, lng, ponto_nome, sentido, etapa, ultimo_eta)
             values (${id}, ${db.json(b.assinatura)}, ${b.linha}, ${b.lat}, ${b.lng}, ${b.ponto}, ${b.sentido ?? null}, 1, ${b.etaMin ?? null})`;
    await enviar({ id, assinatura: b.assinatura, linha: b.linha }, mensagem(1, b.linha, b.ponto, b.etaMin ?? null));
    const origem = new URL(req.url).origin;
    after(() => acordarVigia(origem));
    return ok({ id, ativo: true }, null, 0);
  });
}

/** DELETE /avisos?id= — para de avisar. */
export function DELETE(req: Request) {
  return tratar(async () => {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ErroParametro("id inválido");
    await sql()`update avisos set ativo = false where id = ${id}`;
    return ok({ id, ativo: false }, null, 0);
  });
}
