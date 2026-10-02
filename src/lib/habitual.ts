import { arred, percentil } from "./estatistica";
import { PARAMETROS } from "./parametros";

export interface LinhaAgregada {
  bucket: Date;
  nLeiturasMovimento: number;
  velocidadeMedia: number | null;
}

/** Dia da semana (0=domingo) e hora no fuso do Rio. */
export function diaHoraLocal(d: Date): { dia: number; hora: number; data: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PARAMETROS.FUSO, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { dia: dias.indexOf(p.weekday), hora: Number(p.hour), data: `${p.year}-${p.month}-${p.day}` };
}

/**
 * Habitual de um ponto num (dia da semana, hora):
 *  1. para cada dia d dos últimos N dias que caem nesse dia da semana, junta os buckets daquela hora;
 *  2. valor do dia  V_d = Σ(média_b · n_b) / Σ n_b, com n_b = leituras em movimento do bucket b
 *     (média ponderada = média de todas as leituras em movimento daquela hora);
 *  3. dias sem nenhuma leitura em movimento ficam de fora (sem dado, não são zero);
 *  4. retorna mediana, p25 e p75 (percentil tipo 7) dos V_d e quantos dias entraram.
 */
export function calcularHabitual(linhas: LinhaAgregada[], diaSemana: number, hora: number) {
  const porDia = new Map<string, { soma: number; n: number }>();
  for (const l of linhas) {
    if (l.velocidadeMedia === null || l.nLeiturasMovimento <= 0) continue;
    const { dia, hora: h, data } = diaHoraLocal(l.bucket);
    if (dia !== diaSemana || h !== hora) continue;
    const acc = porDia.get(data) ?? { soma: 0, n: 0 };
    acc.soma += l.velocidadeMedia * l.nLeiturasMovimento;
    acc.n += l.nLeiturasMovimento;
    porDia.set(data, acc);
  }
  const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, a]) => ({ data, velocidadeMedia: arred(a.soma / a.n) as number, nLeiturasMovimento: a.n }));
  const v = dias.map((d) => d.velocidadeMedia);
  return {
    nDias: dias.length,
    mediana: arred(percentil(v, 0.5)),
    p25: arred(percentil(v, 0.25)),
    p75: arred(percentil(v, 0.75)),
    dias,
  };
}

/**
 * INTERPRETADO — EXPERIMENTAL / ESCOLHA DO SISTEMA: posiciona o valor atual em relação
 * à faixa p25–p75 do habitual. Não é classificação de congestionamento.
 */
export function compararComHabitual(atual: number | null, h: { p25: number | null; p75: number | null; nDias: number }) {
  if (atual === null || h.p25 === null || h.p75 === null || h.nDias === 0) return "sem_dado" as const;
  if (atual < h.p25) return "abaixo_da_faixa_habitual" as const;
  if (atual > h.p75) return "acima_da_faixa_habitual" as const;
  return "dentro_da_faixa_habitual" as const;
}
