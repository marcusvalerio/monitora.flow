/**
 * Regra do aviso de "chuva forte perto de mim" (ligado em Ajustes; envio em src/lib/inscricoes.ts).
 * O ponto guardado é ARREDONDADO (2 casas ≈ 1 km).
 *
 * Quando avisar (ESCOLHA DO SISTEMA): algum dos 3 pluviômetros do Alerta Rio mais próximos, a até 5 km, mede chuva
 * "forte" ou mais (> 25 mm/h pela escala de intensidadeChuva) na última hora OU no ritmo dos últimos 15 min (m15 × 4).
 */
import { estacoesProximas, intensidadeChuva, type EstacaoChuva } from "./chuva";

export const LIMIAR_FORTE_MM_H = 25, RAIO_PLUVIOMETRO_M = 5000;
export const arredondar = (v: number) => Math.round(v * 100) / 100;

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
