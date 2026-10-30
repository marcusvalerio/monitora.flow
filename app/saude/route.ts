import { sql } from "../../src/lib/db";
import { configurado } from "../../src/lib/avisos";
import { ok } from "../../src/lib/api";

export const dynamic = "force-dynamic";

/** GET /saude — o banco responde? os avisos estão configurados? Só acorda o banco quando alguém abre a página de teste. */
export async function GET() {
  const t = Date.now();
  let banco: { ok: boolean; ms: number; erro?: string; ultimaColeta?: string | null };
  try {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida");
    const [r] = await sql()`select max(fim) as fim from coletas`;
    banco = { ok: true, ms: Date.now() - t, ultimaColeta: r?.fim ?? null };
  } catch (e) {
    banco = { ok: false, ms: Date.now() - t, erro: (e as Error).message.slice(0, 200) };
  }
  return ok({ banco, avisos: { configurado: configurado(), chavePublica: !!process.env.VAPID_PUBLIC_KEY } }, null, 0);
}
