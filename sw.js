
const CACHE_NAME = 'mediatracker-v4';

// El Shell esencial que necesitamos para arrancar la app offline
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// Install: Cache essential shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting(); // Force activation immediately
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // --- ESTRATEGIA 0: NAVIGATION FALLBACK (SPA Routing) ---
  // Si es una petición de navegación (abrir la app, recargar, cambiar URL en barra),
  // intentamos red, y si falla (offline o 404), devolvemos SIEMPRE index.html.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Si falla la red, devolvemos el shell (index.html) desde caché
          // Esto permite que la app cargue offline en cualquier ruta
          return caches.match('./index.html');
        })
    );
    return;
  }

  // --- ESTRATEGIA 1: Archivos Propios (Network First) ---
  // Para .js, .css, .json del propio dominio.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // --- ESTRATEGIA 2: Recursos Externos / CDNs (Stale-While-Revalidate) ---
  // Para librerías (React, Tailwind) e imágenes externas.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
         // Fallo silencioso para externos si no hay red
      });

      return cachedResponse || fetchPromise;
    })
  );
});
