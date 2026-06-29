// Kill-switch service worker.
// Previous versions of this app shipped a network-first SW that intercepted
// every navigation with `cache: 'no-store'`, which made the installed PWA and
// mobile browsers extremely slow / appear stuck loading on weak networks.
// This worker unregisters itself and clears its own caches so returning
// visitors recover automatically. Messaging/push workers (different paths
// and scopes) are untouched.

function isOwnAppCache(name) {
  return /^artswarit-cache-/.test(name);
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(
          names.filter(isOwnAppCache).map((n) => caches.delete(n))
        );
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: 'window' });
        await Promise.allSettled(
          windowClients.map((client) => client.navigate(client.url))
        );
      } finally {
        await self.registration.unregister();
      }
    })()
  );
});

// Pass everything straight to the network while we wait for unregister.
self.addEventListener('fetch', () => {});
