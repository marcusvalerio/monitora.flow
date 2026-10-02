/**
 * Previsão do tempo — FONTE EXTERNA: Open-Meteo (https://open-meteo.com), gratuita, sem chave,
 * licença dos dados CC BY 4.0, uso não comercial no plano gratuito. É modelo numérico, não medição.
 */
export const ATRIBUICAO_OPEN_METEO = "Previsão: Open-Meteo.com (CC BY 4.0)";

export function urlOpenMeteo(lat: number, lng: number) {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lng.toFixed(4),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,is_day",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,visibility,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset",
    forecast_hours: "24", forecast_days: "7", timezone: "America/Sao_Paulo",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

interface OM {
  current?: { time: string; temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number; wind_direction_10m?: number; precipitation?: number; weather_code?: number; is_day?: number };
  hourly?: { time: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; precipitation?: number[]; weather_code?: number[]; visibility?: number[]; is_day?: number[] };
  daily?: { time: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; precipitation_sum?: number[]; sunrise?: string[]; sunset?: string[] };
  utc_offset_seconds?: number;
}

/**
 * Descrição dos códigos de tempo WMO (FONTE EXTERNA: tabela WMO 4677, como documentada pelo Open-Meteo).
 * `icone` é só a família visual usada pela interface.
 */
export function descreverWmo(c: number | null | undefined): { texto: string; icone: "sol" | "parcial" | "nublado" | "neblina" | "garoa" | "chuva" | "tempestade" | "neve" } | null {
  if (c === null || c === undefined) return null;
  if (c === 0) return { texto: "Céu limpo", icone: "sol" };
  if (c === 1) return { texto: "Predomínio de sol", icone: "parcial" };
  if (c === 2) return { texto: "Parcialmente nublado", icone: "parcial" };
  if (c === 3) return { texto: "Nublado", icone: "nublado" };
  if (c === 45 || c === 48) return { texto: "Neblina", icone: "neblina" };
  if (c >= 51 && c <= 57) return { texto: "Garoa", icone: "garoa" };
  if (c >= 61 && c <= 67) return { texto: c >= 65 ? "Chuva forte" : c >= 63 ? "Chuva moderada" : "Chuva fraca", icone: "chuva" };
  if (c >= 71 && c <= 77) return { texto: "Neve", icone: "neve" };
  if (c >= 80 && c <= 82) return { texto: c === 82 ? "Pancadas fortes" : "Pancadas de chuva", icone: "chuva" };
  if (c >= 85 && c <= 86) return { texto: "Neve", icone: "neve" };
  if (c >= 95) return { texto: "Tempestade", icone: "tempestade" };
  return null;
}

const iso = (local: string, off: number) => new Date(Date.parse(`${local}:00Z`) - off * 1000).toISOString();

export function normalizarOpenMeteo(j: OM) {
  const off = j.utc_offset_seconds ?? -10800;
  const h = j.hourly;
  const d = j.daily;
  const c = j.current;
  return {
    agora: c ? {
      em: iso(c.time, off), temperaturaC: c.temperature_2m ?? null, sensacaoC: c.apparent_temperature ?? null,
      umidadePct: c.relative_humidity_2m ?? null, ventoKmh: c.wind_speed_10m ?? null, ventoDirecao: c.wind_direction_10m ?? null,
      precipitacaoMm: c.precipitation ?? null, codigoWmo: c.weather_code ?? null, descricao: descreverWmo(c.weather_code),
      dia: c.is_day === undefined ? null : c.is_day === 1,
    } : null,
    proximasHoras: (h?.time ?? []).map((t, i) => ({
      inicio: iso(t, off), temperaturaC: h?.temperature_2m?.[i] ?? null,
      probabilidadeChuvaPct: h?.precipitation_probability?.[i] ?? null, precipitacaoMm: h?.precipitation?.[i] ?? null,
      codigoWmo: h?.weather_code?.[i] ?? null, descricao: descreverWmo(h?.weather_code?.[i]),
      visibilidadeM: h?.visibility?.[i] ?? null, dia: h?.is_day?.[i] === undefined ? null : h.is_day[i] === 1,
    })),
    proximosDias: (d?.time ?? []).map((t, i) => ({
      data: t, maxC: d?.temperature_2m_max?.[i] ?? null, minC: d?.temperature_2m_min?.[i] ?? null,
      probabilidadeChuvaPct: d?.precipitation_probability_max?.[i] ?? null, chuvaMm: d?.precipitation_sum?.[i] ?? null,
      codigoWmo: d?.weather_code?.[i] ?? null, descricao: descreverWmo(d?.weather_code?.[i]),
      nascerSol: d?.sunrise?.[i] ? iso(d.sunrise[i], off) : null, porSol: d?.sunset?.[i] ? iso(d.sunset[i], off) : null,
    })),
  };
}

export async function buscarPrevisao(lat: number, lng: number) {
  const r = await fetch(urlOpenMeteo(lat, lng), { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Open-Meteo respondeu HTTP ${r.status}`);
  return normalizarOpenMeteo(await r.json());
}
