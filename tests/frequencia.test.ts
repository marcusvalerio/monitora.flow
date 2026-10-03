import { describe, expect, it } from "vitest";
import { programacao, relogioRio, servicoDoDia } from "../src/lib/frequencia";

describe("programação de frequência (GTFS)", () => {
  it("usa o horário do Rio (UTC−3)", () => {
    expect(relogioRio(new Date("2026-10-05T02:30:00Z"))).toMatchObject({ ymd: "20261004", minuto: 23 * 60 + 30 });
  });
  it("tipo de dia: útil, sábado, domingo e feriado do calendar_dates", () => {
    expect(servicoDoDia(new Date("2026-10-05T15:00:00Z"))).toBe("U_REG"); // segunda
    expect(servicoDoDia(new Date("2026-10-03T15:00:00Z"))).toBe("S_REG"); // sábado
    expect(servicoDoDia(new Date("2026-10-04T15:00:00Z"))).toBe("D_REG"); // domingo
    expect(servicoDoDia(new Date("2026-10-12T15:00:00Z"))).toBe("D_REG"); // feriado (12/10)
  });
  it("BRT 10 em dia útil às 07h tem intervalo programado e perfil de 24 h", () => {
    const p = programacao("BRT", "10", new Date("2026-10-05T10:00:00Z"))!;
    expect(p.tipoDia).toBe("dia útil");
    const s = p.sentidos.find((x) => x.sentido === 0)!;
    expect(s.intervaloS).toBeGreaterThan(0);
    expect(s.perfil).toHaveLength(24);
  });
  it("linha sem frequência publicada → null (não inventa)", () => {
    expect(programacao("BUS", "LINHA-QUE-NAO-EXISTE")).toBeNull();
  });
});
