const CACHE_NAME = 'tps-cache-v20261023-marksheet-table-fix';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url || '';
  if (!url.startsWith('http')) return;

  // Intercept and sanitize Lordicon CDN requests to prevent SyntaxError on dead 404 icons
  if (url.includes('cdn.lordicon.com') && url.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then(async (res) => {
          if (!res.ok) {
            return new Response("{\"v\":\"5.5.7\",\"fr\":60,\"ip\":0,\"op\":60,\"w\":50,\"h\":50,\"nm\":\"blank\",\"ddd\":0,\"assets\":[],\"layers\":[]}", {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          const clone = res.clone();
          const text = await clone.text().catch(() => '');
          if (text.trim().startsWith('<')) {
            // Received HTML error page instead of JSON -> return blank Lottie
            return new Response("{\"v\":\"5.5.7\",\"fr\":60,\"ip\":0,\"op\":60,\"w\":50,\"h\":50,\"nm\":\"blank\",\"ddd\":0,\"assets\":[],\"layers\":[]}", {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return res;
        })
        .catch(() => {
          return new Response("{\"v\":\"5.5.7\",\"fr\":60,\"ip\":0,\"op\":60,\"w\":50,\"h\":50,\"nm\":\"blank\",\"ddd\":0,\"assets\":[],\"layers\":[]}", {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Bypass service worker for local static assets and APIs
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
