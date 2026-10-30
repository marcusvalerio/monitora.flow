import { buscarCidade, TEXTO_ESTAGIO, URL_CALOR, URL_ESTAGIO } from "../../src/lib/cor";
import { ok, tratar } from "../../src/lib/api";

export const dynamic = "force-dynamic";

/** GET /cidade — estágio operacional (1–5) e nível de calor (NC1–NC5) do COR.Rio. Não usa o banco. */
export function GET() {
  return tratar(async () => {
    const c = await buscarCidade();
    return ok({
      fonte: { nome: "COR.Rio — estágio operacional e nível de calor (rotas usadas pelo site cor.rio)", urls: [URL_ESTAGIO, URL_CALOR] },
      observado: { ...c, estagio: c.estagio ? { ...c.estagio, texto: TEXTO_ESTAGIO[c.estagio.nivel] } : null },
    }, null, 120);
  });
}
