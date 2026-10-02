import { buscarBrt, buscarSppo, parseBrt, parseSppo, type Leitura } from "./fontes";
import { agregarPorPonto, deduplicar, inicioBucket } from "./agregar";
import { PARAMETROS } from "./parametros";
import { PONTOS } from "../config/pontos";
import { sql } from "./db";

const MIN = 60_000;

/** Lê as posições do banco (já sem placa) e converte para Leitura. */
export async function lerPosicoes(desde: Date, filtro?: { latMin: number; latMax: number; lngMin: number; lngMax: number }): Promise<Leitura[]> {
  const db = sql();
  const rows = filtro
    ? await db`select * from posicoes where ts >= ${desde}
        and lat between ${filtro.latMin} and ${filtro.latMax} and lng between ${filtro.lngMin} and ${filtro.lngMax}`
    : await db`select * from posicoes where ts >= ${desde}`;
  return rows.map((r) => ({
    fonte: r.fonte, veiculo: r.veiculo, linha: r.linha, sentido: r.sentido,
    lat: r.lat, lng: r.lng, velocidade: r.velocidade, ts: new Date(r.ts),
  }));
}

export async function coletar(agora = new Date()) {
  const db = sql();
  const erros: string[] = [];
  const descartadas: Record<string, Record<string, number>> = {};

  // Janela do SPPO: continua de onde a última coleta parou, limitada a SPPO_JANELA_MAX_MIN.
  const [ult] = await db`select max(sppo_ate) as ate from coletas`;
  const limite = new Date(agora.getTime() - PARAMETROS.SPPO_JANELA_MAX_MIN * MIN);
  const sppoDe = ult?.ate && new Date(ult.ate) > limite ? new Date(ult.ate) : limite;
  const sppoAte = agora;

  const [brt, sppo] = await Promise.allSettled([buscarBrt(), buscarSppo(sppoDe, sppoAte)]);
  let leituras: Leitura[] = [];
  let nBrt = 0, nSppo = 0;
  if (brt.status === "fulfilled") {
    try { const r = parseBrt(brt.value, agora); leituras = leituras.concat(r.leituras); nBrt = r.leituras.length; descartadas.brt = r.descartadas; }
    catch (e) { erros.push(`brt: formato inesperado: ${(e as Error).message}`); }
  } else erros.push(`brt: ${brt.reason}`);
  let sppoOk = false;
  if (sppo.status === "fulfilled") {
    try { const r = parseSppo(sppo.value); leituras = leituras.concat(r.leituras); nSppo = r.leituras.length; descartadas.sppo = r.descartadas; sppoOk = true; }
    catch (e) { erros.push(`sppo: formato inesperado: ${(e as Error).message}`); }
  } else erros.push(`sppo: ${sppo.reason}`);

  leituras = deduplicar(leituras);
  const corteBruto = new Date(agora.getTime() - PARAMETROS.RETENCAO_BRUTO_MIN * MIN);
  const linhas = leituras.filter((l) => l.ts >= corteBruto).map((l) => ({
    fonte: l.fonte, veiculo: l.veiculo, ts: l.ts, lat: l.lat, lng: l.lng,
    velocidade: l.velocidade, linha: l.linha, sentido: l.sentido,
  }));

  // Recalcula todos os buckets ainda cobertos pelas posições brutas (leituras do SPPO chegam atrasadas).
  const recalcDesde = inicioBucket(new Date(corteBruto.getTime() + PARAMETROS.BUCKET_MIN * MIN));

  await db.begin(async (tx) => {
    for (let i = 0; i < linhas.length; i += 4000) {
      await tx`insert into posicoes ${tx(linhas.slice(i, i + 4000))} on conflict do nothing`;
    }
    await tx`delete from posicoes where ts < ${corteBruto}`;
  });

  const brutas = await lerPosicoes(recalcDesde);
  const ags = agregarPorPonto(brutas, PONTOS).filter((a) => a.bucket >= recalcDesde);
  await db.begin(async (tx) => {
    await tx`delete from agregados where bucket >= ${recalcDesde}`;
    const rows = ags.map((a) => ({
      ponto: a.ponto, fonte: a.fonte, bucket: a.bucket, n_veiculos: a.nVeiculos, n_leituras: a.nLeituras,
      n_leituras_movimento: a.nLeiturasMovimento, velocidade_media: a.velocidadeMedia,
      velocidade_mediana: a.velocidadeMediana, proporcao_parados: a.proporcaoParados,
      linhas: a.linhas, sentidos: a.sentidos,
    }));
    if (rows.length) await tx`insert into agregados ${tx(rows)}`;
    await tx`delete from agregados where bucket < ${new Date(agora.getTime() - PARAMETROS.RETENCAO_AGREGADO_DIAS * 1440 * MIN)}`;
    await tx`delete from coletas where fim < ${new Date(agora.getTime() - 30 * 1440 * MIN)}`;
    await tx`insert into coletas (inicio, sppo_de, sppo_ate, n_brt, n_sppo, descartadas, erros)
      values (${agora}, ${sppoDe}, ${sppoOk ? sppoAte : null}, ${nBrt}, ${nSppo}, ${tx.json(descartadas)}, ${tx.json(erros)})`;
  });

  return { inicio: agora, sppo: { de: sppoDe, ate: sppoAte, leituras: nSppo }, brt: { leituras: nBrt }, agregadosRecalculados: ags.length, descartadas, erros };
}

/** Posições recentes de uma linha (BRT `linha` ou SPPO `servico`), sem placa. */
export async function lerPosicoesLinha(linha: string, desde: Date): Promise<Leitura[]> {
  const rows = await sql()`select * from posicoes where linha = ${linha} and ts >= ${desde}`;
  return rows.map((r) => ({
    fonte: r.fonte, veiculo: r.veiculo, linha: r.linha, sentido: r.sentido,
    lat: r.lat, lng: r.lng, velocidade: r.velocidade, ts: new Date(r.ts),
  }));
}
