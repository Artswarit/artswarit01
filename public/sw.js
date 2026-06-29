const CACHE_NAME = 'artswarit-cache-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome-extension / data URLs
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Navigation requests (HTML pages) — always network first and never trap users
  // in stale HTML that points at deleted Vite chunks after a deploy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Only cache same-origin static assets. Supabase media/API responses should not be
  // captured by the app shell cache because failed/ranged media requests can create
  // blank states in installed PWAs.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isStaticAsset = /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|json|woff2?)$/i.test(url.pathname);
  if (!isStaticAsset) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets — network first, fall back to cache.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
