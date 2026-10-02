export function media(v: number[]): number | null {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/**
 * Percentil por interpolação linear entre ordens (método "tipo 7" de Hyndman & Fan,
 * padrão do R/NumPy — FONTE EXTERNA). p em [0, 1].
 */
export function percentil(v: number[], p: number): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export const mediana = (v: number[]) => percentil(v, 0.5);

export const arred = (x: number | null, casas = 1) =>
  x === null ? null : Math.round(x * 10 ** casas) / 10 ** casas;
