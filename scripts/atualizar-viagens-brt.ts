/**
 * Viagens do BRT (GTFS da SMTR) → src/data/brt-viagens.json, para usar com o GTFS-Realtime (trip_id de cada veículo).
 * Para cada trip_id: shape, sentido e o PADRÃO de paradas (sequência oficial de stop_times com o tempo programado
 * desde a primeira parada). Padrões iguais são compartilhados (viagens por frequência repetem o mesmo padrão).
 * Cada parada é ligada à estação do catálogo (src/data/estacoes-brt.json) mais próxima a até 250 m; senão fica só o nome.
 * Requer o comando `unzip`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_GTFS = "https://dados.mobilidade.rio/gtfs/schedule";
const ESTACAO_M = 250; // EXPERIMENTAL / ESCOLHA DO SISTEMA
const dir = mkdtempSync(join(tmpdir(), "gtfs-"));
const zip = join(dir, "g.zip");
writeFileSync(zip, Buffer.from(await (await fetch(URL_GTFS)).arrayBuffer()));
execFileSync("unzip", ["-o", "-q", zip, "routes.txt", "trips.txt", "stops.txt", "stop_times.txt", "feed_info.txt", "-d", dir]);

function csv(nome: string): Record<string, string>[] {
  const [cab, ...linhas] = readFileSync(join(dir, nome), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const campos = cab.split(",");
  return linhas.map((l) => {
    const vals: string[] = []; let cur = "", q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { vals.push(cur); cur = ""; } else cur += ch; }
    vals.push(cur);
    return Object.fromEntries(campos.map((c, i) => [c, vals[i] ?? ""]));
  });
}
const seg = (hms: string) => { const [h, m, s] = hms.split(":").map(Number); return h * 3600 + m * 60 + (s || 0); };

const rotasBrt = new Map(csv("routes.txt").filter((r) => r.route_type === "702").map((r) => [r.route_id, r.route_short_name.toUpperCase()]));
const viagens = new Map(csv("trips.txt").filter((t) => rotasBrt.has(t.route_id)).map((t) => [t.trip_id, t]));
const stops = new Map(csv("stops.txt").map((s) => [s.stop_id, { nome: s.stop_name, lat: Number(s.stop_lat), lng: Number(s.stop_lon) }]));
const estacoes = (JSON.parse(readFileSync("src/data/estacoes-brt.json", "utf8")) as { estacoes: { id: string; nome: string; lat: number; lng: number }[] }).estacoes;
const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180) * 111320, (a.lat - b.lat) * 110540);
const estacaoDe = new Map<string, string | null>();
const estacaoDaParada = (stopId: string) => {
  if (estacaoDe.has(stopId)) return estacaoDe.get(stopId)!;
  const p = stops.get(stopId); let melhor: string | null = null, d0 = ESTACAO_M;
  if (p) for (const e of estacoes) { const d = dist(e, p); if (d <= d0) { d0 = d; melhor = e.id; } }
  estacaoDe.set(stopId, melhor); return melhor;
};

const seq = new Map<string, [number, string, number][]>(); // trip → [stop_sequence, stop_id, tempo]
for (const linha of readFileSync(join(dir, "stop_times.txt"), "utf8").split(/\r?\n/)) {
  const c = linha.split(",");
  if (!viagens.has(c[0])) continue;
  const t = c[3] || c[4]; if (!t) continue;
  (seq.get(c[0]) ?? seq.set(c[0], []).get(c[0])!).push([Number(c[1]), c[2], seg(t)]);
}

const padroes: [string, string | null, number][][] = []; // [nome da parada, id da estação | null, segundos desde a 1ª parada]
const indice = new Map<string, number>();
const trips: Record<string, [string, string, number, number]> = {}; // trip → [linha, shapeId, sentido, padrão]
for (const [trip, ps] of seq) {
  ps.sort((a, b) => a[0] - b[0]);
  const t0 = ps[0][2];
  const padrao = ps.map(([, stop, t]) => [stops.get(stop)?.nome ?? stop, estacaoDaParada(stop), t - t0] as [string, string | null, number]);
  const k = JSON.stringify(padrao);
  if (!indice.has(k)) { indice.set(k, padroes.length); padroes.push(padrao); }
  const v = viagens.get(trip)!;
  trips[trip] = [rotasBrt.get(v.route_id)!, v.shape_id, Number(v.direction_id || 0), indice.get(k)!];
}
const feed = csv("feed_info.txt")[0] ?? {};
writeFileSync("src/data/brt-viagens.json", JSON.stringify({
  fonte: URL_GTFS, versaoGtfs: feed.feed_version ?? null, validoAte: feed.feed_end_date ?? null,
  nota: "trips: trip_id → [linha, shape_id, direction_id, padrão]. padroes: [nome da parada, estação do catálogo | null, s desde a 1ª parada].",
  trips, padroes,
}));
console.log(`${Object.keys(trips).length} viagens BRT, ${padroes.length} padrões de paradas`);
