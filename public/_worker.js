export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Handle CORS preflight OPTIONS requests directly at the edge
    if (request.method === "OPTIONS" && (url.pathname.startsWith('/api/') || url.pathname === '/api')) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // 1b. Fast Edge Postal Geocoding for PIN Codes (Zero CORS restrictions)
    if (url.pathname.startsWith('/api/pincode/')) {
      const pin = url.pathname.replace('/api/pincode/', '').trim().split('/')[0];
      if (/^\d{6}$/.test(pin)) {
        try {
          const pinRes = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          const pinData = await pinRes.json();
          if (pinData && pinData[0] && pinData[0].Status === 'Success' && pinData[0].PostOffice?.length) {
            const poList = pinData[0].PostOffice;
            const first = poList[0];
            return new Response(JSON.stringify({
              success: true,
              state: first.State || '',
              district: first.District || '',
              postOffices: poList.map(p => p.Name)
            }), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
              }
            });
          }
        } catch (e) {
          // fall through to reverse proxy if edge fetch encounters issue
        }
      }
    }

    // 2. Reverse proxy /api/* requests to dedicated school backend (Vercel)
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      const targetUrl = new URL(url.pathname + url.search, 'https://tapowan-school.vercel.app');

      const headers = new Headers(request.headers);
      headers.set('X-Forwarded-Host', url.host);
      headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

      const hasBody = !['GET', 'HEAD'].includes(request.method);
      let bodyData = undefined;
      if (hasBody) {
        try {
          bodyData = await request.arrayBuffer();
        } catch (_) {
          bodyData = request.body;
        }
      }

      const modifiedRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: bodyData,
        redirect: 'manual'
      });

      try {
        let response = await fetch(modifiedRequest);

        // Failover if primary returns 502/503/504
        if (response.status >= 502 && response.status <= 504) {
          try {
            const backupUrl = new URL(url.pathname + url.search, 'https://tapowan-app.vercel.app');
            const backupReq = new Request(backupUrl.toString(), {
              method: request.method,
              headers: headers,
              body: bodyData,
              redirect: 'manual'
            });
            const backupRes = await fetch(backupReq);
            if (backupRes.status < 500) {
              response = backupRes;
            }
          } catch (_) {}
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        newHeaders.set('Access-Control-Allow-Headers', '*');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (err) {
        // Failover on network error
        try {
          const backupUrl = new URL(url.pathname + url.search, 'https://tapowan-app.vercel.app');
          const backupReq = new Request(backupUrl.toString(), {
            method: request.method,
            headers: headers,
            body: bodyData,
            redirect: 'manual'
          });
          const backupRes = await fetch(backupReq);
          const newHeaders = new Headers(backupRes.headers);
          newHeaders.set('Access-Control-Allow-Origin', '*');
          newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
          newHeaders.set('Access-Control-Allow-Headers', '*');

          return new Response(backupRes.body, {
            status: backupRes.status,
            statusText: backupRes.statusText,
            headers: newHeaders
          });
        } catch (backupErr) {
          return new Response(JSON.stringify({ ok: false, error: 'Edge Proxy error: ' + err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      }
    }

    // 3. Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
