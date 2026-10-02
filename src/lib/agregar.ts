import type { Fonte, Leitura } from "./fontes";
import { distanciaM } from "./geo";
import { arred, media, mediana } from "./estatistica";
import { PARAMETROS } from "./parametros";

/** Resumo calculado de um conjunto de leituras (já filtradas por raio/janela). */
export interface Resumo {
  nVeiculos: number;
  nLeituras: number;
  nLeiturasMovimento: number;
  velocidadeMedia: number | null;
  velocidadeMediana: number | null;
  proporcaoParados: number | null;
  linhas: string[];
  sentidos: string[];
}

/**
 * Fórmulas (ver docs/METODOLOGIA.md):
 *   nVeiculos          = |{veículos distintos}|
 *   nLeituras          = nº de leituras
 *   M                  = leituras com velocidade > VEL_MOVIMENTO_MIN_KMH
 *   velocidadeMedia    = (Σ v_i, i ∈ M) / |M|          (null se |M| = 0)
 *   velocidadeMediana  = mediana(v_i, i ∈ M)           (null se |M| = 0)
 *   proporcaoParados   = (nLeituras − |M|) / nLeituras (null se nLeituras = 0)
 */
export function resumir(ls: Leitura[]): Resumo {
  const mov = ls.filter((l) => l.velocidade > PARAMETROS.VEL_MOVIMENTO_MIN_KMH).map((l) => l.velocidade);
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x && x.trim() !== ""))].sort();
  return {
    nVeiculos: new Set(ls.map((l) => `${l.fonte}:${l.veiculo}`)).size,
    nLeituras: ls.length,
    nLeiturasMovimento: mov.length,
    velocidadeMedia: arred(media(mov)),
    velocidadeMediana: arred(mediana(mov)),
    proporcaoParados: ls.length ? arred((ls.length - mov.length) / ls.length, 3) : null,
    linhas: uniq(ls.map((l) => l.linha)),
    sentidos: uniq(ls.map((l) => l.sentido)),
  };
}

export function dentroDoRaio(ls: Leitura[], lat: number, lng: number, raioM: number): Leitura[] {
  return ls.filter((l) => distanciaM(lat, lng, l.lat, l.lng) <= raioM);
}

export const inicioBucket = (ts: Date, min = PARAMETROS.BUCKET_MIN) => {
  const ms = min * 60_000;
  return new Date(Math.floor(ts.getTime() / ms) * ms);
};

export interface Ponto { id: string; nome: string; lat: number; lng: number; raioM?: number }

export interface Agregado extends Resumo { ponto: string; fonte: Fonte; bucket: Date }

/**
 * Agrega leituras por (ponto, fonte, bucket de BUCKET_MIN minutos).
 * Buckets sem nenhuma leitura não geram linha — "sem dado" (regra 5).
 */
export function agregarPorPonto(ls: Leitura[], pontos: Ponto[]): Agregado[] {
  const grupos = new Map<string, { ponto: string; fonte: Fonte; bucket: Date; ls: Leitura[] }>();
  for (const p of pontos) {
    for (const l of dentroDoRaio(ls, p.lat, p.lng, p.raioM ?? PARAMETROS.RAIO_PADRAO_M)) {
      const bucket = inicioBucket(l.ts);
      const k = `${p.id}|${l.fonte}|${bucket.getTime()}`;
      let g = grupos.get(k);
      if (!g) grupos.set(k, (g = { ponto: p.id, fonte: l.fonte, bucket, ls: [] }));
      g.ls.push(l);
    }
  }
  return [...grupos.values()].map((g) => ({ ponto: g.ponto, fonte: g.fonte, bucket: g.bucket, ...resumir(g.ls) }));
}

/** Remove leituras repetidas do mesmo veículo no mesmo instante. */
export function deduplicar(ls: Leitura[]): Leitura[] {
  const m = new Map<string, Leitura>();
  for (const l of ls) m.set(`${l.fonte}|${l.veiculo}|${l.ts.getTime()}`, l);
  return [...m.values()];
}
