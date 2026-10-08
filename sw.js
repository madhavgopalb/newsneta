const CACHE_VERSION = "v80";
const CACHE_NAME = `newsneta-pwa-${CACHE_VERSION}`;
const API_CACHE_NAME = `newsneta-api-${CACHE_VERSION}`;
const MEDIA_CACHE_NAME = `newsneta-media-${CACHE_VERSION}`;
const NEWSNETA_CACHE_PREFIXES = ["newsneta-pwa-", "newsneta-api-", "newsneta-media-"];
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

function isObsoleteNewsNetaCache(key) {
  return NEWSNETA_CACHE_PREFIXES.some(prefix => key.startsWith(prefix))
    && key !== CACHE_NAME
    && key !== API_CACHE_NAME
    && key !== MEDIA_CACHE_NAME;
}

async function cleanupOldNewsNetaCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(isObsoleteNewsNetaCache).map(key => caches.delete(key)));
}

function stableNewsRequest(request) {
  const stableUrl = new URL(request.url);
  stableUrl.searchParams.delete("refresh");
  stableUrl.searchParams.delete("force");
  stableUrl.searchParams.delete("view");
  return new Request(stableUrl.href, { method: "GET" });
}

async function handleNewsRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const stableRequest = stableNewsRequest(request);

  try {
    const networkResponse = await fetch(request, { cache: "no-store" });
    if (!networkResponse.ok) {
      throw new Error(`News API HTTP ${networkResponse.status}`);
    }

    // Clone synchronously, before the browser can consume the original body.
    const responseForBrowser = networkResponse.clone();
    const responseForCache = networkResponse.clone();

    try {
      await cache.put(stableRequest, responseForCache);
    } catch (error) {
      console.error("NEWS_API_CACHE_WRITE_FAILED", error);
    }

    return responseForBrowser;
  } catch (error) {
    console.error("NEWS_NETWORK_FAILED", error);
    const cachedResponse = await cache.match(stableRequest);
    if (cachedResponse) return cachedResponse;

    return new Response(JSON.stringify({ status: "offline", items: [] }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function isCacheableImage(response) {
  return Boolean(response?.ok && response.headers.get("content-type")?.toLowerCase().startsWith("image/"));
}

async function handleImageRequest(request) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (isCacheableImage(response)) {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.error("MEDIA_CACHE_WRITE_FAILED", error);
      }
    }
    return response;
  });
  if (cached) {
    network.catch(error => console.error("MEDIA_REVALIDATE_FAILED", error));
    return cached;
  }
  return network;
}

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      cleanupOldNewsNetaCaches()
    ])
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "CLEAR_RUNTIME_CACHE") {
    event.waitUntil(cleanupOldNewsNetaCaches());
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.destination === "video" || request.headers.has("range")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(handleImageRequest(request).catch(() => new Response("", { status: 503 })));
    return;
  }

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
        .then(response => {
          if (response && response.ok) {
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: {
                ...Object.fromEntries(response.headers.entries()),
                "Cache-Control": "no-store, max-age=0, must-revalidate",
                "X-NewsNeta-SW": CACHE_NAME
              }
            });
          }
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (request.url.includes("/.netlify/functions/news")) {
    event.respondWith(handleNewsRequest(request));
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
