import dados from "../data/paradas.json";
import { distanciaM } from "./geo";
import { normalizar } from "./normalizar";

export { normalizar };

/**
 * Paradas e estações (ônibus e BRT) da camada aberta da Prefeitura — ver docs/FONTES.md.
 * Atualizar com `npm run paradas:atualizar`.
 */
export interface Parada { id: string; ids: string[]; nome: string; bairro: string | null; rua?: string; lat: number; lng: number }

export const PARADAS: Parada[] = dados.paradas;
export const FONTE_PARADAS = { url: dados.fonte, bairros: dados.fonteBairros, versao: dados.versao, baixadoEm: dados.baixadoEm, agrupadasAteM: dados.agruparM };

// O bairro e a rua também entram na busca ("mato alto campo grande").
const indice = PARADAS.map((p) => ({ p, chave: normalizar(`${p.nome} ${p.bairro ?? ""} ${p.rua ?? ""}`), nomeN: normalizar(p.nome) }));

/**
 * Busca por nome: todas as palavras digitadas precisam aparecer no nome.
 * Ordem: nome que começa com a busca; estações antes das plataformas ("Terminal X :: Plataforma Y");
 * depois mais curto; depois alfabética.
 * Com coordenada, ordena por distância.
 */
export function buscarParadas(q: string, perto?: { lat: number; lng: number }, limite = 20) {
  const termos = normalizar(q).split(" ").filter(Boolean);
  if (!termos.length) return [];
  const qn = termos.join(" ");
  const achadas = indice.filter(({ chave }) => termos.every((t) => chave.includes(t)));
  const com = achadas.map(({ p, nomeN }) => ({ ...p, distanciaM: perto ? Math.round(distanciaM(perto.lat, perto.lng, p.lat, p.lng)) : null, comeca: nomeN.startsWith(qn) }));
  com.sort((a, b) =>
    perto ? (a.distanciaM! - b.distanciaM!) :
    Number(b.comeca) - Number(a.comeca) || Number(a.nome.includes("::")) - Number(b.nome.includes("::")) ||
    a.nome.length - b.nome.length || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  return com.slice(0, limite).map(({ comeca: _c, ...r }) => r);
}

export function paradasProximas(lat: number, lng: number, raioM = 500, limite = 20) {
  return PARADAS.map((p) => ({ ...p, distanciaM: Math.round(distanciaM(lat, lng, p.lat, p.lng)) }))
    .filter((p) => p.distanciaM <= raioM)
    .sort((a, b) => a.distanciaM - b.distanciaM)
    .slice(0, limite);
}

export const paradaPorId = (id: string) => PARADAS.find((p) => p.id === id || p.ids.includes(id));
