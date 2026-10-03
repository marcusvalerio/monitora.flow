/**
 * GTFS-Realtime (VehiclePositions) da SMTR — FONTE EXTERNA: https://dados.mobilidade.rio/gtfs/realtime (protobuf).
 * Decodificador mínimo do formato protobuf só com os campos que usamos (sem dependência nova).
 * Nunca lemos/guardamos license_plate (VehicleDescriptor campo 3).
 */
export const URL_GTFS_RT = "https://dados.mobilidade.rio/gtfs/realtime";

type Campo = { n: number; t: number; v: number | bigint | Uint8Array };

function lerVarint(b: Uint8Array, i: number): [bigint, number] {
  let r = 0n, s = 0n;
  for (;;) { const x = b[i++]; r |= BigInt(x & 0x7f) << s; if (!(x & 0x80)) return [r, i]; s += 7n; }
}
function campos(b: Uint8Array): Campo[] {
  const out: Campo[] = []; const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 0;
  while (i < b.length) {
    const [chave, j] = lerVarint(b, i); i = j;
    const n = Number(chave >> 3n), t = Number(chave & 7n);
    if (t === 0) { const [v, k] = lerVarint(b, i); i = k; out.push({ n, t, v }); }
    else if (t === 1) { out.push({ n, t, v: dv.getFloat64(i, true) }); i += 8; }
    else if (t === 5) { out.push({ n, t, v: dv.getFloat32(i, true) }); i += 4; }
    else if (t === 2) { const [len, k] = lerVarint(b, i); i = k; out.push({ n, t, v: b.subarray(i, i + Number(len)) }); i += Number(len); }
    else throw new Error(`protobuf: tipo ${t} não suportado`);
  }
  return out;
}
const txt = (v: Campo["v"] | undefined) => (v instanceof Uint8Array ? new TextDecoder().decode(v) : null);
const num = (v: Campo["v"] | undefined) => (v == null || v instanceof Uint8Array ? null : Number(v));
const um = (cs: Campo[], n: number) => cs.find((c) => c.n === n)?.v;

export interface PosicaoRT {
  veiculo: string;              // VehicleDescriptor.id (ou label)
  tripId: string | null; routeId: string | null; directionId: number | null; startTime: string | null; startDate: string | null;
  lat: number | null; lng: number | null; rumo: number | null; velocidadeMs: number | null; odometroM: number | null;
  sequenciaParada: number | null; stopId: string | null; em: Date | null;
}

export function decodificarVehiclePositions(buf: Uint8Array): { em: Date | null; posicoes: PosicaoRT[] } {
  const msg = campos(buf);
  const header = um(msg, 1);
  const ts = header instanceof Uint8Array ? num(um(campos(header), 3)) : null;
  const posicoes: PosicaoRT[] = [];
  for (const e of msg.filter((c) => c.n === 2)) {
    const ent = campos(e.v as Uint8Array);
    const vp = um(ent, 4); if (!(vp instanceof Uint8Array)) continue;
    const v = campos(vp);
    const trip = um(v, 1), pos = um(v, 2), desc = um(v, 8);
    const t = trip instanceof Uint8Array ? campos(trip) : [];
    const p = pos instanceof Uint8Array ? campos(pos) : [];
    const d = desc instanceof Uint8Array ? campos(desc) : [];
    const veiculo = txt(um(d, 1)) ?? txt(um(d, 2)) ?? txt(um(ent, 1));
    if (!veiculo) continue;
    const vts = num(um(v, 5));
    posicoes.push({
      veiculo, tripId: txt(um(t, 1)), startTime: txt(um(t, 2)), startDate: txt(um(t, 3)), routeId: txt(um(t, 5)),
      directionId: num(um(t, 6)),
      lat: num(um(p, 1)), lng: num(um(p, 2)), rumo: num(um(p, 3)), odometroM: num(um(p, 4)), velocidadeMs: num(um(p, 5)),
      sequenciaParada: num(um(v, 3)), stopId: txt(um(v, 7)), em: vts ? new Date(vts * 1000) : null,
    });
  }
  return { em: ts ? new Date(ts * 1000) : null, posicoes };
}

let cache: { t: number; dados: { em: Date | null; posicoes: PosicaoRT[] } } | null = null;
/** Lê o feed (cache de 15 s por instância). Falha → null (o app segue com o casamento por destino). */
export async function lerGtfsRt(): Promise<{ em: Date | null; posicoes: PosicaoRT[] } | null> {
  if (cache && Date.now() - cache.t < 15_000) return cache.dados;
  try {
    const r = await fetch(URL_GTFS_RT, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return cache?.dados ?? null;
    const dados = decodificarVehiclePositions(new Uint8Array(await r.arrayBuffer()));
    cache = { t: Date.now(), dados };
    return dados;
  } catch { return cache?.dados ?? null; }
}
