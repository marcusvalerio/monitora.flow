import { describe, expect, it } from "vitest";
import { decodificarVehiclePositions } from "../src/lib/gtfsrt";
import { viagemBrt } from "../src/lib/viagensBrt";

// codificador protobuf mínimo para montar uma mensagem de teste
const varint = (n: number) => { const o: number[] = []; do { let b = n & 0x7f; n = Math.floor(n / 128); if (n) b |= 0x80; o.push(b); } while (n); return o; };
const tag = (f: number, t: number) => varint((f << 3) | t);
const str = (f: number, s: string) => { const b = [...new TextEncoder().encode(s)]; return [...tag(f, 2), ...varint(b.length), ...b]; };
const msg = (f: number, b: number[]) => [...tag(f, 2), ...varint(b.length), ...b];
const f32 = (f: number, x: number) => { const a = new Uint8Array(4); new DataView(a.buffer).setFloat32(0, x, true); return [...tag(f, 5), ...a]; };
const uint = (f: number, n: number) => [...tag(f, 0), ...varint(n)];

describe("GTFS-Realtime (VehiclePositions)", () => {
  it("decodifica viagem, posição e veículo — e ignora a placa", () => {
    const trip = [...str(1, "trip-1"), ...str(2, "01:00:00"), ...str(3, "20261003"), ...str(5, "R1"), ...uint(6, 1)];
    const pos = [...f32(1, -22.95), ...f32(2, -43.35), ...f32(3, 90)];
    const veic = [...str(1, "901010"), ...str(3, "ABC1D23")];
    const vp = [...msg(1, trip), ...msg(2, pos), ...uint(5, 1790998236), ...msg(8, veic)];
    const feed = new Uint8Array([...msg(1, [...str(1, "2.0"), ...uint(3, 1790998240)]), ...msg(2, [...str(1, "e1"), ...msg(4, vp)])]);
    const d = decodificarVehiclePositions(feed);
    expect(d.posicoes).toHaveLength(1);
    const p = d.posicoes[0];
    expect(p).toMatchObject({ veiculo: "901010", tripId: "trip-1", startTime: "01:00:00", routeId: "R1", directionId: 1 });
    expect(p.lat).toBeCloseTo(-22.95, 4);
    expect(JSON.stringify(p)).not.toContain("ABC1D23");
  });
  it("trip_id desconhecido → sem viagem (não inventa)", () => {
    expect(viagemBrt("nao-existe")).toBeNull();
  });
});
