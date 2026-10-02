/** Minúsculas, sem acento e sem pontuação — para busca e agrupamento por nome. */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
