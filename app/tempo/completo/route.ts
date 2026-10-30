import { ATRIBUICAO_OPEN_METEO } from "../../../src/lib/tempo";
import { buscarCompleta } from "../../../src/lib/tempoCompleto";
import { ok, numero, tratar } from "../../../src/lib/api";

export const dynamic = "force-dynamic";

/** GET /tempo/completo?lat=&lng= — previsão detalhada (prévia de /novidade). FONTE EXTERNA: Open-Meteo. */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const lat = numero(q.get("lat"), "lat", { min: -90, max: 90 });
    const lng = numero(q.get("lng"), "lng", { min: -180, max: 180 });
    return ok({
      fonte: { nome: "Open-Meteo previsão + qualidade do ar (FONTE EXTERNA)", url: "https://open-meteo.com", licenca: "CC BY 4.0", atribuicao: ATRIBUICAO_OPEN_METEO },
      nota: "Previsão de modelo numérico, não medição. Experimental (prévia em /novidade).",
      consulta: { lat, lng },
      calculado: await buscarCompleta(lat, lng),
    }, null, 600);
  });
}
