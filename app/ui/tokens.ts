/**
 * Tokens do Monitora — fonte única para o que o JS desenha (mapa, rota, veículo, estados).
 * Espelhados em CSS como variáveis em app/globals.css. Nenhuma cor importante fica solta em componente.
 *
 * Filosofia: a interface é neutra (Porcelain/Warm White/Ink); cor comunica ESTADO.
 *   Ultramarine = interação e seleção · Periwinkle/Lilac = atmosfera e estados brandos · Coral = incidente/alerta (raríssimo).
 */
export const COR = {
  porcelain: "#F5F5F2", warmWhite: "#FBFBF9", mist: "#E7E9E8", ink: "#111318", deepInk: "#080A10",
  ultramarine: "#3047C7", periwinkle: "#8997F5", lilac: "#C7C8F5", coral: "#FF7058", seaMist: "#B9D7D6",
} as const;

/** Estados do veículo em relação ao trajeto: semântica fixa em todo o produto. */
export const COR_ESTADO: Record<string, string> = {
  ON_ROUTE: COR.ultramarine, UNCERTAIN: COR.periwinkle, OFF_ROUTE: COR.coral, STALE: "#A4A8AE", SEM_TRAJETO: "#6B7079",
};

export type Tema = "claro" | "escuro";

/** Cartografia: mapa base neutro, água Sea Mist com profundidade tonal, vias em 3 níveis. */
export const MAPA = {
  claro: {
    fundo: "#EFEFEB", terra: COR.porcelain, verde: "#E6E8E2", predio: "#E3E4E0",
    agua: "#C3DCDB", aguaFundo: "#AFCFCE", aguaLinha: "#A9CBCA", aguaRotulo: "#5E8584",
    viaPrincipal: "#FFFFFF", viaPrincipalBorda: "#DADBD6", viaSecundaria: "#FBFBF9", viaMenor: "#F3F3F0", trilho: "#D2D4D0",
    rotulo: "#6B7079", rotuloForte: "#2A2D33", halo: "#F5F5F2",
    rota: COR.ultramarine, rotaBrilho: COR.periwinkle, rotaBase: "#FFFFFF", estacao: COR.ink, estacaoFundo: COR.warmWhite, texturaAgua: "#8FB9B8",
  },
  escuro: {
    fundo: COR.deepInk, terra: "#0D1016", verde: "#0E1218", predio: "#14171E",
    agua: "#0E2023", aguaFundo: "#0A191C", aguaLinha: "#123033", aguaRotulo: "#6E9C9B",
    viaPrincipal: "#2A2F3A", viaPrincipalBorda: "#0B0E14", viaSecundaria: "#1E222B", viaMenor: "#171A21", trilho: "#20242D",
    rotulo: "#8A90A0", rotuloForte: "#D9DBE2", halo: COR.deepInk,
    rota: COR.periwinkle, rotaBrilho: COR.ultramarine, rotaBase: COR.deepInk, estacao: COR.lilac, estacaoFundo: "#14171E", texturaAgua: "#2E5A5D",
  },
} as const;

export const temaAtual = (): Tema => (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro");
