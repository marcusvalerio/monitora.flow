import { ok, tratar } from "../../src/lib/api";
import { URL_CEMADEN, buscarCemaden } from "../../src/lib/cemaden";
import { URL_INMET_AVISOS, buscarAvisosInmet } from "../../src/lib/inmet";

export const dynamic = "force-dynamic";

/**
 * GET /oficial — fontes FORA da Prefeitura: avisos do INMET para o Rio e pluviômetros do Cemaden.
 * Cada uma responde por si: se uma cair, vem `disponivel: false` com o motivo (nunca inventa dado).
 */
export function GET() {
  return tratar(async () => {
    const [inmet, cemaden] = await Promise.allSettled([buscarAvisosInmet(), buscarCemaden()]);
    return ok({
      fontes: [{ nome: "INMET — avisos meteorológicos", url: URL_INMET_AVISOS }, { nome: "Cemaden — pluviômetros", url: URL_CEMADEN }],
      observado: {
        inmet: inmet.status === "fulfilled" ? { disponivel: true, avisos: inmet.value } : { disponivel: false, motivo: (inmet.reason as Error).message },
        cemaden: cemaden.status === "fulfilled" ? { disponivel: true, pluviometros: cemaden.value } : { disponivel: false, motivo: (cemaden.reason as Error).message },
      },
    }, null, 300);
  });
}
