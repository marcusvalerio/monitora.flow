/**
 * Aviso de "ônibus chegando" por Web Push (funciona no iPhone com o app instalado na Tela de Início, iOS 16.4+).
 * O site não consegue usar a Ilha Dinâmica nem Live Activities (exclusivos de app nativo); o mais perto é
 * uma notificação na tela bloqueada que é SUBSTITUÍDA a cada etapa (mesma `tag`), em vez de empilhar.
 *
 * Etapas (ESCOLHA DO SISTEMA, poucas para não incomodar):
 *   1 "acompanhando" — logo ao ativar, com a estimativa atual
 *   2 "faltam ≤ 5 min" — com som
 *   3 "chegando" (≤ 2 min) — com som; encerra o aviso
 */
import webpush from "web-push";
import { sql } from "./db";
import { linhaAoVivo } from "./aoVivo";
import { lerPosicoesLinha } from "./coletor";
import { estimarChegadas, type Chegada } from "./chegada";
import { mesmoDestino } from "./trajeto";
import { PARAMETROS } from "./parametros";
import type { Leitura } from "./fontes";

export const LIMIAR_PERTO_MIN = 5, LIMIAR_CHEGANDO_MIN = 2;

export function configurado() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.DATABASE_URL);
}
function iniciarPush() {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contato@monitora.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

/** Qual etapa a estimativa atual alcança (nunca volta para trás). */
export function proximaEtapa(etapa: number, etaMin: number | null): number {
  if (etaMin == null) return Math.max(etapa, 1);
  if (etaMin <= LIMIAR_CHEGANDO_MIN) return 3;
  if (etaMin <= LIMIAR_PERTO_MIN) return Math.max(etapa, 2);
  return Math.max(etapa, 1);
}

export function mensagem(etapa: number, linha: string, ponto: string, etaMin: number | null) {
  const min = etaMin == null ? null : Math.max(1, Math.round(etaMin));
  if (etapa >= 3) return { title: `${linha} chegando em ${ponto}`, body: "O ônibus está a menos de 2 min (estimativa). Hora de ir!", urgente: true };
  if (etapa === 2) return { title: `${linha} a ${min} min de ${ponto}`, body: "Está se aproximando. Avisamos de novo quando estiver chegando.", urgente: true };
  return { title: `Acompanhando ${linha}`, body: min == null ? `Nenhum veículo se aproximando de ${ponto} agora. Avisamos quando aparecer.` : `Chega em ${min} min em ${ponto} (estimativa). Avisamos quando estiver perto.`, urgente: false };
}

type Aviso = { id: string; assinatura: webpush.PushSubscription; linha: string; lat: number; lng: number; ponto_nome: string; sentido: string | null; etapa: number; ultimo_eta: number | null };

export async function enviar(a: Pick<Aviso, "id" | "assinatura" | "linha">, m: { title: string; body: string; urgente: boolean }) {
  iniciarPush();
  try {
    await webpush.sendNotification(a.assinatura, JSON.stringify({ ...m, tag: `onibus-${a.id}`, url: "/mobilidade" }), { TTL: 120, urgency: m.urgente ? "high" : "normal" });
    return true;
  } catch (e) {
    const s = (e as { statusCode?: number }).statusCode;
    if (s === 404 || s === 410) await sql()`update avisos set ativo = false where id = ${a.id}`; // assinatura cancelada
    return false;
  }
}

async function etaDaLinha(linha: string, lat: number, lng: number, sentido: string | null, cacheLinha: Map<string, Leitura[]>): Promise<number | null> {
  const agora = new Date();
  let ls = cacheLinha.get(linha);
  if (!ls) {
    const [vivo, banco] = await Promise.all([
      linhaAoVivo(linha),
      lerPosicoesLinha(linha, new Date(agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000)).catch((): Leitura[] => []),
    ]);
    ls = banco.concat(vivo.leituras); cacheLinha.set(linha, ls);
  }
  const cs: Chegada[] = estimarChegadas(ls, lat, lng, agora);
  const c = sentido ? cs.find((x) => !x.sentido || mesmoDestino(x.sentido, sentido)) : cs[0];
  return c?.etaMin ?? null;
}

/** Uma rodada: confere todos os avisos ativos e manda o que mudou de etapa. Devolve quantos seguem ativos. */
export async function rodada(): Promise<number> {
  const db = sql();
  await db`update avisos set ativo = false where ativo and expira_em < now()`;
  await db`delete from avisos where not ativo and criado_em < now() - interval '1 day'`;
  const ativos = await db<Aviso[]>`select id, assinatura, linha, lat, lng, ponto_nome, sentido, etapa, ultimo_eta from avisos where ativo`;
  const cache = new Map<string, Leitura[]>();
  for (const a of ativos) {
    const eta = await etaDaLinha(a.linha, a.lat, a.lng, a.sentido, cache).catch(() => null);
    const nova = proximaEtapa(a.etapa, eta);
    if (nova !== a.etapa) await enviar(a, mensagem(nova, a.linha, a.ponto_nome, eta));
    await db`update avisos set etapa = ${nova}, ultimo_eta = ${eta}, ativo = ${nova < 3} where id = ${a.id}`;
  }
  const [{ n }] = await db<{ n: number }[]>`select count(*)::int as n from avisos where ativo`;
  return n;
}

/** Tenta ser o vigia por `segundos`. Só um processo ganha; os outros saem na hora. */
export async function pegarVez(segundos: number) {
  const r = await sql()`update avisos_vigia set ate = now() + make_interval(secs => ${segundos}) where id = 1 and ate < now() returning id`;
  return r.length > 0;
}
export async function soltarVez() { await sql()`update avisos_vigia set ate = 'epoch' where id = 1`; }
