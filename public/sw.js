const CACHE_NAME = 'tps-cache-v20261020-white-titlebar-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-First: Always fetch latest JS, CSS, HTML, and Media requests directly
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (
    url.includes('/api/') ||
    url.includes('.js') ||
    url.includes('.css') ||
    url.includes('.html') ||
    url.includes('.png') ||
    url.includes('.jpg') ||
    url.includes('.jpeg') ||
    url.includes('.svg') ||
    url.includes('.webp') ||
    url.includes('.ico')
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
