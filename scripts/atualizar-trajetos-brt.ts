/**
 * Trajetos oficiais das linhas de BRT (GTFS da SMTR) → src/data/trajetos-brt.json.
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

const dir = mkdtempSync(join(tmpdir(), "gtfs-"));
const zip = join(dir, "g.zip");
writeFileSync(zip, Buffer.from(await (await fetch(URL_GTFS)).arrayBuffer()));
execFileSync("unzip", ["-o", "-q", zip, "routes.txt", "trips.txt", "shapes.txt", "feed_info.txt", "-d", dir]);

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

const rotas = new Map(csv("routes.txt").filter((r) => r.route_type === "702").map((r) => [r.route_id, r]));
const usos = new Map<string, { linha: string; sentido: number; destino: string; viagens: number }>();
for (const t of csv("trips.txt")) {
  const r = rotas.get(t.route_id);
  if (!r || !t.shape_id) continue;
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
const linhas: Record<string, { sentido: number; destino: string; viagens: number; coords: [number, number][] }[]> = {};
for (const [id, u] of usos) {
  const p = (pts.get(id) ?? []).sort((a, b) => a[0] - b[0]).map(([, lng, lat]) => [lng, lat] as [number, number]);
  if (p.length < 2) continue;
  (linhas[u.linha] ??= []).push({ sentido: u.sentido, destino: u.destino, viagens: u.viagens, coords: simplifica(p, SIMPLIFICA_M).map(([a, b]) => [r6(a), r6(b)]) });
}
for (const l of Object.values(linhas)) l.sort((a, b) => b.viagens - a.viagens);

const feed = csv("feed_info.txt")[0] ?? {};
writeFileSync("src/data/trajetos-brt.json", JSON.stringify({
  fonte: URL_GTFS, versaoGtfs: feed.feed_version ?? null, validoDe: feed.feed_start_date ?? null, validoAte: feed.feed_end_date ?? null,
  baixadoEm: new Date().toISOString().slice(0, 10), linhas,
}));
console.log(`${Object.keys(linhas).length} linhas de BRT, ${Object.values(linhas).flat().length} trajetos`);
