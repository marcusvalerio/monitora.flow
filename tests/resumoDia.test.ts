import { describe, expect, it } from "vitest";
import { resumoDoDia } from "../src/lib/resumoDia";
import { parseCalor, parseEstagio } from "../src/lib/cor";

const h = (p: number, icone = "chuva") => ({ inicio: "15:00", probabilidadeChuvaPct: p, descricao: { icone } });

describe("seu dia", () => {
  it("estágio 3 toma o topo, o resto vira dica", () => {
    const r = resumoDoDia({ estagio: { nivel: 3, mensagem: null, texto: "x" }, horas: [h(80)], hoje: { maxC: 30, uvMax: 9 } });
    expect(r.destaque.titulo).toBe("Cidade em Estágio 3");
    expect(r.dicas.map((d) => d.tipo)).toEqual(["chuva", "uv"]);
  });
  it("sem alerta: guarda-chuva no topo", () => {
    expect(resumoDoDia({ estagio: { nivel: 1, mensagem: null }, horas: [h(10), h(60)] }).destaque.titulo).toBe("Leve o guarda-chuva");
  });
  it("nada → dia tranquilo", () => { expect(resumoDoDia({}).destaque.tipo).toBe("ok"); });
  it("lê as respostas do COR", () => {
    expect(parseEstagio({ cor: "#228d46", estagio: "Estágio 1", mensagem: "", id: 1, inicio: "2026-09-30T08:00:47Z" })?.nivel).toBe(1);
    expect(parseCalor({ heat_level: 1, nivel: 1 })?.nivel).toBe(1);
    expect(parseEstagio({ estagio: "?" })).toBeNull();
  });
});
