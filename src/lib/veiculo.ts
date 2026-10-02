import type { Leitura } from "./fontes";
import { distanciaM } from "./geo";

/**
 * Normalização dos veículos para a interface:
 *   leitura bruta → normalizarVeiculo() → { posição, rumo, velocidade, linha, estado }
 * Toda regra de rumo fica aqui, não espalhada pela tela.
 */
export interface VeiculoNormalizado {
  id: string;
  fonte: "brt" | "sppo";
  veiculo: string;
  linha: string | null;
  /** Destino legível a partir do trajeto do BRT (ex.: "Jardim Oceânico"); null quando a fonte não informa. */
  destino: string | null;
  sentido: string | null;
  lat: number;
  lng: number;
  /** Graus (0 = norte, horário). null = sem direção confiável → marcador neutro. */
  rumo: number | null;
  /** De onde veio o rumo: GPS da fonte, deslocamento entre leituras, ou mantido da última leitura em movimento. */
  rumoOrigem: "gps" | "deslocamento" | "anterior" | null;
  velocidadeKmh: number;
  parado: boolean;
  em: Date;
  idadeS: number;
  /** BRT: ignição desligada informada pela fonte (true), ligada (false) ou desconhecida (null). */
  ignicaoDesligada: boolean | null;
}

/** EXPERIMENTAL / ESCOLHA DO SISTEMA — abaixo disso o veículo é tratado como parado (km/h). */
export const PARADO_ABAIXO_KMH = 3;
/** EXPERIMENTAL / ESCOLHA DO SISTEMA — deslocamento mínimo para calcular rumo pelas posições (m). */
export const DESLOCAMENTO_MIN_RUMO_M = 30;
/** EXPERIMENTAL / ESCOLHA DO SISTEMA — idade máxima da leitura anterior usada no cálculo (min). */
export const JANELA_RUMO_MIN = 5;

export function rumoEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Destino a partir do trajeto do BRT. A fonte já escreve o trajeto na ordem da viagem
 * (verificado em 02/10/2026: "10 - SANTA CRUZ X ALVORADA [IDA]" e "10 - ALVORADA X SANTA CRUZ [VOLTA]",
 * com o rumo do GPS batendo com o último nome), então o destino é sempre o último trecho.
 * `sentido` fica só como confirmação: sem "[IDA]/[VOLTA]" nem sentido, não arriscamos.
 */
export function destinoDoTrajeto(trajeto: string | null | undefined, sentido: string | null | undefined): string | null {
  if (!trajeto) return null;
  if (!/\[(IDA|VOLTA)\]/i.test(trajeto) && !(sentido ?? "").trim()) return null;
  const miolo = trajeto.replace(/^[^-]*-\s*/, "").replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").trim();
  const partes = miolo.split(/\s+X\s+/i).map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) return null;
  return partes[partes.length - 1].toLowerCase().replace(/(^|\s|\/)(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
}

/**
 * @param atual última leitura do veículo
 * @param historico leituras anteriores do MESMO veículo (qualquer ordem), para deslocamento e último rumo válido
 */
export function normalizarVeiculo(atual: Leitura, historico: Leitura[], agora: Date): VeiculoNormalizado {
  const parado = atual.velocidade < PARADO_ABAIXO_KMH;
  const anteriores = historico
    .filter((h) => h.ts < atual.ts && atual.ts.getTime() - h.ts.getTime() <= JANELA_RUMO_MIN * 60_000)
    .sort((a, b) => b.ts.getTime() - a.ts.getTime());

  let rumo: number | null = null;
  let rumoOrigem: VeiculoNormalizado["rumoOrigem"] = null;
  if (!parado && atual.direcao != null) { rumo = atual.direcao; rumoOrigem = "gps"; }
  else if (!parado) {
    const ref = anteriores.find((h) => distanciaM(h.lat, h.lng, atual.lat, atual.lng) >= DESLOCAMENTO_MIN_RUMO_M);
    if (ref) { rumo = rumoEntre(ref, atual); rumoOrigem = "deslocamento"; }
  }
  if (rumo === null) {
    // Parado (ou sem dado): mantém o último rumo válido em movimento, se houver — nunca inventa.
    const ultimo = anteriores.find((h) => h.velocidade >= PARADO_ABAIXO_KMH && h.direcao != null);
    if (ultimo) { rumo = ultimo.direcao!; rumoOrigem = "anterior"; }
    // Parado, sem histórico em movimento, mas a fonte informa o rumo: usa o informado (não gira à toa).
    else if (atual.direcao != null) { rumo = atual.direcao; rumoOrigem = "gps"; }
  }

  return {
    id: `${atual.fonte}:${atual.veiculo}`, fonte: atual.fonte, veiculo: atual.veiculo, linha: atual.linha,
    destino: destinoDoTrajeto(atual.trajeto, atual.sentido), sentido: atual.sentido || null,
    lat: atual.lat, lng: atual.lng, rumo: rumo === null ? null : Math.round(rumo), rumoOrigem,
    velocidadeKmh: Math.round(atual.velocidade), parado, em: atual.ts,
    idadeS: Math.max(0, Math.round((agora.getTime() - atual.ts.getTime()) / 1000)),
    ignicaoDesligada: atual.ignicao == null ? null : !atual.ignicao,
  };
}

/** Agrupa por veículo e normaliza a leitura mais recente de cada um. */
export function normalizarFrota(ls: Leitura[], agora: Date): VeiculoNormalizado[] {
  const por = new Map<string, Leitura[]>();
  for (const l of ls) { const k = `${l.fonte}|${l.veiculo}`; (por.get(k) ?? por.set(k, []).get(k)!).push(l); }
  return [...por.values()].map((arr) => {
    const atual = arr.reduce((a, b) => (b.ts > a.ts ? b : a));
    return normalizarVeiculo(atual, arr, agora);
  });
}

/** Menor diferença angular com sinal, em graus: 359 → 1 = +2 (nunca +358 ou −358). */
export const deltaAngulo = (de: number, para: number) => ((((para - de) % 360) + 540) % 360) - 180;
