/**
 * Catálogo oficial do BRT (GTFS da SMTR) → src/data/brt-catalogo.json. Fonte única de verdade para:
 *   - quais linhas são BRT (routes.route_type = 702; o mesmo operador também tem alimentadores route_type 700, que NÃO são BRT);
 *   - sentidos (direction_id + trip_headsign) e trajetos (shapes) de cada linha;
 *   - quais linhas param em cada estação/terminal do catálogo de estações (stop_times das viagens 702, parada a até PARADA_ESTACAO_M).
 * Fonte: https://dados.mobilidade.rio/gtfs/schedule (zip GTFS; BRT = route_type 702).
 * Para cada linha guarda os shapes distintos usados pelas viagens, com sentido (direction_id) e destino (trip_headsign).
 * Pontos simplificados (Douglas-Peucker, tolerância SIMPLIFICA_M) para caber no app.
 * Requer o comando `unzip` no sistema.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_GTFS = "https://dados.mobilidade.rio/gtfs/schedule";
const SIMPLIFICA_M = 4; // EXPERIMENTAL / ESCOLHA DO SISTEMA
const PARADA_ESTACAO_M = 250; // parada GTFS a até 250 m do centroide da estação = mesma estação (EXPERIMENTAL / ESCOLHA DO SISTEMA)

const dir = mkdtempSync(join(tmpdir(), "gtfs-"));
const zip = join(dir, "g.zip");
writeFileSync(zip, Buffer.from(await (await fetch(URL_GTFS)).arrayBuffer()));
execFileSync("unzip", ["-o", "-q", zip, "routes.txt", "trips.txt", "shapes.txt", "stops.txt", "stop_times.txt", "feed_info.txt", "-d", dir]);

function csv(nome: string): Record<string, string>[] {
  const [cab, ...linhas] = readFileSync(join(dir, nome), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const campos = cab.split(",");
  return linhas.map((l) => {
    // campos com vírgula vêm entre aspas
    const vals: string[] = []; let cur = "", q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { vals.push(cur); cur = ""; } else cur += ch; }
    vals.push(cur);
    return Object.fromEntries(campos.map((c, i) => [c, vals[i] ?? ""]));
  });
}

const todasRotas = csv("routes.txt");
const rotas = new Map(todasRotas.filter((r) => r.route_type === "702").map((r) => [r.route_id, r]));
// Outras linhas do MESMO operador do BRT (aparecem no GPS do BRT, mas no GTFS são ônibus: alimentadores, route_type 700, etc.)
const operadoresBrt = new Set([...rotas.values()].map((r) => r.agency_id));
const outrasDoOperador: Record<string, { routeType: string; nome: string }> = {};
for (const r of todasRotas) if (operadoresBrt.has(r.agency_id) && r.route_type !== "702") outrasDoOperador[r.route_short_name.toUpperCase()] = { routeType: r.route_type, nome: r.route_long_name };
const usos = new Map<string, { linha: string; sentido: number; destino: string; viagens: number }>();
const viagemLinha = new Map<string, string>();
for (const t of csv("trips.txt")) {
  const r = rotas.get(t.route_id);
  if (!r) continue;
  viagemLinha.set(t.trip_id, r.route_short_name.toUpperCase());
  if (!t.shape_id) continue;
  const u = usos.get(t.shape_id) ?? { linha: r.route_short_name.toUpperCase(), sentido: Number(t.direction_id), destino: t.trip_headsign, viagens: 0 };
  u.viagens++;
  usos.set(t.shape_id, u);
}

const pts = new Map<string, [number, number, number][]>();
for (const s of csv("shapes.txt")) {
  if (!usos.has(s.shape_id)) continue;
  const a = pts.get(s.shape_id) ?? [];
  a.push([Number(s.shape_pt_sequence), Number(s.shape_pt_lon), Number(s.shape_pt_lat)]);
  pts.set(s.shape_id, a);
}

// Douglas-Peucker em metros (projeção equiretangular local)
function simplifica(p: [number, number][], tol: number): [number, number][] {
  if (p.length < 3) return p;
  const k = Math.cos((p[0][1] * Math.PI) / 180) * 111320, m = 110540;
  const xy = p.map(([lng, lat]) => [lng * k, lat * m]);
  const manter = new Uint8Array(p.length); manter[0] = manter[p.length - 1] = 1;
  const pilha: [number, number][] = [[0, p.length - 1]];
  while (pilha.length) {
    const [i, j] = pilha.pop()!;
    const [ax, ay] = xy[i], [bx, by] = xy[j];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    let maxD = 0, idx = -1;
    for (let n = i + 1; n < j; n++) {
      const t = Math.max(0, Math.min(1, ((xy[n][0] - ax) * dx + (xy[n][1] - ay) * dy) / L));
      const d = Math.hypot(xy[n][0] - ax - t * dx, xy[n][1] - ay - t * dy);
      if (d > maxD) { maxD = d; idx = n; }
    }
    if (maxD > tol) { manter[idx] = 1; pilha.push([i, idx], [idx, j]); }
  }
  return p.filter((_, i) => manter[i]);
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
type Tr = { shapeId: string; sentido: number; destino: string; viagens: number; coords: [number, number][] };
const linhas: Record<string, { routeId: string; nome: string; servico: string | null; trajetos: Tr[] }> = {};
for (const r of rotas.values()) linhas[r.route_short_name.toUpperCase()] = { routeId: r.route_id, nome: r.route_long_name, servico: r.route_desc || null, trajetos: [] };
for (const [id, u] of usos) {
  const p = (pts.get(id) ?? []).sort((a, b) => a[0] - b[0]).map(([, lng, lat]) => [lng, lat] as [number, number]);
  if (p.length < 2) continue;
  linhas[u.linha].trajetos.push({ shapeId: id, sentido: u.sentido, destino: u.destino, viagens: u.viagens, coords: simplifica(p, SIMPLIFICA_M).map(([a, b]) => [r6(a), r6(b)]) });
}
for (const l of Object.values(linhas)) l.trajetos.sort((a, b) => b.viagens - a.viagens);

// linhas que param em cada estação do catálogo (stop_times das viagens BRT)
const paradas = new Map(csv("stops.txt").map((s) => [s.stop_id, { lat: Number(s.stop_lat), lng: Number(s.stop_lon) }]));
const linhasDaParada = new Map<string, Set<string>>();
for (const linhaTxt of readFileSync(join(dir, "stop_times.txt"), "utf8").split(/\r?\n/)) {
  const [trip, , stop] = linhaTxt.split(",");
  const l = viagemLinha.get(trip);
  if (!l || !stop) continue;
  (linhasDaParada.get(stop) ?? linhasDaParada.set(stop, new Set()).get(stop)!).add(l);
}
const estacoes = (JSON.parse(readFileSync("src/data/estacoes-brt.json", "utf8")) as { estacoes: { id: string; lat: number; lng: number }[] }).estacoes;
const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180) * 111320, (a.lat - b.lat) * 110540);
const linhasPorEstacao: Record<string, string[]> = {};
for (const e of estacoes) {
  const set = new Set<string>();
  for (const [stop, ls] of linhasDaParada) { const p = paradas.get(stop); if (p && dist(e, p) <= PARADA_ESTACAO_M) ls.forEach((l) => set.add(l)); }
  if (set.size) linhasPorEstacao[e.id] = [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

const feed = csv("feed_info.txt")[0] ?? {};
writeFileSync("src/data/brt-catalogo.json", JSON.stringify({
  fonte: URL_GTFS, criterio: "routes.route_type = 702 (BRT)", versaoGtfs: feed.feed_version ?? null, validoDe: feed.feed_start_date ?? null, validoAte: feed.feed_end_date ?? null,
  baixadoEm: new Date().toISOString().slice(0, 10), linhas, linhasPorEstacao, outrasDoOperador,
}));
console.log(`${Object.keys(linhas).length} linhas de BRT, ${Object.values(linhas).reduce((n, l) => n + l.trajetos.length, 0)} trajetos, ${Object.keys(linhasPorEstacao).length} estações com linhas`);
