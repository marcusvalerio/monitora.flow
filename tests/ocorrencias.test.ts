import { describe, expect, it } from "vitest";
import { categoria, ocorrenciasPerto, parseOcorrencias } from "../src/lib/ocorrencias";

describe("ocorrências do COR", () => {
  const os = parseOcorrencias({ eventos: [
    { id_evento: 1, pop_titulo: "Acidente", latitude: "-22.92", longitude: "-43.23", bairro: "Tijuca" },
    { id_evento: 2, titulo: "Bolsão d'água", latitude: -23.0, longitude: -43.45 },
    { id_evento: 3, titulo: "Sem local" },
  ] });
  it("lê campos variados e ignora sem coordenada", () => { expect(os.map((o) => o.titulo)).toEqual(["Acidente", "Bolsão d'água"]); });
  it("filtra por 10 km", () => { expect(ocorrenciasPerto(os, -22.925, -43.235, 10_000).map((o) => o.id)).toEqual(["1"]); });
  it("categoriza alagamento e interdição e lê a rua", () => {
    const [a, b] = parseOcorrencias([
      { id: 9, titulo: "Bolsão d'água", logradouro: "Rua Mariz e Barros", latitude: -22.91, longitude: -43.21 },
      { id: 8, pop_titulo: "Via interditada", endereco: "Av. Brasil", latitude: -22.88, longitude: -43.25 },
    ]);
    expect([a.categoria, a.rua]).toEqual(["alagamento", "Rua Mariz e Barros"]);
    expect([b.categoria, b.rua]).toEqual(["interdicao", "Av. Brasil"]);
    expect(categoria("Acidente de trânsito")).toBe("outra");
    expect(categoria("Alagamento com interdição")).toBe("alagamento");
  });
});
