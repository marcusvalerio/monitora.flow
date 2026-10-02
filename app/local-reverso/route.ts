import { ok, numero, tratar } from "../../src/lib/api";

export const dynamic = "force-dynamic";
const REV = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geocode/Geocode_Logradouros_WGS84/GeocodeServer/reverseGeocode";

/** GET /local-reverso?lat=&lng= — nome do lugar (bairro) para a "Minha localização". Só no Rio (IPP); fora, null. */
export function GET(req: Request) {
  return tratar(async () => {
    const s = new URL(req.url).searchParams;
    const lat = numero(s.get("lat"), "lat", { min: -90, max: 90 }), lng = numero(s.get("lng"), "lng", { min: -180, max: 180 });
    let nome: string | null = null, detalhe: string | null = null;
    try {
      const r = await fetch(`${REV}?location=${lng},${lat}&f=json&outSR=4326`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
      const j = (await r.json()) as { address?: { Neighborhood?: string; ShortLabel?: string } };
      if (j.address?.Neighborhood) { nome = j.address.Neighborhood; detalhe = "Rio de Janeiro"; }
    } catch { /* fora do Rio ou serviço indisponível */ }
    return ok({ fonte: { nome: "Geocodificador reverso do IPP/Prefeitura do Rio", url: REV }, nome, detalhe }, null, 3600);
  });
}
