/**
 * Aviso de "ônibus chegando" por Web Push (funciona no iPhone com o app instalado na Tela de Início, iOS 16.4+).
 * O site não consegue usar a Ilha Dinâmica nem Live Activities (exclusivos de app nativo); o mais perto é
 * uma notificação na tela bloqueada que é SUBSTITUÍDA a cada etapa (mesma `tag`), em vez de empilhar.
 *
 * Expira em 90 min; ao expirar ou encerrar, a linha é apagada. Sem IP nem conta: só a assinatura de push.
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
import { destinoDoTrajeto } from "./veiculo";
import { PARAMETROS } from "./parametros";
import type { Leitura } from "./fontes";

export const LIMIAR_PERTO_MIN = 5, LIMIAR_CHEGANDO_MIN = 2;

export function configurado() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.DATABASE_URL);
}
function iniciarPush() {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contato@monitora.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

/**
 * Garante as tabelas dos avisos (mesmo DDL de db/schema.sql). Em produção o banco não tinha recebido a migração
 * e todo "Avisar quando estiver chegando" falhava com `relation "avisos" does not exist`. Idempotente; roda uma vez por instância.
 */
let tabelasProntas: Promise<void> | null = null;
export function garantirTabelas() {
  tabelasProntas ??= (async () => {
    const db = sql();
    await db`create table if not exists avisos (
      id text primary key, assinatura jsonb not null, linha text not null, lat double precision not null, lng double precision not null,
      ponto_nome text not null, sentido text, etapa smallint not null default 0, ultimo_eta real,
      criado_em timestamptz not null default now(), expira_em timestamptz not null default now() + interval '90 minutes',
      ativo boolean not null default true)`;
    await db`create index if not exists avisos_ativos on avisos (ativo, expira_em)`;
    await db`create table if not exists avisos_vigia (id smallint primary key default 1, ate timestamptz not null default 'epoch')`;
    await db`insert into avisos_vigia (id) values (1) on conflict do nothing`;
  })().catch((e) => { tabelasProntas = null; throw e; });
  return tabelasProntas;
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

/** Envia um push. Devolve "ok", "cancelada" (404/410: a assinatura não existe mais) ou "falhou". */
export async function enviarPush(assinatura: webpush.PushSubscription, m: { title: string; body: string; urgente: boolean; tag: string; url: string }) {
  iniciarPush();
  try {
    await webpush.sendNotification(assinatura, JSON.stringify(m), { TTL: 120, urgency: m.urgente ? "high" : "normal" });
    return "ok" as const;
  } catch (e) {
    const s = (e as { statusCode?: number }).statusCode;
    console.error(`[push] falhou HTTP ${s ?? "?"}: ${(e as { body?: string }).body ?? (e as Error).message}`);
    return s === 404 || s === 410 ? "cancelada" as const : "falhou" as const;
  }
}

export async function enviar(a: Pick<Aviso, "id" | "assinatura" | "linha">, m: { title: string; body: string; urgente: boolean }) {
  const r = await enviarPush(a.assinatura, { ...m, tag: `onibus-${a.id}`, url: "/mobilidade" });
  if (r === "cancelada") await sql()`update avisos set ativo = false where id = ${a.id}`;
  return r === "ok";
}

/**
 * Histórico do próprio vigia: as leituras ao vivo de cada rodada (a cada 20 s) ficam guardadas nesta execução.
 * Sem isso o ETA dependia das posições do banco, que só são gravadas enquanto alguém está com o app aberto
 * (coleta sob demanda): com o app fechado não havia leitura anterior, o ETA ficava vazio e nenhum aviso saía.
 */
const historico = new Map<string, Leitura[]>();
function guardarLeituras(linha: string, novas: Leitura[], agora: Date) {
  const corte = agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000;
  const vistos = new Set<string>();
  const todas = (historico.get(linha) ?? []).concat(novas).filter((l) => {
    const k = `${l.fonte}|${l.veiculo}|${l.ts.getTime()}`;
    if (l.ts.getTime() < corte || vistos.has(k)) return false;
    vistos.add(k); return true;
  });
  historico.set(linha, todas);
  return todas;
}

async function etaDaLinha(linha: string, lat: number, lng: number, sentido: string | null, cacheLinha: Map<string, Leitura[]>): Promise<number | null> {
  const agora = new Date();
  let ls = cacheLinha.get(linha);
  if (!ls) {
    const [vivo, banco] = await Promise.all([
      linhaAoVivo(linha),
      lerPosicoesLinha(linha, new Date(agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000)).catch((): Leitura[] => []),
    ]);
    ls = banco.concat(guardarLeituras(linha, vivo.leituras, agora)); cacheLinha.set(linha, ls);
  }
  const cs: Chegada[] = estimarChegadas(ls, lat, lng, agora);
  // O sentido salvo é um DESTINO ("Estação Santa Cruz"); o GPS traz "ida"/"volta" e o trajeto. Mesma regra da tela:
  // destino do veículo = destinoDoTrajeto(trajeto, sentido). Antes comparava "volta" com o destino e descartava todos.
  const destino = new Map<string, string | null>();
  for (const l of ls) destino.set(`${l.fonte}|${l.veiculo}`, destinoDoTrajeto(l.trajeto, l.sentido) ?? destino.get(`${l.fonte}|${l.veiculo}`) ?? null);
  const c = sentido ? cs.find((x) => { const d = destino.get(`${x.fonte}|${x.veiculo}`); return !d || mesmoDestino(d, sentido); }) : cs[0];
  return c?.etaMin ?? null;
}

/** Uma rodada: confere todos os avisos ativos e manda o que mudou de etapa. Devolve quantos seguem ativos. */
export async function rodada(): Promise<number> {
  await garantirTabelas();
  const db = sql();
  // dado mínimo: aviso expirado ou encerrado é APAGADO (não fica guardado)
  await db`delete from avisos where not ativo or expira_em < now()`;
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
  await garantirTabelas();
  const r = await sql()`update avisos_vigia set ate = now() + make_interval(secs => ${segundos}) where id = 1 and ate < now() returning id`;
  return r.length > 0;
}
export async function soltarVez() { await sql()`update avisos_vigia set ate = 'epoch' where id = 1`; }
