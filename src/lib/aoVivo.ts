import { buscarBrt, buscarSppo, parseBrt, parseSppo, type Leitura } from "./fontes";
import { PARAMETROS } from "./parametros";

/**
 * Posições AO VIVO, lidas da fonte da SMTR na hora do pedido (sem gravar nada no banco).
 * Usado em /linhas/{linha}/veiculos e /chegada para não depender do intervalo da coleta.
 * Cache em memória de AO_VIVO_CACHE_S segundos por instância, para não sobrecarregar a fonte
 * (EXPERIMENTAL / ESCOLHA DO SISTEMA). A placa é descartada pelos mesmos parsers da coleta.
 */
let cache: { em: number; leituras: Leitura[]; erros: string[] } | null = null;
/**
 * Histórico curto das leituras ao vivo nesta instância (últimos JANELA_LINHA_MIN minutos).
 * O BRT só informa a posição do momento; guardar as leituras anteriores permite estimar a chegada
 * (que precisa de duas posições do mesmo veículo) sem esperar a coleta.
 */
const historico = new Map<string, Leitura>();
let pendente: Promise<{ em: number; leituras: Leitura[]; erros: string[] }> | null = null;

async function carregar() {
  const agora = new Date();
  const de = new Date(agora.getTime() - PARAMETROS.AO_VIVO_SPPO_JANELA_MIN * 60_000);
  const [b, s] = await Promise.allSettled([buscarBrt(), buscarSppo(de, agora)]);
  const erros: string[] = [];
  let leituras: Leitura[] = [];
  if (b.status === "fulfilled") { try { leituras = leituras.concat(parseBrt(b.value, agora).leituras); } catch (e) { erros.push(`brt: ${(e as Error).message}`); } }
  else erros.push(`brt: ${b.reason}`);
  if (s.status === "fulfilled") { try { leituras = leituras.concat(parseSppo(s.value).leituras); } catch (e) { erros.push(`sppo: ${(e as Error).message}`); } }
  else erros.push(`sppo: ${s.reason}`);
  for (const l of leituras) historico.set(`${l.fonte}|${l.veiculo}|${l.ts.getTime()}`, l);
  const corte = agora.getTime() - PARAMETROS.JANELA_LINHA_MIN * 60_000;
  for (const [k, l] of historico) if (l.ts.getTime() < corte) historico.delete(k);
  return { em: agora.getTime(), leituras: [...historico.values()], erros };
}

export async function posicoesAoVivo() {
  if (cache && Date.now() - cache.em < PARAMETROS.AO_VIVO_CACHE_S * 1000) return cache;
  pendente ??= carregar().then((c) => (cache = c)).finally(() => { pendente = null; });
  return pendente;
}

export async function linhaAoVivo(linha: string) {
  const c = await posicoesAoVivo();
  return { consultadoEm: new Date(c.em), erros: c.erros, leituras: c.leituras.filter((l) => (l.linha ?? "").toUpperCase() === linha) };
}
