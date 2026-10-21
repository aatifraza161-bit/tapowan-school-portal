const CACHE_NAME = 'tps-cache-v20261021-csp-fix-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-First with safe fallback (prevents 'Failed to convert value to Response' TypeError)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url || '';
  if (!url.startsWith('http')) return;

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
    url.includes('.ico') ||
    url.includes('.json') ||
    url.includes('lordicon') ||
    url.includes('jsdelivr') ||
    url.includes('googleapis') ||
    url.includes('gstatic')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (!res) return new Response('', { status: 404, statusText: 'Not Found' });
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Offline' });
      })
  );
});
