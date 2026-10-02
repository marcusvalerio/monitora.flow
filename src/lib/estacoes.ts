import dados from "../data/estacoes-brt.json";
import { distanciaM } from "./geo";
import { normalizar } from "./normalizar";

/**
 * Catálogo oficial de estações e terminais do BRT (camada "Estações BRT" do Data.Rio / IPP).
 * A busca de BRT usa SÓ este catálogo — nunca geocodificação de endereços.
 * Atualizar com `npm run estacoes:atualizar`.
 */
export interface Estacao { id: string; nome: string; tipo: "estacao" | "terminal"; status: "operando" | "planejada"; corredor: string | null; lat: number; lng: number }

export const ESTACOES = dados.estacoes as Estacao[];
export const FONTE_ESTACOES = { nome: "Estações BRT — Data.Rio / IPP", url: dados.fonte, baixadoEm: dados.baixadoEm };

const indice = ESTACOES.map((e) => ({ e, nome: normalizar(e.nome), tudo: normalizar(`${e.nome} ${e.corredor ?? ""} ${e.tipo === "terminal" ? "terminal" : "estacao"}`) }));

/**
 * Todas as palavras precisam aparecer (nome, corredor ou tipo). Ordem: nome começa com a busca,
 * alguma palavra do nome começa com a busca, nome mais curto; com coordenada, por distância.
 */
export function buscarEstacoes(q: string, perto?: { lat: number; lng: number }, limite = 20) {
  const termos = normalizar(q).split(" ").filter(Boolean);
  if (!termos.length) return [];
  const qn = termos.join(" ");
  const sem = (n: string) => n.replace(/^terminal /, "");
  return indice
    .filter(({ tudo }) => termos.every((t) => tudo.includes(t)))
    .map(({ e, nome }) => ({
      ...e,
      distanciaM: perto ? Math.round(distanciaM(perto.lat, perto.lng, e.lat, e.lng)) : null,
      // planejadas (ainda não operam) sempre por último
      score: (e.status === "planejada" ? 10 : 0) + (sem(nome).startsWith(qn) || nome.startsWith(qn) ? 0 : nome.split(" ").some((w) => w.startsWith(termos[0])) ? 1 : 2),
    }))
    .sort((a, b) => (perto ? a.distanciaM! - b.distanciaM! : a.score - b.score || a.nome.length - b.nome.length || a.nome.localeCompare(b.nome, "pt-BR")))
    .slice(0, limite)
    .map(({ score: _s, ...r }) => r);
}

export function estacoesProximas(lat: number, lng: number, raioM = 3000, limite = 10) {
  return ESTACOES.filter((e) => e.status === "operando").map((e) => ({ ...e, distanciaM: Math.round(distanciaM(lat, lng, e.lat, e.lng)) }))
    .filter((e) => e.distanciaM <= raioM).sort((a, b) => a.distanciaM - b.distanciaM).slice(0, limite);
}

export const estacaoPorId = (id: string) => ESTACOES.find((e) => e.id === id);
