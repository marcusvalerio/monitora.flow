/**
 * Previsão do tempo — FONTE EXTERNA: Open-Meteo (https://open-meteo.com), gratuita, sem chave,
 * licença dos dados CC BY 4.0, uso não comercial no plano gratuito. É modelo numérico, não medição.
 */
export const ATRIBUICAO_OPEN_METEO = "Previsão: Open-Meteo.com (CC BY 4.0)";

export function urlOpenMeteo(lat: number, lng: number) {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lng.toFixed(4),
    current: "temperature_2m,precipitation,rain,weather_code",
    hourly: "temperature_2m,precipitation_probability,precipitation",
    forecast_hours: "6", timezone: "America/Sao_Paulo",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

interface OM {
  current?: { time: string; temperature_2m?: number; precipitation?: number; weather_code?: number };
  hourly?: { time: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; precipitation?: number[] };
  utc_offset_seconds?: number;
}

const iso = (local: string, off: number) => new Date(Date.parse(`${local}:00Z`) - off * 1000).toISOString();

export function normalizarOpenMeteo(j: OM) {
  const off = j.utc_offset_seconds ?? -10800;
  const h = j.hourly;
  return {
    agora: j.current ? {
      em: iso(j.current.time, off), temperaturaC: j.current.temperature_2m ?? null,
      precipitacaoMm: j.current.precipitation ?? null, codigoWmo: j.current.weather_code ?? null,
    } : null,
    proximasHoras: (h?.time ?? []).map((t, i) => ({
      inicio: iso(t, off), temperaturaC: h?.temperature_2m?.[i] ?? null,
      probabilidadeChuvaPct: h?.precipitation_probability?.[i] ?? null, precipitacaoMm: h?.precipitation?.[i] ?? null,
    })),
  };
}

export async function buscarPrevisao(lat: number, lng: number) {
  const r = await fetch(urlOpenMeteo(lat, lng), { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Open-Meteo respondeu HTTP ${r.status}`);
  return normalizarOpenMeteo(await r.json());
}
