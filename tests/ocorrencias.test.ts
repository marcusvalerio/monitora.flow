import { describe, expect, it } from "vitest";
import { ocorrenciasPerto, parseOcorrencias } from "../src/lib/ocorrencias";

describe("ocorrências do COR", () => {
  const os = parseOcorrencias({ eventos: [
    { id_evento: 1, pop_titulo: "Acidente", latitude: "-22.92", longitude: "-43.23", bairro: "Tijuca" },
    { id_evento: 2, titulo: "Bolsão d'água", latitude: -23.0, longitude: -43.45 },
    { id_evento: 3, titulo: "Sem local" },
  ] });
  it("lê campos variados e ignora sem coordenada", () => { expect(os.map((o) => o.titulo)).toEqual(["Acidente", "Bolsão d'água"]); });
  it("filtra por 10 km", () => { expect(ocorrenciasPerto(os, -22.925, -43.235, 10_000).map((o) => o.id)).toEqual(["1"]); });
});
