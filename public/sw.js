const CACHE_NAME = 'tps-cache-v20261016-mobile16';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-First: Always fetch latest JS, CSS, HTML, and API requests directly
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/') || event.request.url.includes('.js') || event.request.url.includes('.css') || event.request.url.includes('.html')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
