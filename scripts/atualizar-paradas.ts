/**
 * Baixa a camada aberta de paradas/estações da Prefeitura e grava uma versão compacta em src/data/paradas.json.
 * Fonte: https://raw.githubusercontent.com/prefeitura-rio/storage/master/layers/paradas_onibus.geojson
 */
import { writeFileSync } from "node:fs";

const URL = "https://raw.githubusercontent.com/prefeitura-rio/storage/master/layers/paradas_onibus.geojson";
const j = (await (await fetch(URL)).json()) as {
  features: { properties: { id_parada: string | number; nome_parada: string; data_versao?: string }; geometry: { coordinates: [number, number] } }[];
};
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const paradas = j.features
  .filter((f) => f.geometry?.coordinates && f.properties?.nome_parada)
  .map((f) => ({ id: String(f.properties.id_parada), nome: f.properties.nome_parada.trim(), lat: r6(f.geometry.coordinates[1]), lng: r6(f.geometry.coordinates[0]) }));
const versao = j.features.find((f) => f.properties.data_versao)?.properties.data_versao ?? null;
writeFileSync("src/data/paradas.json", JSON.stringify({ fonte: URL, versao, baixadoEm: new Date().toISOString().slice(0, 10), paradas }));
console.log(paradas.length, "paradas, versão", versao);
