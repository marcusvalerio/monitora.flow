/**
 * Estágio operacional da cidade e nível de calor — FONTE: COR.Rio. São as mesmas rotas que o site cor.rio
 * consulta para exibir o estágio (JSON aberto, sem login), descobertas em 30/10/2026; não há documentação oficial,
 * então o formato pode mudar: o parser é tolerante e, em erro, a Home simplesmente não mostra o estágio.
 * Estágios 1–5 e níveis de calor NC1–NC5 seguem os protocolos da Prefeitura do Rio.
 */
export const URL_ESTAGIO = "https://appcor.cor-rio.work/estagio_cidade";
export const URL_CALOR = "https://appcor.cor-rio.work/calor_api";

export function parseEstagio(j: unknown) {
  const o = (j ?? {}) as Record<string, unknown>;
  const m = /(\d)/.exec(String(o.estagio ?? ""));
  const n = m ? Number(m[1]) : Number(o.id);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  const msg = [o.mensagem, o.mensagem2].filter((x): x is string => typeof x === "string" && !!x.trim()).join(" ").trim();
  return { nivel: n, cor: typeof o.cor === "string" ? o.cor : null, mensagem: msg || null, desde: typeof o.inicio === "string" ? o.inicio : null };
}

export function parseCalor(j: unknown) {
  const o = (j ?? {}) as Record<string, unknown>;
  const n = Number(o.nivel ?? o.heat_level ?? o.level);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return { nivel: n, atualizadoEm: typeof o.updated_at === "string" ? o.updated_at : null };
}

async function json(url: string) {
  const r = await fetch(url, { next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) } as RequestInit);
  if (!r.ok) throw new Error(`COR respondeu HTTP ${r.status}`);
  return r.json();
}

export async function buscarCidade() {
  const [e, c] = await Promise.allSettled([json(URL_ESTAGIO), json(URL_CALOR)]);
  return {
    estagio: e.status === "fulfilled" ? parseEstagio(e.value) : null,
    calor: c.status === "fulfilled" ? parseCalor(c.value) : null,
  };
}

/** O que cada estágio significa (resumo do protocolo do COR). */
export const TEXTO_ESTAGIO: Record<number, string> = {
  1: "Cidade em normalidade.",
  2: "Risco de ocorrências de alto impacto. Fique atento aos avisos.",
  3: "Ocorrências de alto impacto já afetam a cidade. Evite deslocamentos desnecessários.",
  4: "Várias ocorrências graves ao mesmo tempo. Só saia se for preciso.",
  5: "Situação de crise: grande impacto na cidade. Siga as orientações da Defesa Civil.",
};
