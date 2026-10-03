/**
 * Programação oficial de frequência (GTFS da SMTR) → src/data/frequencias.json.
 * Fonte: https://dados.mobilidade.rio/gtfs/schedule — frequencies.txt (intervalo programado por faixa horária),
 * trips.txt (linha, sentido, destino, tipo de dia), calendar.txt / calendar_dates.txt (dia útil, sábado, domingo/feriado).
 * Isto é o PLANEJADO pela prefeitura (FONTE EXTERNA), não o que está rodando. O app compara com o GPS.
 * Chave da linha: "BRT:<código>" (route_type 702) ou "BUS:<código>" (demais).
 * Faixas: [inícioMin, fimMin, intervaloS] em minutos desde 00:00 do dia de serviço (podem passar de 1440 = madrugada).
 * Requer o comando `unzip` no sistema.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_GTFS = "https://dados.mobilidade.rio/gtfs/schedule";
const dir = mkdtempSync(join(tmpdir(), "gtfs-"));
const zip = join(dir, "g.zip");
writeFileSync(zip, Buffer.from(await (await fetch(URL_GTFS)).arrayBuffer()));
execFileSync("unzip", ["-o", "-q", zip, "routes.txt", "trips.txt", "frequencies.txt", "calendar.txt", "calendar_dates.txt", "feed_info.txt", "-d", dir]);

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
const min = (hms: string) => { const [h, m] = hms.split(":").map(Number); return h * 60 + m; };

const rotas = new Map(csv("routes.txt").map((r) => [r.route_id, r]));
const viagens = new Map(csv("trips.txt").map((t) => [t.trip_id, t]));
type Sentido = { sentido: number; destino: string; servicos: Record<string, [number, number, number][]> };
const linhas: Record<string, { nome: string; sentidos: Sentido[] }> = {};

for (const f of csv("frequencies.txt")) {
  const t = viagens.get(f.trip_id); if (!t) continue;
  const r = rotas.get(t.route_id); if (!r) continue;
  const chave = `${r.route_type === "702" ? "BRT" : "BUS"}:${r.route_short_name.toUpperCase()}`;
  const l = (linhas[chave] ??= { nome: r.route_long_name, sentidos: [] });
  const dirId = Number(t.direction_id || 0);
  let s = l.sentidos.find((x) => x.sentido === dirId);
  if (!s) l.sentidos.push((s = { sentido: dirId, destino: t.trip_headsign, servicos: {} }));
  (s.servicos[t.service_id] ??= []).push([min(f.start_time), min(f.end_time), Number(f.headway_secs)]);
}
for (const l of Object.values(linhas)) {
  l.sentidos.sort((a, b) => a.sentido - b.sentido);
  for (const s of l.sentidos) for (const k of Object.keys(s.servicos)) {
    // mesma faixa repetida por viagens diferentes (variantes de trajeto) → soma de partidas: intervalo combinado
    const m = new Map<string, number>();
    for (const [a, b, h] of s.servicos[k]) { const c = `${a}-${b}`; m.set(c, (m.get(c) ?? 0) + 3600 / h); }
    s.servicos[k] = [...m].map(([c, porHora]) => { const [a, b] = c.split("-").map(Number); return [a, b, Math.round(3600 / porHora)] as [number, number, number]; })
      .sort((x, y) => x[0] - y[0]);
  }
}

const dias: Record<string, string[]> = {};
for (const c of csv("calendar.txt")) {
  const ds = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d, i) => (c[d] === "1" ? i : -1)).filter((i) => i >= 0);
  dias[c.service_id] = ds.map(String);
}
const excecoes: Record<string, string> = {};
for (const c of csv("calendar_dates.txt")) if (c.exception_type === "1") excecoes[c.date] = c.service_id;
const feed = csv("feed_info.txt")[0] ?? {};

writeFileSync("src/data/frequencias.json", JSON.stringify({
  fonte: URL_GTFS, versaoGtfs: feed.feed_version ?? "", validoAte: feed.feed_end_date ?? "",
  nota: "Programação oficial (frequencies.txt). Faixas: [inícioMin, fimMin, intervaloS]. Dias da semana: 0 = segunda.",
  diasDoServico: dias, excecoes, linhas,
}));
console.log(`frequências: ${Object.keys(linhas).length} linhas`);
