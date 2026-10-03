/**
 * Programação oficial de frequência (GTFS frequencies.txt, SMTR) — FONTE EXTERNA.
 * Responde: "qual o intervalo programado agora?", "quantas partidas por hora?" e o perfil do dia.
 * Hora local do Rio: UTC−3 (sem horário de verão desde 2019).
 * Madrugada: faixas do GTFS podem passar de 24:00 (ex.: 22:00–29:00); por isso olhamos também o serviço do dia anterior + 1440 min.
 */
import dados from "../data/frequencias.json";

type Faixa = [number, number, number];
interface SentidoProg { sentido: number; destino: string; servicos: Record<string, Faixa[]> }
const F = dados as unknown as { versaoGtfs: string; validoAte: string; diasDoServico: Record<string, string[]>; excecoes: Record<string, string>; linhas: Record<string, { nome: string; sentidos: SentidoProg[] }> };

export const FONTE_FREQUENCIAS = { fonte: "https://dados.mobilidade.rio/gtfs/schedule", arquivo: "frequencies.txt", versaoGtfs: F.versaoGtfs, validoAte: F.validoAte };

const RIO_OFFSET_MIN = -180;
/** Data (AAAAMMDD), dia da semana (0 = segunda) e minuto do dia no horário do Rio. */
export function relogioRio(d: Date) {
  const r = new Date(d.getTime() + RIO_OFFSET_MIN * 60_000);
  const ymd = `${r.getUTCFullYear()}${String(r.getUTCMonth() + 1).padStart(2, "0")}${String(r.getUTCDate()).padStart(2, "0")}`;
  return { ymd, dow: (r.getUTCDay() + 6) % 7, minuto: r.getUTCHours() * 60 + r.getUTCMinutes() };
}

/** Tipo de dia do serviço (U_REG / S_REG / D_REG), com feriados do calendar_dates. */
export function servicoDoDia(d: Date): string | null {
  const { ymd, dow } = relogioRio(d);
  if (F.excecoes[ymd]) return F.excecoes[ymd];
  for (const [s, ds] of Object.entries(F.diasDoServico)) if (ds.includes(String(dow))) return s;
  return null;
}
export const ROTULO_SERVICO: Record<string, string> = { U_REG: "dia útil", S_REG: "sábado", D_REG: "domingo/feriado" };

function faixaEm(faixas: Faixa[] | undefined, m: number): Faixa | null {
  return faixas?.find(([a, b]) => m >= a && m < b) ?? null;
}

export interface ProgramacaoSentido {
  sentido: number; destino: string;
  intervaloS: number | null; partidasPorHora: number | null;
  faixa: { inicio: string; fim: string } | null;
  perfil: (number | null)[]; // partidas/hora programadas, hora 0..23 do dia de serviço de hoje
}
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Programação da linha agora. null = linha sem frequência publicada no GTFS. */
export function programacao(modo: "BRT" | "BUS", linha: string, agora = new Date()) {
  const l = F.linhas[`${modo}:${linha.toUpperCase()}`];
  if (!l) return null;
  const hoje = servicoDoDia(agora), ontem = servicoDoDia(new Date(agora.getTime() - 86_400_000));
  const { minuto } = relogioRio(agora);
  const sentidos: ProgramacaoSentido[] = l.sentidos.map((s) => {
    const f = faixaEm(hoje ? s.servicos[hoje] : undefined, minuto) ?? faixaEm(ontem ? s.servicos[ontem] : undefined, minuto + 1440);
    const perfil = Array.from({ length: 24 }, (_, h) => {
      const fx = faixaEm(hoje ? s.servicos[hoje] : undefined, h * 60 + 30) ?? faixaEm(ontem ? s.servicos[ontem] : undefined, h * 60 + 30 + 1440);
      return fx ? Math.round((3600 / fx[2]) * 10) / 10 : null;
    });
    return {
      sentido: s.sentido, destino: s.destino,
      intervaloS: f ? f[2] : null, partidasPorHora: f ? Math.round((3600 / f[2]) * 10) / 10 : null,
      faixa: f ? { inicio: hhmm(f[0]), fim: hhmm(f[1]) } : null, perfil,
    };
  });
  return { nome: l.nome, tipoDia: hoje ? ROTULO_SERVICO[hoje] ?? hoje : null, horaRio: relogioRio(agora).minuto, sentidos };
}
