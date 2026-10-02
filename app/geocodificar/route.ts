import { ok, tratar, ErroParametro } from "../../src/lib/api";

export const revalidate = 86400;
const URL_GEO = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geocode/Geocode_Logradouros_WGS84/GeocodeServer/findAddressCandidates";

/** GET /geocodificar?q=Avenida das Américas 2000 — geocodificador oficial da Prefeitura (IPP), aberto. */
export function GET(req: Request) {
  return tratar(async () => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 3 || q.length > 200) throw new ErroParametro("parâmetro 'q' deve ter de 3 a 200 caracteres");
    const u = `${URL_GEO}?${new URLSearchParams({ SingleLine: q, f: "json", maxLocations: "6", outSR: "4326" })}`;
    const r = await fetch(u, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`geocodificador respondeu HTTP ${r.status}`);
    const j = (await r.json()) as { candidates?: { address: string; score: number; location: { x: number; y: number } }[] };
    return ok({
      fonte: { nome: "Geocodificador de logradouros — IPP / Prefeitura do Rio", url: URL_GEO },
      consulta: q,
      candidatos: (j.candidates ?? []).map((c) => ({ endereco: c.address, nota: c.score, lat: c.location.y, lng: c.location.x })),
    }, null, 86400);
  });
}
