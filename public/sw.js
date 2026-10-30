// Service worker mínimo: guarda a "casca" de cada tela para abrir rápido; dados da API sempre pela rede.
// Cada página fica na sua própria entrada (antes tudo ia para "/" e, sem rede, /clima abria a Home).
const CACHE = "monitora-v4";
const TELAS = ["/", "/clima", "/mobilidade", "/monitor", "/mais"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icone.svg", "/manifest.webmanifest"]))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    const chave = u.pathname;
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok && (TELAS.includes(chave) || chave.startsWith("/novidade"))) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(chave, c)); }
      return r;
    }).catch(() => caches.match(chave).then((m) => m || caches.match("/"))));
  } else if (u.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; })));
  }
});
