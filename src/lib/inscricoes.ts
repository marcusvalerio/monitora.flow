/**
 * Notificações permanentes, ligadas em Ajustes (decisão do dono, 27/11): "chuva forte perto de mim" e "alertas da cidade".
 * Guarda só a assinatura de push, o ponto ARREDONDADO (~1 km), o nome do lugar e as duas escolhas. Sem IP, sem conta.
 * Desligar as duas apaga a inscrição; assinatura cancelada (404/410) também apaga.
 *
 * Verificação (POST /alertas/verificar, a cada 10 min pelo GitHub Actions): primeiro lê as fontes SEM tocar no banco;
 * só consulta o banco quando há algo para avisar — o Neon continua dormindo em dia calmo.
 * Cada alerta é enviado uma vez por inscrição (tabela alertas_enviados, limpa após 2 dias).
 */
import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { buscarCidade } from "./cor";
import { buscarChuvas, type EstacaoChuva } from "./chuva";
import { buscarAvisosInmet, type AvisoInmet } from "./inmet";
import { arredondar, chuvaForteAqui, LIMIAR_FORTE_MM_H, mensagemChuva } from "./avisosChuva";
import { enviarPush } from "./avisos";

export interface Evento { chave: string; title: string; body: string }

/** Alertas da cidade que viram notificação (ESCOLHA DO SISTEMA): estágio ≥ 3 (COR), aviso INMET de perigo ou grande perigo, calor NC ≥ 4. */
export function eventosCidade(e: { estagio?: { nivel: number; desde?: string | null } | null; calor?: { nivel: number } | null; avisos?: AvisoInmet[] | null; hoje: string }): Evento[] {
  const out: Evento[] = [];
  if (e.estagio && e.estagio.nivel >= 3) out.push({ chave: `estagio-${e.estagio.nivel}-${e.estagio.desde ?? e.hoje}`, title: `Rio em estágio ${e.estagio.nivel} de 5`, body: "Ocorrências de alto impacto na cidade (COR). Veja a aba Atenção antes de sair." });
  for (const a of e.avisos ?? []) if (a.severidade !== "potencial")
    out.push({ chave: `inmet-${a.id}`, title: `INMET: ${a.titulo}`, body: `Aviso de ${a.severidade} para o Rio${a.fim ? ` até ${new Date(a.fim).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}.` });
  if (e.calor && e.calor.nivel >= 4) out.push({ chave: `calor-${e.calor.nivel}-${e.hoje}`, title: `Calor nível ${e.calor.nivel} no Rio`, body: "Evite sol forte, beba água e procure sombra (COR)." });
  return out;
}

let tabelas: Promise<void> | null = null;
export function garantirTabelasInscricoes() {
  tabelas ??= (async () => {
    const db = sql();
    await db`create table if not exists inscricoes (
      id text primary key, endpoint text unique not null, assinatura jsonb not null, lat double precision not null, lng double precision not null,
      lugar text not null, chuva boolean not null default false, cidade boolean not null default false, atualizado_em timestamptz not null default now())`;
    await db`create table if not exists alertas_enviados (chave text not null, inscricao text not null, em timestamptz not null default now(), primary key (chave, inscricao))`;
  })().catch((e) => { tabelas = null; throw e; });
  return tabelas;
}

export async function salvarInscricao(i: { assinatura: { endpoint: string }; lat: number; lng: number; lugar: string; chuva: boolean; cidade: boolean }) {
  await garantirTabelasInscricoes();
  const db = sql();
  if (!i.chuva && !i.cidade) { await db`delete from inscricoes where endpoint = ${i.assinatura.endpoint}`; return null; }
  const [r] = await db<{ id: string }[]>`insert into inscricoes (id, endpoint, assinatura, lat, lng, lugar, chuva, cidade)
    values (${randomUUID()}, ${i.assinatura.endpoint}, ${db.json(i.assinatura as never)}, ${arredondar(i.lat)}, ${arredondar(i.lng)}, ${i.lugar}, ${i.chuva}, ${i.cidade})
    on conflict (endpoint) do update set assinatura = excluded.assinatura, lat = excluded.lat, lng = excluded.lng, lugar = excluded.lugar,
      chuva = excluded.chuva, cidade = excluded.cidade, atualizado_em = now() returning id`;
  return r.id;
}

type Inscricao = { id: string; assinatura: never; lat: number; lng: number; lugar: string; chuva: boolean; cidade: boolean };

/** Uma verificação. Devolve o que fez (para o log do GitHub Actions). */
export async function verificarAlertas(agora = new Date()) {
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [cid, inmet, ch] = await Promise.allSettled([buscarCidade(), buscarAvisosInmet(), buscarChuvas()]);
  const eventos = eventosCidade({
    estagio: cid.status === "fulfilled" ? cid.value.estagio : null, calor: cid.status === "fulfilled" ? cid.value.calor : null,
    avisos: inmet.status === "fulfilled" ? inmet.value : null, hoje,
  });
  const estacoes: EstacaoChuva[] = ch.status === "fulfilled" ? ch.value.estacoes : [];
  const algumaForte = estacoes.some((e) => Math.max(e.mm.h01 ?? 0, (e.mm.m15 ?? 0) * 4) > LIMIAR_FORTE_MM_H);
  const fontes = { cor: cid.status, inmet: inmet.status, alertaRio: ch.status };
  if (!eventos.length && !algumaForte) return { fontes, eventos: 0, enviados: 0, banco: false };

  await garantirTabelasInscricoes();
  const db = sql();
  await db`delete from alertas_enviados where em < now() - interval '2 days'`;
  const ins = await db<Inscricao[]>`select id, assinatura, lat, lng, lugar, chuva, cidade from inscricoes`;
  const hora = agora.toISOString().slice(0, 13);
  let enviados = 0;
  for (const i of ins) {
    const meus: Evento[] = i.cidade ? [...eventos] : [];
    if (i.chuva && algumaForte) {
      const d = chuvaForteAqui(estacoes, i.lat, i.lng);
      if (d) meus.push({ chave: `chuva-${d.estacao}-${hora}`, ...mensagemChuva(i.lugar, d) });
    }
    for (const ev of meus) {
      const novo = await db`insert into alertas_enviados (chave, inscricao) values (${ev.chave}, ${i.id}) on conflict do nothing returning chave`;
      if (!novo.length) continue;
      const r = await enviarPush(i.assinatura, { title: ev.title, body: ev.body, urgente: true, tag: `alerta-${ev.chave}`, url: "/atencao" });
      if (r === "cancelada") { await db`delete from inscricoes where id = ${i.id}`; break; }
      if (r === "ok") enviados++;
    }
  }
  return { fontes, eventos: eventos.length, enviados, banco: true };
}
