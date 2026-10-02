/**
 * Baixa a camada aberta de paradas/estações e a de bairros da Prefeitura e grava src/data/paradas.json:
 *  - cada parada recebe o bairro (ponto-no-polígono);
 *  - paradas com o mesmo nome, no mesmo bairro e a até AGRUPAR_M metros viram uma entrada só
 *    (EXPERIMENTAL / ESCOLHA DO SISTEMA: a camada traz a mesma parada repetida, um ponto por lado da rua/plataforma).
 * Fontes:
 *  https://raw.githubusercontent.com/prefeitura-rio/storage/master/layers/paradas_onibus.geojson
 *  https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Cartografia/Limites_administrativos/MapServer/4 (Limite de Bairros)
 */
import { writeFileSync } from "node:fs";
import { distanciaM } from "../src/lib/geo";
import { normalizar } from "../src/lib/normalizar";

const URL_PARADAS = "https://raw.githubusercontent.com/prefeitura-rio/storage/master/layers/paradas_onibus.geojson";
const URL_BAIRROS = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Cartografia/Limites_administrativos/MapServer/4/query?where=1%3D1&outFields=nome&returnGeometry=true&outSR=4326&f=geojson&geometryPrecision=5";
const AGRUPAR_M = 400;

type Anel = [number, number][];
const pj = (await (await fetch(URL_PARADAS)).json()) as { features: { properties: { id_parada: string | number; nome_parada: string; data_versao?: string }; geometry: { coordinates: [number, number] } }[] };
const bj = (await (await fetch(URL_BAIRROS)).json()) as { features: { properties: { nome: string }; geometry: { type: string; coordinates: Anel[] | Anel[][] } }[] };

const bairros = bj.features.map((f) => ({
  nome: f.properties.nome.trim(),
  poligonos: (f.geometry.type === "Polygon" ? [f.geometry.coordinates as Anel[]] : (f.geometry.coordinates as Anel[][])),
}));

// Ray casting; o primeiro anel é o contorno, os demais são buracos.
const dentroAnel = (x: number, y: number, a: Anel) => {
  let d = false;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [xi, yi] = a[i], [xj, yj] = a[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
};
const bairroDe = (lng: number, lat: number) =>
  bairros.find((b) => b.poligonos.some(([ext, ...buracos]) => dentroAnel(lng, lat, ext) && !buracos.some((h) => dentroAnel(lng, lat, h))))?.nome ?? null;

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const brutas = pj.features
  .filter((f) => f.geometry?.coordinates && f.properties?.nome_parada)
  .map((f) => ({
    id: String(f.properties.id_parada), nome: f.properties.nome_parada.trim().replace(/\s+/g, " "),
    lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
    bairro: bairroDe(f.geometry.coordinates[0], f.geometry.coordinates[1]),
  }));

// Agrupa por (nome normalizado, bairro) e, dentro disso, por proximidade (ligação simples ≤ AGRUPAR_M).
const grupos = new Map<string, typeof brutas>();
for (const p of brutas) {
  const k = `${normalizar(p.nome)}|${p.bairro}`;
  (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(p);
}
const paradas: { id: string; ids: string[]; nome: string; bairro: string | null; lat: number; lng: number }[] = [];
for (const lista of grupos.values()) {
  const resto = [...lista];
  while (resto.length) {
    const cl = [resto.shift()!];
    for (let i = 0; i < cl.length; i++)
      for (let j = resto.length - 1; j >= 0; j--)
        if (distanciaM(cl[i].lat, cl[i].lng, resto[j].lat, resto[j].lng) <= AGRUPAR_M) cl.push(...resto.splice(j, 1));
    paradas.push({
      id: cl[0].id, ids: cl.map((c) => c.id), nome: cl[0].nome, bairro: cl[0].bairro,
      lat: r6(cl.reduce((s, c) => s + c.lat, 0) / cl.length), lng: r6(cl.reduce((s, c) => s + c.lng, 0) / cl.length),
    });
  }
}
// Para nomes que ainda se repetem no mesmo bairro, guarda o logradouro mais próximo (geocodificador reverso do IPP).
const URL_REVERSO = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geocode/Geocode_Logradouros_WGS84/GeocodeServer/reverseGeocode";
const contagem = new Map<string, number>();
for (const p of paradas) contagem.set(`${normalizar(p.nome)}|${p.bairro}`, (contagem.get(`${normalizar(p.nome)}|${p.bairro}`) ?? 0) + 1);
const ambiguas = paradas.filter((p) => (contagem.get(`${normalizar(p.nome)}|${p.bairro}`) ?? 0) > 1) as (typeof paradas[number] & { rua?: string })[];
for (let i = 0; i < ambiguas.length; i += 8) {
  await Promise.all(ambiguas.slice(i, i + 8).map(async (p) => {
    try {
      const r = (await (await fetch(`${URL_REVERSO}?location=${p.lng},${p.lat}&f=json&outSR=4326`, { signal: AbortSignal.timeout(15_000) })).json()) as { address?: { ShortLabel?: string } };
      const rua = r.address?.ShortLabel?.trim();
      if (rua && !/^sem nome/i.test(rua)) p.rua = rua.replace(/^[\d-]+\s+/, "");
    } catch { /* sem rua: fica só o bairro */ }
  }));
}

const versao = pj.features.find((f) => f.properties.data_versao)?.properties.data_versao ?? null;
writeFileSync("src/data/paradas.json", JSON.stringify({ fonte: URL_PARADAS, fonteBairros: URL_BAIRROS.split("/query")[0], versao, baixadoEm: new Date().toISOString().slice(0, 10), agruparM: AGRUPAR_M, paradas }));
console.log(brutas.length, "pontos →", paradas.length, "paradas; sem bairro:", paradas.filter((p) => !p.bairro).length, "; ambíguas:", ambiguas.length, "com rua:", ambiguas.filter((p) => p.rua).length);
