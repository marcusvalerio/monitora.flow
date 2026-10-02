/**
 * Retrato operacional da frota (só dados observados + cálculos documentados).
 * Base: leitura ao vivo da SMTR (BRT: retrato; ônibus: últimos 3 min) + histórico em memória de 10 min,
 * última posição de cada veículo. Estados geográficos só para BRT (único com trajeto oficial carregado).
 */
import type { Leitura } from "./fontes";
import { distanciaAoTrajeto, type Coords } from "./trajeto";
import { estadoGeo, VELHO_S, type EstadoGeo } from "./estadoGeo";

export const RECENTE_S = 120; // "posição recente" = até 2 min (EXPERIMENTAL / ESCOLHA DO SISTEMA)

export interface ResumoFrota {
  veiculos: number; linhas: number; recentes: number; velhos: number; parados: number;
  estados: Record<EstadoGeo | "SEM_TRAJETO", number> | null;
}

export function ultimaPorVeiculo(ls: Leitura[]): Leitura[] {
  const m = new Map<string, Leitura>();
  for (const l of ls) {
    const k = `${l.fonte}|${l.veiculo}`;
    const a = m.get(k);
    if (!a || l.ts > a.ts) m.set(k, l);
  }
  return [...m.values()];
}

export function retrato(ls: Leitura[], agora: Date, trajetos: Record<string, { coords: Coords }[]>) {
  const ult = ultimaPorVeiculo(ls).filter((l) => l.linha);
  const pontos: [number, number, string, string][] = []; // [lng, lat, fonte, estado]
  const resumo = (fonte: "brt" | "sppo"): ResumoFrota => {
    const vs = ult.filter((l) => l.fonte === fonte);
    const estados = fonte === "brt" ? { ON_ROUTE: 0, UNCERTAIN: 0, OFF_ROUTE: 0, STALE: 0, SEM_TRAJETO: 0 } : null;
    let recentes = 0, velhos = 0, parados = 0;
    for (const l of vs) {
      const idade = (agora.getTime() - l.ts.getTime()) / 1000;
      if (idade <= RECENTE_S) recentes++;
      if (idade > VELHO_S) velhos++;
      if (l.velocidade < 3) parados++;
      let e: string = idade > VELHO_S ? "STALE" : "SEM_TRAJETO";
      if (estados) {
        const tr = trajetos[(l.linha ?? "").toUpperCase()] ?? [];
        const d = tr.length ? distanciaAoTrajeto(l.lat, l.lng, tr) : null;
        e = estadoGeo(idade, d) ?? "SEM_TRAJETO";
        estados[e as keyof typeof estados]++;
      }
      pontos.push([Math.round(l.lng * 1e5) / 1e5, Math.round(l.lat * 1e5) / 1e5, fonte, e]);
    }
    return { veiculos: vs.length, linhas: new Set(vs.map((l) => l.linha)).size, recentes, velhos, parados, estados };
  };
  const brt = resumo("brt"), onibus = resumo("sppo");
  return { brt, onibus, total: brt.veiculos + onibus.veiculos, recentes: brt.recentes + onibus.recentes, pontos };
}
