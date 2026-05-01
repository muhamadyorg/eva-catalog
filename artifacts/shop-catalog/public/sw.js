const CACHE_NAME = "shop-catalog-v2";
const STATIC_ASSETS = ["/", "/index.html", "/favicon.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API va WebSocket so'rovlari — hech qachon keshlamasin
  if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
    return;
  }

  // HTML sahifalar — network-first (oflayn bo'lsa keshdan)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Statik fayllar — cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
