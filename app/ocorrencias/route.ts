import { ok, numero, tratar } from "../../src/lib/api";
import { URL_COR, buscarOcorrencias, ocorrenciasPerto } from "../../src/lib/ocorrencias";

export const dynamic = "force-dynamic";

/**
 * GET /ocorrencias?lat=&lng=&raio= — ocorrências abertas do COR perto do ponto (padrão 10 km, máx. 30 km).
 * Se a API da Prefeitura estiver fora do ar, responde `disponivel: false` (nunca inventa ocorrências).
 */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const temCoord = q.get("lat") !== null;
    const lat = temCoord ? numero(q.get("lat"), "lat", { min: -90, max: 90 }) : null;
    const lng = temCoord ? numero(q.get("lng"), "lng", { min: -180, max: 180 }) : null;
    const raio = numero(q.get("raio"), "raio", { min: 100, max: 30_000, padrao: 10_000 });
    const fonte = { nome: "Ocorrências abertas — COR / Prefeitura do Rio (api.dados.rio)", url: URL_COR };
    try {
      const todas = await buscarOcorrencias();
      return ok({ fonte, disponivel: true, consulta: { lat, lng, raioM: raio },
        observado: lat != null && lng != null ? ocorrenciasPerto(todas, lat, lng, raio) : todas }, null, 120);
    } catch (e) {
      return ok({ fonte, disponivel: false, motivo: `A API de ocorrências do COR não respondeu (${(e as Error).message}). Ver docs/FONTES.md.`, observado: null }, null, 120);
    }
  });
}
