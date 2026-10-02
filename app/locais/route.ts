import { ok, tratar, ErroParametro } from "../../src/lib/api";

export const dynamic = "force-dynamic";

const GEO_OM = "https://geocoding-api.open-meteo.com/v1/search";
const GEO_IPP = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Geocode/Geocode_Logradouros_WGS84/GeocodeServer/findAddressCandidates";

/**
 * GET /locais?q= — busca AMPLA de lugares para o Clima (cidade, bairro, endereço).
 * Cidades: geocodificador do Open-Meteo (FONTE EXTERNA, GeoNames). Endereços no Rio: geocodificador do IPP.
 * Não é usada na busca de BRT (que só consulta o catálogo de estações).
 */
export function GET(req: Request) {
  return tratar(async () => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2 || q.length > 120) throw new ErroParametro("'q' deve ter de 2 a 120 caracteres");
    const [om, ipp] = await Promise.allSettled([
      fetch(`${GEO_OM}?${new URLSearchParams({ name: q, count: "6", language: "pt", format: "json" })}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }).then((r) => r.json()),
      /\d/.test(q) || q.length >= 4
        ? fetch(`${GEO_IPP}?${new URLSearchParams({ SingleLine: q, f: "json", maxLocations: "4", outSR: "4326" })}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }).then((r) => r.json())
        : Promise.resolve({ candidates: [] }),
    ]);
    type L = { id: string; nome: string; detalhe: string; lat: number; lng: number; tipo: "cidade" | "endereco" };
    const locais: L[] = [];
    if (om.status === "fulfilled") {
      for (const r of (om.value?.results ?? []) as { id: number; name: string; admin1?: string; admin2?: string; country?: string; country_code?: string; latitude: number; longitude: number; feature_code?: string }[]) {
        const detalhe = [r.admin2 && r.admin2 !== r.name ? r.admin2 : null, r.admin1, r.country_code === "BR" ? null : r.country].filter(Boolean).join(", ");
        locais.push({ id: `om-${r.id}`, nome: r.name, detalhe, lat: r.latitude, lng: r.longitude, tipo: "cidade" });
      }
    }
    if (ipp.status === "fulfilled") {
      for (const c of ((ipp.value as { candidates?: { address: string; score: number; location: { x: number; y: number } }[] })?.candidates ?? []).filter((c) => c.score >= 85)) {
        const [rua, ...resto] = c.address.split(",");
        locais.push({ id: `ipp-${c.location.y.toFixed(5)},${c.location.x.toFixed(5)}`, nome: rua.trim(), detalhe: [resto.join(",").trim(), "Rio de Janeiro"].filter(Boolean).join(", "), lat: c.location.y, lng: c.location.x, tipo: "endereco" });
      }
    }
    // Cidades do Brasil primeiro, depois endereços; sem repetir o mesmo ponto.
    const vistos = new Set<string>();
    const ordenados = locais
      .sort((a, b) => Number(b.detalhe.includes("Rio de Janeiro")) - Number(a.detalhe.includes("Rio de Janeiro")))
      .filter((l) => { const k = `${l.lat.toFixed(3)},${l.lng.toFixed(3)}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
    return ok({
      fonte: { nome: "Open-Meteo Geocoding (GeoNames) e geocodificador do IPP/Prefeitura do Rio", urls: [GEO_OM, GEO_IPP] },
      consulta: q, locais: ordenados.slice(0, 8),
    }, null, 3600);
  });
}
