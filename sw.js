
const CACHE_NAME = 'mediatracker-v3';

// Solo cacheamos lo esencial del "Shell" de la app al instalar.
// El resto (código, imágenes, librerías externas) se cacheará dinámicamente al usarse.
const ESSENTIAL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Install: Cache essential shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ESSENTIAL_ASSETS);
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

// Fetch: Robust Network-First Strategy for HTML/App code, Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET (como POST a APIs)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ESTRATEGIA 1: Network First (Red primero, luego Caché)
  // Ideal para el HTML y tus propios archivos de código (App.tsx, etc) para que siempre veas cambios al desarrollar.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Si la red responde bien, actualizamos la caché y devolvemos el contenido
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si falla la red (Offline), buscamos en caché
          return caches.match(event.request);
        })
    );
    return;
  }

  // ESTRATEGIA 2: Stale-While-Revalidate (Caché primero, luego actualiza en fondo)
  // Ideal para librerías externas (CDN) e imágenes, que no cambian seguido.
  // Esto arregla el problema de que React/Tailwind no cargaban offline.
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
         // Si falla la red y no hay caché, no podemos hacer mucho para recursos externos
         console.log('Fetch failed for external resource:', event.request.url);
      });

      // Devolver lo que tengamos en caché ya mismo, o esperar a la red si no hay nada
      return cachedResponse || fetchPromise;
    })
  );
});
