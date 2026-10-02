"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
export type J = Record<string, any>;

/** GET JSON sem cache do navegador. Erros viram { erro } com texto de produto, nunca exceção. */
export async function get(url: string, signal?: AbortSignal): Promise<J> {
  try {
    const r = await fetch(url, { cache: "no-store", signal });
    if (r.ok) return await r.json();
    const j = await r.json().catch(() => ({}));
    return { erro: j.erro ?? "Não foi possível atualizar agora." };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { erro: "cancelado", cancelado: true };
    return { erro: "Sem conexão. Verifique a internet." };
  }
}

export function ha(t?: string | number | Date | null, agora = Date.now()) {
  if (t === null || t === undefined) return "—";
  const ms = typeof t === "number" ? t : new Date(t).getTime();
  const s = Math.max(0, Math.round((agora - ms) / 1000));
  if (s < 10) return "agora";
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return `há ${Math.round(s / 3600)} h`;
}

export function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const fmtDist = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);
export const dec = (v: number, casas = 1) => v.toFixed(casas).replace(".", ",");
export const horaLocal = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const diaSemana = (data: string) => {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (data === hoje) return "Hoje";
  return new Date(`${data}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", "").replace(/^\w/, (c) => c.toUpperCase());
};

/** localStorage tolerante (modo privado, cota cheia). */
export function ler<T>(chave: string, padrao: T): T {
  try { const v = localStorage.getItem(chave); return v ? (JSON.parse(v) as T) : padrao; } catch { return padrao; }
}
export function gravar(chave: string, v: unknown) { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
export function lembrar<T extends { id: string }>(chave: string, item: T, max = 6) {
  const lista = ler<T[]>(chave, []).filter((x) => x.id !== item.id);
  gravar(chave, [item, ...lista].slice(0, max));
}

/** Geolocalização como promessa; nunca lança. */
export function minhaPosicao(): Promise<{ lat: number; lng: number } | { erro: string }> {
  return new Promise((ok) => {
    if (!("geolocation" in navigator)) return ok({ erro: "Este aparelho não informa a localização." });
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => ok({ erro: e.code === 1 ? "Permissão de localização negada." : "Não foi possível obter sua localização." }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}
