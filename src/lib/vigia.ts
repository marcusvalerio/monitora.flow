/**
 * Vigia dos avisos (ônibus chegando e chuva forte): confere a cada 20 s por ~4,5 min e, se ainda houver aviso ativo,
 * acorda uma nova execução de si mesmo (POST /avisos/vigiar).
 *
 * Por que roda dentro do próprio pedido: antes o POST /avisos só chamava /avisos/vigiar por HTTP usando a origem do
 * pedido — na Vercel isso é a URL do deploy, protegida por login (Deployment Protection) — e a chamada nunca chegava.
 * Resultado: o aviso ficava parado em "acompanhando" e nenhuma notificação seguinte saía. Agora a primeira rodada
 * roda aqui mesmo (em `after()`), e o encadeamento usa o domínio de PRODUÇÃO (VERCEL_PROJECT_PRODUCTION_URL).
 */
import { pegarVez, rodada, soltarVez } from "./avisos";
import { rodadaChuva } from "./avisosChuva";

export const PASSO_MS = 20_000, DURACAO_MS = 270_000;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Origem pública para o vigia chamar a si mesmo: domínio de produção quando existir; senão a do pedido (dev/local). */
export function origemPublica(req: Request) {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : new URL(req.url).origin;
}

export function acordarVigia(origem: string) {
  return fetch(`${origem}/avisos/vigiar`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` }, signal: AbortSignal.timeout(5000) })
    .then((r) => { if (!r.ok) console.error(`[vigia] acordar ${origem} respondeu HTTP ${r.status}`); })
    .catch((e) => console.error(`[vigia] acordar ${origem} falhou: ${(e as Error).message}`));
}

/** Uma execução do vigia. Só um processo por vez (lease no banco); quem não pega a vez sai na hora. */
export async function vigiar(origem: string) {
  if (!(await pegarVez(DURACAO_MS / 1000 + 20).catch((e) => { console.error("[vigia] pegarVez", e); return false; }))) return;
  const fim = Date.now() + DURACAO_MS;
  let ativos = 0;
  try {
    do {
      const [onibus, chuva] = await Promise.all([
        rodada().catch((e) => { console.error("[vigia] ônibus", e); return 1; }),
        rodadaChuva().catch((e) => { console.error("[vigia] chuva", e); return 1; }),
      ]);
      ativos = onibus + chuva;
      if (!ativos) break;
      await dormir(PASSO_MS);
    } while (Date.now() < fim);
  } finally { await soltarVez().catch(() => {}); }
  if (ativos) await acordarVigia(origem);
}
