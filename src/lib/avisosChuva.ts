/**
 * Aviso de "chuva forte aqui" por Web Push (aba Atenção).
 * Dados mínimos (docs/REFORMULACAO.md, item 5): só a assinatura de push do navegador e o ponto ARREDONDADO
 * (2 casas ≈ 1 km — não guarda o endereço exato). Sem IP, sem conta. Expira em 90 min e a linha é APAGADA ao expirar
 * ou depois de avisar (avisa uma vez só).
 *
 * Quando avisar (ESCOLHA DO SISTEMA): algum dos 3 pluviômetros do Alerta Rio mais próximos, a até 5 km, mede chuva
 * "forte" ou mais (> 25 mm/h pela escala de intensidadeChuva) na última hora OU no ritmo dos últimos 15 min (m15 × 4).
 */
import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { buscarChuvas, estacoesProximas, intensidadeChuva, type EstacaoChuva } from "./chuva";
import { enviarPush } from "./avisos";

export const LIMIAR_FORTE_MM_H = 25, RAIO_PLUVIOMETRO_M = 5000;
export const arredondar = (v: number) => Math.round(v * 100) / 100;

let tabela: Promise<void> | null = null;
export function garantirTabelaChuva() {
  tabela ??= (async () => {
    await sql()`create table if not exists avisos_chuva (
      id text primary key, assinatura jsonb not null, lat double precision not null, lng double precision not null,
      lugar text not null, criado_em timestamptz not null default now(), expira_em timestamptz not null default now() + interval '90 minutes')`;
  })().catch((e) => { tabela = null; throw e; });
  return tabela;
}

/** Pluviômetro que dispara o aviso (o de chuva mais forte entre os próximos), ou null. Pura: testada em tests/avisos.test.ts. */
export function chuvaForteAqui(es: EstacaoChuva[], lat: number, lng: number) {
  const perto = estacoesProximas(es, lat, lng, 3).filter((e) => e.distanciaM <= RAIO_PLUVIOMETRO_M);
  let melhor: { estacao: string; mmH: number; distanciaM: number } | null = null;
  for (const e of perto) {
    const mmH = Math.max(e.mm.h01 ?? 0, (e.mm.m15 ?? 0) * 4);
    if (mmH > LIMIAR_FORTE_MM_H && (!melhor || mmH > melhor.mmH)) melhor = { estacao: e.nome, mmH, distanciaM: e.distanciaM };
  }
  return melhor;
}

export function mensagemChuva(lugar: string, d: { estacao: string; mmH: number }) {
  const mm = d.mmH.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return { title: `Chuva ${intensidadeChuva(d.mmH)} perto de ${lugar}`, body: `${mm} mm/h no pluviômetro ${d.estacao} (Alerta Rio). Evite áreas de alagamento.`, urgente: true };
}

export async function criarAvisoChuva(assinatura: object & { endpoint: string }, lat: number, lng: number, lugar: string) {
  await garantirTabelaChuva();
  const db = sql(), id = randomUUID();
  await db`delete from avisos_chuva where assinatura->>'endpoint' = ${assinatura.endpoint}`; // um por aparelho
  await db`insert into avisos_chuva (id, assinatura, lat, lng, lugar) values (${id}, ${db.json(assinatura as never)}, ${arredondar(lat)}, ${arredondar(lng)}, ${lugar})`;
  return id;
}
export async function apagarAvisoChuva(id: string) { await garantirTabelaChuva(); await sql()`delete from avisos_chuva where id = ${id}`; }

/** Uma rodada do vigia: apaga os expirados, confere os ativos e avisa (e apaga) quem tem chuva forte perto. Devolve quantos seguem ativos. */
export async function rodadaChuva(): Promise<number> {
  await garantirTabelaChuva();
  const db = sql();
  await db`delete from avisos_chuva where expira_em < now()`;
  const ativos = await db<{ id: string; assinatura: never; lat: number; lng: number; lugar: string }[]>`select id, assinatura, lat, lng, lugar from avisos_chuva`;
  if (!ativos.length) return 0;
  const { estacoes } = await buscarChuvas();
  let restam = 0;
  for (const a of ativos) {
    const d = chuvaForteAqui(estacoes, a.lat, a.lng);
    if (!d) { restam++; continue; }
    await enviarPush(a.assinatura, { ...mensagemChuva(a.lugar, d), tag: `chuva-${a.id}`, url: "/atencao" });
    await db`delete from avisos_chuva where id = ${a.id}`;
  }
  return restam;
}
