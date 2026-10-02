import { buscarEstacoes, estacoesProximas, FONTE_ESTACOES } from "../../src/lib/estacoes";
import { ok, numero, tratar, ErroParametro } from "../../src/lib/api";

/** GET /estacoes?q=  ou  ?lat=&lng= — SÓ estações e terminais do BRT (catálogo oficial). Nunca endereços. */
export function GET(req: Request) {
  return tratar(async () => {
    const s = new URL(req.url).searchParams;
    const q = (s.get("q") ?? "").trim();
    const temCoord = s.get("lat") !== null && s.get("lng") !== null;
    const perto = temCoord ? { lat: numero(s.get("lat"), "lat", { min: -90, max: 90 }), lng: numero(s.get("lng"), "lng", { min: -180, max: 180 }) } : undefined;
    if (!q && !perto) throw new ErroParametro("informe 'q' ou 'lat' e 'lng'");
    const limite = numero(s.get("limite"), "limite", { min: 1, max: 50, padrao: 20, inteiro: true });
    const estacoes = q ? buscarEstacoes(q, perto, limite) : estacoesProximas(perto!.lat, perto!.lng, numero(s.get("raio"), "raio", { min: 100, max: 20000, padrao: 3000 }), limite);
    return ok({ fonte: FONTE_ESTACOES, consulta: { q: q || null, ...(perto ?? {}) }, estacoes }, null, 3600);
  });
}
