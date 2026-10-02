import { afterEach, expect, it, vi } from "vitest";
import brt from "./fixtures/brt.json";

afterEach(() => { vi.useRealTimers(); vi.resetModules(); vi.restoreAllMocks(); });

it("modo ao vivo guarda a leitura anterior do BRT para estimar chegada", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T03:19:08Z"));
  const v0 = (brt as { veiculos: Record<string, unknown>[] }).veiculos[0];
  let chamada = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("/gps/sppo")) return new Response("[]");
    chamada++;
    const lat = (v0.latitude as number) + (chamada === 1 ? 0 : 0.002);
    const ts = new Date(Date.now()).getTime();
    return new Response(JSON.stringify({ veiculos: [{ ...v0, latitude: lat, dataHora: ts }] }));
  }));
  const { linhaAoVivo } = await import("../src/lib/aoVivo");
  const linha = String(v0.linha).toUpperCase();
  expect((await linhaAoVivo(linha)).leituras).toHaveLength(1);
  vi.setSystemTime(new Date("2026-10-02T03:20:30Z")); // depois do cache
  const r = await linhaAoVivo(linha);
  expect(r.leituras).toHaveLength(2); // leitura anterior + atual do mesmo veículo
  expect(r.leituras.every((l) => !("placa" in l))).toBe(true);
});
