import { expect, it } from "vitest";
import { buscarParadas, normalizar, paradasProximas, PARADAS } from "../src/lib/paradas";

it("carrega a camada de paradas", () => {
  expect(PARADAS.length).toBeGreaterThan(5000);
});

it("normaliza acento e caixa", () => {
  expect(normalizar("Jardim Oceânico :: Plataforma")).toBe("jardim oceanico plataforma");
});

it("busca ignora acento e exige todas as palavras", () => {
  const r = buscarParadas("terminal alvorada");
  expect(r.length).toBeGreaterThan(0);
  expect(r.every((p) => normalizar(p.nome).includes("alvorada"))).toBe(true);
  expect(buscarParadas("oceanico").some((p) => p.nome.includes("Oceânico"))).toBe(true);
});

it("com coordenada, ordena por distância", () => {
  const r = buscarParadas("alvorada", { lat: -23.001, lng: -43.366 });
  for (let i = 1; i < r.length; i++) expect(r[i].distanciaM!).toBeGreaterThanOrEqual(r[i - 1].distanciaM!);
});

it("paradas próximas respeitam o raio", () => {
  const r = paradasProximas(-23.000556, -43.334167, 300);
  expect(r.length).toBeGreaterThan(0);
  expect(r.every((p) => p.distanciaM <= 300)).toBe(true);
});

it("estações aparecem antes das plataformas", () => {
  const nomes = buscarParadas("terminal alvorada").map((p) => p.nome);
  const primeiraPlataforma = nomes.findIndex((n) => n.includes("::"));
  const ultimaEstacao = nomes.map((n) => !n.includes("::")).lastIndexOf(true);
  expect(ultimaEstacao).toBeLessThan(primeiraPlataforma);
});
