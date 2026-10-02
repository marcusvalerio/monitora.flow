import type { Leitura } from "./fontes";
import { posicoesAoVivo } from "./aoVivo";
import { lerPosicoes } from "./coletor";
import { caixa, distanciaM } from "./geo";
import { estimarChegadas } from "./chegada";
import { destinoDoTrajeto } from "./veiculo";
import { PARAMETROS } from "./parametros";

/** Leituras ao vivo (memória, últimos minutos) + gravadas (banco), de uma fonte, perto de um ponto. */
async function leiturasPerto(lat: number, lng: number, raioM: number, fonte: "brt" | "sppo", desdeMin: number): Promise<Leitura[]> {
  const desde = new Date(Date.now() - desdeMin * 60_000);
  const [vivo, banco] = await Promise.all([
    posicoesAoVivo().then((c) => c.leituras).catch((): Leitura[] => []),
    lerPosicoes(desde, caixa(lat, lng, raioM)).catch((): Leitura[] => []),
  ]);
  return banco.concat(vivo).filter((l) => l.fonte === fonte && l.ts >= desde && distanciaM(lat, lng, l.lat, l.lng) <= raioM);
}

/**
 * Linhas vistas perto de um ponto — EXPERIMENTAL / ESCOLHA DO SISTEMA (não é a lista oficial da estação):
 * linhas com pelo menos um veículo a até `raioM` metros nos últimos `janelaMin` minutos.
 */
export async function linhasVistas(lat: number, lng: number, fonte: "brt" | "sppo", raioM: number = PARAMETROS.PARADA_LINHAS_RAIO_M, janelaMin: number = PARAMETROS.PARADA_LINHAS_JANELA_MIN) {
  const ls = await leiturasPerto(lat, lng, raioM, fonte, janelaMin);
  const por = new Map<string, { linha: string; fonte: string; veiculos: Set<string>; ultima: Date; destinos: Set<string> }>();
  for (const l of ls) {
    if (!l.linha) continue;
    const a = por.get(l.linha) ?? { linha: l.linha, fonte: l.fonte, veiculos: new Set<string>(), ultima: l.ts, destinos: new Set<string>() };
    a.veiculos.add(l.veiculo);
    if (l.ts > a.ultima) a.ultima = l.ts;
    const d = destinoDoTrajeto(l.trajeto, l.sentido);
    if (d) a.destinos.add(d);
    por.set(l.linha, a);
  }
  return [...por.values()]
    .sort((a, b) => b.veiculos.size - a.veiculos.size || a.linha.localeCompare(b.linha, "pt-BR", { numeric: true }))
    .map((a) => ({ linha: a.linha, fonte: a.fonte, veiculos: a.veiculos.size, ultimaLeitura: a.ultima, destinos: [...a.destinos] }));
}

/**
 * Próximo veículo de cada linha vindo em direção ao ponto (mesma estimativa EXPERIMENTAL de /chegada),
 * considerando só as linhas vistas no ponto.
 */
export async function proximosVeiculos(lat: number, lng: number, fonte: "brt" | "sppo", linhas: string[]) {
  if (!linhas.length) return [];
  const agora = new Date();
  const alvo = new Set(linhas.map((l) => l.toUpperCase()));
  const ls = (await leiturasPerto(lat, lng, PARAMETROS.CHEGADA_DIST_MAX_M, fonte, PARAMETROS.JANELA_LINHA_MIN))
    .filter((l) => l.linha && alvo.has(l.linha.toUpperCase()));
  const porLinha = new Map<string, Leitura[]>();
  for (const l of ls) (porLinha.get(l.linha!) ?? porLinha.set(l.linha!, []).get(l.linha!)!).push(l);
  const out = [];
  for (const [linha, arr] of porLinha) {
    const c = estimarChegadas(arr, lat, lng, agora)[0];
    if (!c) continue;
    const ult = arr.filter((x) => x.veiculo === c.veiculo).sort((a, b) => b.ts.getTime() - a.ts.getTime())[0];
    out.push({ linha, fonte, veiculo: c.veiculo, destino: destinoDoTrajeto(ult?.trajeto, ult?.sentido), etaMin: c.etaMin, distanciaM: c.distanciaM, ultimaLeitura: c.ultimaLeitura });
  }
  return out.sort((a, b) => a.etaMin - b.etaMin);
}
