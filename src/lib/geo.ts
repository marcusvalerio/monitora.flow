/** Raio médio da Terra (m) — FONTE EXTERNA: IUGG, R = 6 371 008,8 m. */
const R = 6_371_008.8;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância de haversine em metros. */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Caixa (lat/lng) que contém o círculo — usada só como pré-filtro no SQL. */
export function caixa(lat: number, lng: number, raioM: number) {
  const dLat = (raioM / R) * (180 / Math.PI);
  const dLng = dLat / Math.cos(rad(lat));
  return { latMin: lat - dLat, latMax: lat + dLat, lngMin: lng - dLng, lngMax: lng + dLng };
}
