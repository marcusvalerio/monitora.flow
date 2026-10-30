/**
 * "Seu dia": escolhe UMA mensagem principal para o topo da Home e até 3 dicas curtas.
 * Prioridade (ESCOLHA DO SISTEMA): estágio ≥ 3 > calor NC ≥ 4 > tempestade > estágio 2 > calor NC 3
 * > chuva provável > UV alto > sensação ≥ 35° > dia tranquilo. Só usa o que veio das fontes.
 */
export type Nivel = "critico" | "atencao" | "dica" | "ok";
export interface Destaque { nivel: Nivel; titulo: string; texto: string; tipo: string }

interface Entrada {
  estagio?: { nivel: number; mensagem: string | null; texto?: string } | null;
  calor?: { nivel: number } | null;
  hoje?: { maxC: number | null; uvMax?: number | null; chuvaMm?: number | null; probabilidadeChuvaPct?: number | null; descricao?: { icone: string } | null } | null;
  horas?: { inicio: string; probabilidadeChuvaPct: number | null; sensacaoC?: number | null; descricao?: { icone: string } | null }[];
  hora?: (iso: string) => string;
}

export function resumoDoDia(e: Entrada): { destaque: Destaque; dicas: Destaque[] } {
  const hs = (e.horas ?? []).slice(0, 12);
  const hora = e.hora ?? ((s: string) => s);
  const cand: Destaque[] = [];
  const est = e.estagio?.nivel ?? 1, nc = e.calor?.nivel ?? 1;
  const tempestade = hs.find((h) => h.descricao?.icone === "tempestade");
  const chuva = hs.find((h) => (h.probabilidadeChuvaPct ?? 0) >= 50);
  const uv = e.hoje?.uvMax ?? null;
  const sens = Math.max(-99, ...hs.map((h) => h.sensacaoC ?? -99));

  if (est >= 3) cand.push({ tipo: "estagio", nivel: "critico", titulo: `Cidade em Estágio ${est}`, texto: e.estagio?.mensagem || e.estagio?.texto || "Evite deslocamentos desnecessários." });
  if (nc >= 4) cand.push({ tipo: "calor", nivel: "critico", titulo: `Calor extremo · NC${nc}`, texto: "Evite sol entre 10h e 16h, beba água e procure lugares frescos." });
  if (tempestade) cand.push({ tipo: "tempestade", nivel: "atencao", titulo: "Tempestade prevista", texto: `A partir das ${hora(tempestade.inicio)}. Evite áreas alagáveis.` });
  if (est === 2) cand.push({ tipo: "estagio", nivel: "atencao", titulo: "Cidade em Estágio 2", texto: e.estagio?.mensagem || "Risco de ocorrências de alto impacto. Fique atento." });
  if (nc === 3) cand.push({ tipo: "calor", nivel: "atencao", titulo: "Calor forte · NC3", texto: "Hidrate-se e evite sol forte no meio do dia." });
  if (chuva && !tempestade) cand.push({ tipo: "chuva", nivel: "dica", titulo: "Leve o guarda-chuva", texto: chuva === hs[0] ? `${chuva.probabilidadeChuvaPct}% de chance de chuva agora.` : `${chuva.probabilidadeChuvaPct}% de chance de chuva por volta das ${hora(chuva.inicio)}.` });
  if (uv != null && uv >= 8) cand.push({ tipo: "uv", nivel: "dica", titulo: "Use protetor solar", texto: `Índice UV ${Math.round(uv)} hoje, ${uv >= 11 ? "extremo" : "muito alto"}.` });
  if (sens >= 35 && nc < 3) cand.push({ tipo: "sensacao", nivel: "dica", titulo: "Dia abafado", texto: `Sensação de até ${Math.round(sens)}°. Leve água.` });

  const destaque = cand[0] ?? { tipo: "ok", nivel: "ok", titulo: "Dia tranquilo", texto: "Sem alertas da cidade nem chuva provável nas próximas horas." };
  return { destaque, dicas: cand.slice(1, 4) };
}
