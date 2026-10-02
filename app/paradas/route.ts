import { buscarParadas, paradasProximas, FONTE_PARADAS } from "../../src/lib/paradas";
import { ok, numero, tratar, ErroParametro } from "../../src/lib/api";

/** GET /paradas?q=Alvorada  ou  /paradas?lat=&lng=&raio=500 — paradas e estações de ônibus/BRT. */
export function GET(req: Request) {
  return tratar(async () => {
    const s = new URL(req.url).searchParams;
    const q = (s.get("q") ?? "").trim();
    const temCoord = s.get("lat") !== null && s.get("lng") !== null;
    const perto = temCoord ? { lat: numero(s.get("lat"), "lat", { min: -90, max: 90 }), lng: numero(s.get("lng"), "lng", { min: -180, max: 180 }) } : undefined;
    const limite = numero(s.get("limite"), "limite", { min: 1, max: 50, padrao: 20, inteiro: true });
    if (!q && !perto) throw new ErroParametro("informe 'q' (nome) ou 'lat' e 'lng'");
    if (q && q.length < 2) throw new ErroParametro("'q' precisa de pelo menos 2 letras");
    const paradas = q ? buscarParadas(q, perto, limite)
      : paradasProximas(perto!.lat, perto!.lng, numero(s.get("raio"), "raio", { min: 50, max: 2000, padrao: 500 }), limite);
    return ok({
      fonte: { nome: "Paradas e estações de ônibus/BRT — camada aberta da Prefeitura do Rio", ...FONTE_PARADAS },
      consulta: { q: q || null, ...(perto ?? {}) },
      paradas,
    }, null, 3600);
  });
}
