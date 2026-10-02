/**
 * Catálogo oficial de estações e terminais do BRT (Data.Rio / IPP) → src/data/estacoes-brt.json.
 * Fonte: https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Hosted/Esta%C3%A7%C3%B5es_BRT/FeatureServer/0
 * A geometria é multiponto (um ponto por plataforma); usamos o centroide.
 */
import { writeFileSync } from "node:fs";

const BASE = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Hosted/Esta%C3%A7%C3%B5es_BRT/FeatureServer/0";
const j = (await (await fetch(`${BASE}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`)).json()) as {
  features: { properties: { fid: number; nome: string; tipo: string; corredor: string | null }; geometry: { type: string; coordinates: number[] | number[][] } | null }[];
};
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const titulo = (s: string) => s.trim().replace(/\s+/g, " ")
  .replace(/\bJd\.\s*/g, "Jardim ").replace(/\bD[ÁA]gua\b/g, "D'Água").replace(/\bSta\.\s*/g, "Santa ").replace(/\bSto\.\s*/g, "Santo ");
const estacoes = j.features.filter((f) => f.geometry && f.properties?.nome).map((f) => {
  const pts = (f.geometry!.type === "Point" ? [f.geometry!.coordinates] : f.geometry!.coordinates) as number[][];
  const bruto = titulo(f.properties.nome);
  const planejada = /^futuro\b/i.test(bruto);
  return {
    id: `brt-${f.properties.fid}`,
    nome: bruto.replace(/^futuro\s+/i, ""),
    // "FUTURO ..." no catálogo = ainda não opera.
    status: planejada ? "planejada" : "operando",
    tipo: /terminal/i.test(f.properties.tipo) ? "terminal" : "estacao",
    corredor: f.properties.corredor ? titulo(f.properties.corredor) : null,
    lat: r6(pts.reduce((s, p) => s + p[1], 0) / pts.length),
    lng: r6(pts.reduce((s, p) => s + p[0], 0) / pts.length),
  };
});
writeFileSync("src/data/estacoes-brt.json", JSON.stringify({ fonte: BASE, baixadoEm: new Date().toISOString().slice(0, 10), estacoes }, null, 0));
console.log(estacoes.length, "estações/terminais;", estacoes.filter((e) => e.tipo === "terminal").length, "terminais");
