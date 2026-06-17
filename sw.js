const CACHE_NAME = "newsneta-pwa-v48";
const APP_SHELL = [
  "/manifest.json",
  "/assets/newsneta-logo.jpg",
  "/assets/newsneta-logo-transparent.png",
  "/assets/newsneta-logo-header.png",
  "/assets/app/icon-192.png",
  "/assets/app/icon-512.png",
  "/assets/app/maskable-192.png",
  "/assets/app/maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
        .then(response => response || new Response("", { status: 204 }))
    );
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (request.url.includes("/.netlify/functions/news")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .catch(() => caches.match(request))
        .then(response => response || new Response(JSON.stringify({ status: "offline", items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }).then(response => response || new Response("", { status: 204 }))
  );
});
