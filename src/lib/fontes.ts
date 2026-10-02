import { z } from "zod";
import { PARAMETROS } from "./parametros";

export type Fonte = "brt" | "sppo";

/** Leitura normalizada. Não contém placa (descartada na ingestão). */
export interface Leitura {
  fonte: Fonte;
  veiculo: string;
  linha: string | null;
  sentido: string | null;
  lat: number;
  lng: number;
  velocidade: number; // km/h
  ts: Date; // instante da posição (GPS)
  /**
   * Rumo informado pelo GPS, em graus: 0 = norte, crescendo no sentido horário (validado em 02/10/2026
   * contra o deslocamento real: mediana de 5–6° de diferença). null quando a fonte não informa.
   * Só existe na leitura ao vivo — não é gravado no banco.
   */
  direcao?: number | null;
  /** Trajeto informado pelo BRT (ex.: "22 - ALVORADA X JARDIM OCEANICO (PARADOR) [IDA]"). Só ao vivo. */
  trajeto?: string | null;
  /** BRT: ignição ligada? (campo `ignicao` 1/0). Só ao vivo. */
  ignicao?: boolean | null;
  /** SPPO: associação oficial da viagem informada pelo próprio feed (route_id/trip_id/shape_id do GTFS). Só ao vivo. */
  routeId?: string | null;
  tripId?: string | null;
  shapeId?: string | null;
  /** SPPO: instantes de envio e de chegada ao servidor (datetime_envio / datetime_servidor). Só ao vivo. */
  enviadoEm?: Date | null;
  recebidoEm?: Date | null;
}

/** Converte o campo `direcao` das fontes em graus [0, 360) ou null (vazio, " ", fora do intervalo). */
export function lerDirecao(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 360 ? n % 360 : null;
}

export const URL_BRT = "https://dados.mobilidade.rio/gps/brt";
export const URL_SPPO = "https://dados.mobilidade.rio/gps/sppo";

const num = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "número inválido" });
    return z.NEVER;
  }
  return n;
});

// Só os campos usados são declarados; o resto (inclusive `placa`) é descartado pelo zod.
const brtItem = z.object({
  codigo: z.union([z.string(), z.number()]).transform(String),
  linha: z.union([z.string(), z.number()]).transform(String).nullish(),
  latitude: num,
  longitude: num,
  dataHora: num,
  velocidade: num,
  sentido: z.string().nullish(),
  direcao: z.unknown().optional(),
  trajeto: z.string().nullish(),
  ignicao: z.union([z.number(), z.string()]).nullish(),
});
const brtResposta = z.object({ veiculos: z.array(z.unknown()) });

const sppoItem = z.object({
  id_veiculo: z.string(),
  servico: z.string().nullish(),
  sentido: z.string().nullish(),
  latitude: num,
  longitude: num,
  velocidade: num,
  datetime: z.string(),
  direcao: z.unknown().optional(),
  route_id: z.string().nullish(),
  trip_id: z.string().nullish(),
  shape_id: z.string().nullish(),
  datetime_envio: z.string().nullish(),
  datetime_servidor: z.string().nullish(),
});

export interface ResultadoParse {
  leituras: Leitura[];
  descartadas: Record<string, number>;
}

function conta(d: Record<string, number>, k: string) {
  d[k] = (d[k] ?? 0) + 1;
}

/** Caixa grosseira da cidade do Rio — fora disso é erro de GPS (EXPERIMENTAL / ESCOLHA DO SISTEMA). */
function dentroDoRio(lat: number, lng: number) {
  return lat > -23.15 && lat < -22.7 && lng > -43.85 && lng < -43.05;
}

function validaComum(l: Leitura, d: Record<string, number>): boolean {
  if (!dentroDoRio(l.lat, l.lng)) return conta(d, "fora_do_rio"), false;
  if (l.velocidade < 0 || l.velocidade > PARAMETROS.VEL_MAX_PLAUSIVEL_KMH)
    return conta(d, "velocidade_implausivel"), false;
  return true;
}

export function parseBrt(json: unknown, agora: Date): ResultadoParse {
  const descartadas: Record<string, number> = {};
  const leituras: Leitura[] = [];
  const idadeMax = PARAMETROS.BRT_IDADE_MAX_MIN * 60_000;
  for (const bruto of brtResposta.parse(json).veiculos) {
    const r = brtItem.safeParse(bruto);
    if (!r.success) { conta(descartadas, "formato_invalido"); continue; }
    const it = r.data;
    const ts = new Date(it.dataHora);
    const idade = agora.getTime() - ts.getTime();
    if (idade > idadeMax) { conta(descartadas, "posicao_antiga"); continue; }
    if (idade < -60_000) { conta(descartadas, "posicao_no_futuro"); continue; }
    const l: Leitura = {
      fonte: "brt", veiculo: it.codigo, linha: it.linha ?? null, sentido: it.sentido ?? null,
      lat: it.latitude, lng: it.longitude, velocidade: it.velocidade, ts,
      direcao: lerDirecao(it.direcao), trajeto: it.trajeto?.trim() || null,
      ignicao: it.ignicao == null || it.ignicao === "" ? null : Number(it.ignicao) === 1,
    };
    if (validaComum(l, descartadas)) leituras.push(l);
  }
  return { leituras, descartadas };
}

export function parseSppo(json: unknown): ResultadoParse {
  const descartadas: Record<string, number> = {};
  const leituras: Leitura[] = [];
  for (const bruto of z.array(z.unknown()).parse(json)) {
    const r = sppoItem.safeParse(bruto);
    if (!r.success) { conta(descartadas, "formato_invalido"); continue; }
    const it = r.data;
    if ((it.servico ?? "").trim().toUpperCase() === "FORA DE OP") { conta(descartadas, "fora_de_operacao"); continue; }
    const ts = new Date(it.datetime);
    if (Number.isNaN(ts.getTime())) { conta(descartadas, "formato_invalido"); continue; }
    const l: Leitura = {
      fonte: "sppo", veiculo: it.id_veiculo, linha: it.servico ?? null, sentido: it.sentido ?? null,
      lat: it.latitude, lng: it.longitude, velocidade: it.velocidade, ts,
      direcao: lerDirecao(it.direcao),
      routeId: it.route_id || null, tripId: it.trip_id || null, shapeId: it.shape_id || null,
      enviadoEm: it.datetime_envio ? new Date(it.datetime_envio) : null, recebidoEm: it.datetime_servidor ? new Date(it.datetime_servidor) : null,
    };
    if (validaComum(l, descartadas)) leituras.push(l);
  }
  return { leituras, descartadas };
}

/** O servidor do SPPO filtra por `datetime_servidor` em UTC (verificado em 02/10/2026). */
export function urlSppo(de: Date, ate: Date): string {
  const f = (d: Date) => d.toISOString().slice(0, 19).replace("T", "+");
  return `${URL_SPPO}?dataInicial=${f(de)}&dataFinal=${f(ate)}`;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "accept-encoding": "gzip" }, cache: "no-store", signal: AbortSignal.timeout(50_000) });
  if (!res.ok) throw new Error(`${url} respondeu HTTP ${res.status}`);
  return res.json();
}

export const buscarBrt = () => getJson(URL_BRT);
export const buscarSppo = (de: Date, ate: Date) => getJson(urlSppo(de, ate));
