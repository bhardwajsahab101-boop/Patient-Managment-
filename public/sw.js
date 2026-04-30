// Service Worker for MediCare Hub PWA
// Note: External CDN requests are handled directly by the browser (not through service worker caching)
// to avoid Content Security Policy conflicts

const CACHE_NAME = "medicare-v1";
const OFFLINE_URLS = [
  "/",
  "/dashboard",
  "/patients",
  "/icons/logo.png",
  "/css/base.css",
  "/css/components.css",
];

self.addEventListener("install", (event) => {
  console.log("Service Worker Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching offline URLs");
      return cache.addAll(OFFLINE_URLS).catch(() => {
        // Ignore errors for offline caching
        console.log("Offline caching skipped");
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  event.waitUntil(clients.claim());
});

// Simple cache strategy: only cache same-origin requests, let browser handle external CDNs
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // For external requests (CDN, fonts, etc.), let browser handle directly - skip service worker
  if (url.origin !== location.origin) {
    return;
  }

  // For same-origin requests, try network first then cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone).catch(() => {});
        });
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      }),
  );
});
