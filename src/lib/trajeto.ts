/**
 * Encaixe da posição do veículo no trajeto oficial (só para EXIBIÇÃO no mapa — o dado observado continua o do GPS).
 * EXPERIMENTAL / ESCOLHA DO SISTEMA: só encaixa se o GPS estiver a até ENCAIXE_MAX_M do trajeto; senão mostra o GPS cru.
 */
export const ENCAIXE_MAX_M = 60;
/**
 * Veículo PARADO a mais que isto do trajeto da linha é tratado como fora de operação (garagem/pátio) e some do mapa.
 * EXPERIMENTAL / ESCOLHA DO SISTEMA. Verificado em 02/10/2026: vários BRT da linha 10 parados, quase todos de ignição desligada,
 * no mesmo ponto a ~2,7 km do corredor, ainda marcados com a linha.
 */
export const FORA_TRAJETO_M = 300;

/** Menor distância (m) do ponto a qualquer trajeto da linha; null se a linha não tem trajeto. */
export function distanciaAoTrajeto(lat: number, lng: number, trajetos: { coords: Coords }[]): number | null {
  let min: number | null = null;
  for (const t of trajetos) { const e = projetar(lat, lng, t.coords); if (e && (min === null || e.distM < min)) min = e.distM; }
  return min;
}

export type Coords = [number, number][]; // [lng, lat]
export interface Trajeto { sentido: number; destino: string; coords: Coords; shapeId?: string }
export interface Encaixe { lat: number; lng: number; s: number; distM: number; indice: number }

const K_LAT = 110540;
const kLng = (lat: number) => Math.cos((lat * Math.PI) / 180) * 111320;

/** Comprimento acumulado (m) de cada vértice. */
export function acumulado(c: Coords): number[] {
  const a = [0];
  for (let i = 1; i < c.length; i++) {
    const k = kLng(c[i][1]);
    a.push(a[i - 1] + Math.hypot((c[i][0] - c[i - 1][0]) * k, (c[i][1] - c[i - 1][1]) * K_LAT));
  }
  return a;
}

/** Ponto do trajeto mais próximo de (lat, lng), com a distância percorrida ao longo dele (s). */
export function projetar(lat: number, lng: number, c: Coords, acc = acumulado(c)): Encaixe | null {
  if (c.length < 2) return null;
  const k = kLng(lat);
  let melhor: Encaixe | null = null;
  for (let i = 0; i < c.length - 1; i++) {
    const ax = c[i][0] * k, ay = c[i][1] * K_LAT, bx = c[i + 1][0] * k, by = c[i + 1][1] * K_LAT;
    const px = lng * k, py = lat * K_LAT, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
    if (!melhor || d < melhor.distM) {
      melhor = { lng: c[i][0] + t * (c[i + 1][0] - c[i][0]), lat: c[i][1] + t * (c[i + 1][1] - c[i][1]), s: acc[i] + t * (acc[i + 1] - acc[i]), distM: d, indice: i };
    }
  }
  return melhor;
}

/** Ponto a s metros do início do trajeto. */
export function pontoEm(c: Coords, s: number, acc = acumulado(c)): { lat: number; lng: number } {
  if (s <= 0) return { lng: c[0][0], lat: c[0][1] };
  for (let i = 1; i < c.length; i++) {
    if (acc[i] >= s) {
      const t = (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
      return { lng: c[i - 1][0] + t * (c[i][0] - c[i - 1][0]), lat: c[i - 1][1] + t * (c[i][1] - c[i - 1][1]) };
    }
  }
  const u = c[c.length - 1];
  return { lng: u[0], lat: u[1] };
}

/** "Terminal Alvorada" ~ "Alvorada", "Estação Santa Cruz" ~ "Santa Cruz" (ignora acento, caixa e "terminal/estação"). */
export function mesmoDestino(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\b(terminal|estacao)\b/g, "").trim();

/**
 * Escolhe o trajeto e encaixa. Prefere trajetos cujo destino bate com o destino do veículo;
 * se nenhum bater (ou destino desconhecido), usa o mais próximo entre todos.
 */
export function encaixar(lat: number, lng: number, destino: string | null, trajetos: (Trajeto & { acc?: number[] })[]): (Encaixe & { trajeto: number }) | null {
  if (!trajetos.length) return null;
  const d = destino ? norm(destino) : "";
  const idx = trajetos.map((_, i) => i);
  const candidatos = d ? idx.filter((i) => mesmoDestino(trajetos[i].destino, destino)) : [];
  let melhor: (Encaixe & { trajeto: number }) | null = null;
  for (const i of candidatos.length ? candidatos : idx) {
    const e = projetar(lat, lng, trajetos[i].coords, trajetos[i].acc);
    if (e && (!melhor || e.distM < melhor.distM)) melhor = { ...e, trajeto: i };
  }
  return melhor && melhor.distM <= ENCAIXE_MAX_M ? melhor : null;
}
