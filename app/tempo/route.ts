import { ATRIBUICAO_OPEN_METEO, buscarPrevisao } from "../../src/lib/tempo";
import { ok, numero, tratar } from "../../src/lib/api";

export const dynamic = "force-dynamic";

/** GET /tempo?lat=&lng= — previsão (FONTE EXTERNA: Open-Meteo). Para chuva medida, use /chuva. */
export function GET(req: Request) {
  return tratar(async () => {
    const q = new URL(req.url).searchParams;
    const lat = numero(q.get("lat"), "lat", { min: -90, max: 90 });
    const lng = numero(q.get("lng"), "lng", { min: -180, max: 180 });
    return ok({
      fonte: { nome: "Open-Meteo (FONTE EXTERNA)", url: "https://open-meteo.com", licenca: "CC BY 4.0", atribuicao: ATRIBUICAO_OPEN_METEO },
      nota: "Previsão de modelo numérico, não medição. Chuva medida agora: /chuva.",
      consulta: { lat, lng },
      calculado: await buscarPrevisao(lat, lng),
    }, null, 600);
  });
}
