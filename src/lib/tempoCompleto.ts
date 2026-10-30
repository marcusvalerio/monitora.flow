/**
 * Previsão COMPLETA usada pela tela Clima — FONTE EXTERNA: Open-Meteo (previsão + qualidade do ar), CC BY 4.0.
 * Acrescenta ao /tempo: chuva em passos de 15 min (próximas 2 h), 48 h, índice UV, rajadas, pressão,
 * ontem (para comparar) e qualidade do ar. É modelo numérico, não medição.
 */
import { descreverWmo } from "./tempo";

const TZ = "America/Sao_Paulo";

export function urlCompleta(lat: number, lng: number) {
  const p = new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lng.toFixed(4), timezone: TZ,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code,is_day,uv_index,pressure_msl,cloud_cover",
    minutely_15: "precipitation,precipitation_probability", forecast_minutely_15: "8",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,uv_index,wind_speed_10m,wind_gusts_10m,is_day",
    forecast_hours: "48",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,wind_gusts_10m_max,sunrise,sunset",
    past_days: "1", forecast_days: "8",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

export function urlAr(lat: number, lng: number) {
  const p = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lng.toFixed(4), timezone: TZ, current: "us_aqi,pm2_5,pm10" });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${p}`;
}

type Arr = (number | null)[];
interface OMC {
  utc_offset_seconds?: number;
  current?: Record<string, number | string>;
  minutely_15?: { time: string[]; precipitation?: Arr; precipitation_probability?: Arr };
  hourly?: { time: string[] } & Record<string, Arr | string[]>;
  daily?: { time: string[]; sunrise?: string[]; sunset?: string[] } & Record<string, Arr | string[]>;
}

const iso = (local: string, off: number) => new Date(Date.parse(`${local}:00Z`) - off * 1000).toISOString();
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Faixas do índice UV (OMS). */
export function nivelUv(uv: number | null): string | null {
  if (uv == null) return null;
  if (uv < 3) return "baixo";
  if (uv < 6) return "moderado";
  if (uv < 8) return "alto";
  if (uv < 11) return "muito alto";
  return "extremo";
}

/** Faixas do US AQI (EPA). */
export function nivelAr(aqi: number | null): string | null {
  if (aqi == null) return null;
  if (aqi <= 50) return "boa";
  if (aqi <= 100) return "moderada";
  if (aqi <= 150) return "ruim para grupos sensíveis";
  if (aqi <= 200) return "ruim";
  return "muito ruim";
}

/**
 * "Vai chover?" nas próximas 2 h, a partir dos passos de 15 min.
 * Limiar de 0,1 mm/15 min (ESCOLHA DO SISTEMA): abaixo disso é ruído do modelo.
 */
export function chuvaCurta(passos: { inicio: string; mm: number | null }[], agora = Date.now()) {
  const fut = passos.filter((p) => Date.parse(p.inicio) + 15 * 60_000 > agora);
  if (!fut.length) return null;
  const molhado = (p: { mm: number | null }) => (p.mm ?? 0) >= 0.1;
  const chovendo = molhado(fut[0]);
  const troca = fut.findIndex((p) => molhado(p) !== chovendo);
  const totalMm = fut.reduce((s, p) => s + (p.mm ?? 0), 0);
  return { chovendo, mudaEm: troca > 0 ? fut[troca].inicio : null, totalMm: Math.round(totalMm * 10) / 10 };
}

/** Janela de 2 h com menor chance de chuva nas próximas 12 h (para "melhor hora para sair"). */
export function melhorJanela(horas: { inicio: string; probabilidadeChuvaPct: number | null }[]) {
  const h = horas.slice(0, 12);
  let melhor: { inicio: string; pct: number } | null = null;
  for (let i = 0; i + 1 < h.length; i++) {
    const a = h[i].probabilidadeChuvaPct, b = h[i + 1].probabilidadeChuvaPct;
    if (a == null || b == null) continue;
    const pct = Math.max(a, b);
    if (!melhor || pct < melhor.pct) melhor = { inicio: h[i].inicio, pct };
  }
  return melhor;
}

export function normalizarCompleta(j: OMC, ar: { current?: Record<string, number> } | null, agora = Date.now()) {
  const off = j.utc_offset_seconds ?? -10800;
  const c = j.current ?? {};
  const h = j.hourly, d = j.daily, m = j.minutely_15;
  const col = (o: Record<string, unknown> | undefined, k: string, i: number) => n((o?.[k] as Arr | undefined)?.[i]);

  const horas = (h?.time ?? []).map((t, i) => ({
    inicio: iso(t, off), temperaturaC: col(h, "temperature_2m", i), sensacaoC: col(h, "apparent_temperature", i),
    probabilidadeChuvaPct: col(h, "precipitation_probability", i), precipitacaoMm: col(h, "precipitation", i),
    uv: col(h, "uv_index", i), ventoKmh: col(h, "wind_speed_10m", i), rajadaKmh: col(h, "wind_gusts_10m", i),
    descricao: descreverWmo(col(h, "weather_code", i)), dia: col(h, "is_day", i) == null ? null : col(h, "is_day", i) === 1,
  })).filter((x) => Date.parse(x.inicio) + 3600_000 > agora).slice(0, 36);

  const todosDias = (d?.time ?? []).map((t, i) => ({
    data: t, maxC: col(d, "temperature_2m_max", i), minC: col(d, "temperature_2m_min", i),
    probabilidadeChuvaPct: col(d, "precipitation_probability_max", i), chuvaMm: col(d, "precipitation_sum", i),
    uvMax: col(d, "uv_index_max", i), rajadaMaxKmh: col(d, "wind_gusts_10m_max", i),
    descricao: descreverWmo(col(d, "weather_code", i)),
    nascerSol: d?.sunrise?.[i] ? iso(d.sunrise[i], off) : null, porSol: d?.sunset?.[i] ? iso(d.sunset[i], off) : null,
  }));
  const hojeStr = new Date(agora).toLocaleDateString("en-CA", { timeZone: TZ });
  const iHoje = todosDias.findIndex((x) => x.data === hojeStr);
  const ontem = iHoje > 0 ? todosDias[iHoje - 1] : null;
  const dias = iHoje >= 0 ? todosDias.slice(iHoje, iHoje + 7) : todosDias.slice(-7);

  const passos = (m?.time ?? []).map((t, i) => ({ inicio: iso(t, off), mm: n(m?.precipitation?.[i]), pct: n(m?.precipitation_probability?.[i]) }));
  const uv = n(c.uv_index), aqi = n(ar?.current?.us_aqi);
  const hoje = dias[0];

  return {
    agora: {
      temperaturaC: n(c.temperature_2m), sensacaoC: n(c.apparent_temperature), umidadePct: n(c.relative_humidity_2m),
      ventoKmh: n(c.wind_speed_10m), ventoDirecao: n(c.wind_direction_10m), rajadaKmh: n(c.wind_gusts_10m),
      pressaoHpa: n(c.pressure_msl), nuvensPct: n(c.cloud_cover), precipitacaoMm: n(c.precipitation),
      uv, uvNivel: nivelUv(uv), descricao: descreverWmo(n(c.weather_code)), dia: n(c.is_day) == null ? null : c.is_day === 1,
    },
    chuva2h: { passos, resumo: chuvaCurta(passos, agora) },
    horas, dias,
    comparacao: ontem && hoje && ontem.maxC != null && hoje.maxC != null ? { ontemMaxC: ontem.maxC, hojeMaxC: hoje.maxC, difC: Math.round((hoje.maxC - ontem.maxC) * 10) / 10 } : null,
    melhorJanela: melhorJanela(horas),
    ar: aqi == null ? null : { usAqi: aqi, nivel: nivelAr(aqi), pm25: n(ar?.current?.pm2_5), pm10: n(ar?.current?.pm10) },
  };
}

export async function buscarCompleta(lat: number, lng: number) {
  const [r, a] = await Promise.all([
    fetch(urlCompleta(lat, lng), { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) } as RequestInit),
    fetch(urlAr(lat, lng), { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8_000) } as RequestInit).catch(() => null),
  ]);
  if (!r.ok) throw new Error(`Open-Meteo respondeu HTTP ${r.status}`);
  const ar = a && a.ok ? await a.json().catch(() => null) : null; // qualidade do ar é opcional: some se falhar
  return normalizarCompleta(await r.json(), ar);
}
