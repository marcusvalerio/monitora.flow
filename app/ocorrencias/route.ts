import { ok } from "../../src/lib/api";

/**
 * GET /ocorrencias — ainda sem fonte aberta ao vivo.
 * Testado em 02/10/2026: api.dados.rio/v2/adm_cor_comando/... respondeu 503.
 * O histórico está em datario.adm_cor_comando.ocorrencias (BigQuery, exige conta Google) — não integrado.
 */
export function GET() {
  return ok({
    disponivel: false,
    motivo: "Nenhuma fonte pública ao vivo de ocorrências do COR respondeu nos testes (api.dados.rio: HTTP 503). Ver docs/FONTES.md.",
    observado: null,
  }, null, 300);
}
