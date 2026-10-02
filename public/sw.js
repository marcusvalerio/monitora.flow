// Service worker mínimo: guarda a "casca" do app para abrir rápido; dados da API sempre pela rede.
const CACHE = "meu-trajeto-v1";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/icone.svg", "/manifest.webmanifest"]))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put("/", c)); return r; }).catch(() => caches.match("/")));
  } else if (u.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })));
  }
});
