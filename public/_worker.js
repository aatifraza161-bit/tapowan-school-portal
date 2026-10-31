/**
 * Cloudflare Pages Advanced Edge Router & Zero-Latency Database Proxy
 * Tapowan Public School / EduCore Multi-Tenant Portal
 *
 * Runs natively on Cloudflare's Global Edge network with UNLIMITED bandwidth.
 * Directly communicates with Turso libSQL Cloud over HTTPS v2 pipeline for sub-5ms queries.
 */

const TURSO_HTTP_URL = 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400"
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}

function formatPipelineArgs(args) {
  if (!args || !Array.isArray(args)) return [];
  return args.map(arg => {
    if (arg === null || arg === undefined) return { type: 'null' };
    if (typeof arg === 'number') {
      return Number.isInteger(arg) ? { type: 'integer', value: String(arg) } : { type: 'float', value: arg };
    }
    if (typeof arg === 'boolean') return { type: 'integer', value: arg ? '1' : '0' };
    return { type: 'text', value: String(arg) };
  });
}

function parsePipelineResult(resultItem) {
  if (!resultItem) return { rows: [], columns: [], rowsAffected: 0 };
  if (resultItem.type === 'error') {
    throw new Error(resultItem.error?.message || 'Turso pipeline query error');
  }
  const cols = (resultItem.response?.result?.cols || []).map(c => c.name);
  const rawRows = resultItem.response?.result?.rows || [];
  const rows = rawRows.map(rowTuple => {
    const row = {};
    cols.forEach((colName, idx) => {
      const cell = rowTuple[idx];
      if (!cell || cell.type === 'null') {
        row[colName] = null;
      } else if (cell.type === 'integer') {
        row[colName] = Number(cell.value);
      } else {
        row[colName] = cell.value;
      }
    });
    return row;
  });
  return {
    rows,
    columns: cols,
    rowsAffected: resultItem.response?.result?.affected_row_count || 0,
    lastInsertRowid: resultItem.response?.result?.last_insert_rowid ? String(resultItem.response.result.last_insert_rowid) : null
  };
}

async function executeTursoPipeline(requests) {
  const payload = { requests: [...requests, { type: 'close' }] };
  const res = await fetch(`${TURSO_HTTP_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Turso HTTP Error (${res.status}): ${errText}`);
  }
  const json = await res.json();
  return json.results || [];
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. CORS Preflight OPTIONS
    if (request.method === "OPTIONS" && (url.pathname.startsWith('/api/') || url.pathname === '/api')) {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // 2. Fast Edge Postal Geocoding
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
            return jsonResponse({
              success: true,
              state: first.State || '',
              district: first.District || '',
              postOffices: poList.map(p => p.Name)
            }, 200, { 'Cache-Control': 'public, max-age=86400' });
          }
        } catch (_) {}
      }
    }

    // 3. ZERO-LATENCY EDGE DATABASE PROXY (Native Turso Cloud Execution)
    // Runs directly on Cloudflare Edge with 0ms cold starts & unlimited bandwidth
    if (url.pathname === '/api/db/query' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const sql = body.sql || '';
        const args = Array.isArray(body.args) ? body.args : [];
        if (!sql || typeof sql !== 'string') {
          return jsonResponse({ error: 'Missing SQL query' }, 400);
        }
        const results = await executeTursoPipeline([
          { type: 'execute', stmt: { sql, args: formatPipelineArgs(args) } }
        ]);
        const parsed = parsePipelineResult(results[0]);
        return jsonResponse(parsed);
      } catch (err) {
        console.error('[Edge DB Query Error]', err.message);
        return jsonResponse({ error: err.message }, 500);
      }
    }

    if (url.pathname === '/api/db/batch' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const statements = Array.isArray(body.statements) ? body.statements : [];
        if (!statements.length) {
          return jsonResponse({ error: 'Missing statements array' }, 400);
        }
        const requests = statements.map(s => {
          const sql = typeof s === 'string' ? s : s.sql;
          const args = typeof s === 'object' && s.args ? s.args : [];
          return { type: 'execute', stmt: { sql, args: formatPipelineArgs(args) } };
        });
        const results = await executeTursoPipeline(requests);
        const parsed = results.slice(0, statements.length).map(r => parsePipelineResult(r));
        return jsonResponse({ results: parsed });
      } catch (err) {
        console.error('[Edge DB Batch Error]', err.message);
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // 4. Edge Online Fee Requests (Pending)
    if (url.pathname === '/api/online-payments/pending' && request.method === 'GET') {
      try {
        const results = await executeTursoPipeline([
          {
            type: 'execute',
            stmt: {
              sql: `SELECT id, admission_no, student_name, class_name, roll_no, amount, status, payId, payment_method, utr_number, remarks, created_at 
                    FROM app_online_payments 
                    WHERE status = 'Pending Verification' OR status = 'Pending' 
                    ORDER BY id DESC LIMIT 100`,
              args: []
            }
          }
        ]);
        const parsed = parsePipelineResult(results[0]);
        return jsonResponse({ ok: true, payments: parsed.rows || [], count: (parsed.rows || []).length });
      } catch (err) {
        return jsonResponse({ ok: false, count: 0, payments: [] });
      }
    }

    // 5. Reverse proxy /api/* requests to dedicated backend with smart edge fallback
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

        // If backend returned 402 (Payment required / disabled) or 502-504
        if (response.status === 402 || (response.status >= 502 && response.status <= 504)) {
          // Check if we can fulfill this from Edge Turso directly!
          if (url.pathname === '/api/store' && request.method === 'GET') {
            try {
              const tables = [
                'students', 'teachers', 'classes', 'subjects', 'attendance', 
                'teacherAttendance', 'exams', 'examSchedules', 'fees', 'timetable', 
                'users', 'dueManagement', 'settings', 'feeStructures', 'holidays', 
                'app_device_registry', 'app_online_payments'
              ];
              const batchReqs = tables.map(t => ({ type: 'execute', stmt: { sql: `SELECT * FROM ${t} ORDER BY id DESC`, args: [] } }));
              const rawRes = await executeTursoPipeline(batchReqs);
              const store = {};
              tables.forEach((t, i) => {
                store[t] = parsePipelineResult(rawRes[i]).rows || [];
              });
              return jsonResponse(store, 200, { 'Cache-Control': 'no-store' });
            } catch (storeErr) {
              console.error('[Edge Store Fallback Error]', storeErr.message);
            }
          }

          if (url.pathname.startsWith('/api/modules/') && request.method === 'GET') {
            try {
              const moduleName = url.pathname.replace('/api/modules/', '').split('/')[0].split('?')[0];
              if (moduleName && /^[a-zA-Z0-9_]+$/.test(moduleName)) {
                const modRes = await executeTursoPipeline([
                  { type: 'execute', stmt: { sql: `SELECT * FROM ${moduleName} ORDER BY id DESC`, args: [] } }
                ]);
                const parsed = parsePipelineResult(modRes[0]);
                return jsonResponse(parsed.rows || [], 200, { 'Cache-Control': 'no-store' });
              }
            } catch (_) {}
          }

          // Try secondary backend
          try {
            const backupUrl = new URL(url.pathname + url.search, 'https://tapowan-app.vercel.app');
            const backupReq = new Request(backupUrl.toString(), {
              method: request.method,
              headers: headers,
              body: bodyData,
              redirect: 'manual'
            });
            const backupRes = await fetch(backupReq);
            if (backupRes.status < 400) {
              response = backupRes;
            }
          } catch (_) {}
        }

        const newHeaders = new Headers(response.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (err) {
        return jsonResponse({ ok: false, error: 'Edge Proxy connection notice: ' + err.message }, 502);
      }
    }

    // 6. Direct fallback for APK downloads: ALWAYS redirect to GitHub releases (0 bandwidth from origin)
    if (url.pathname.endsWith('.apk') || url.pathname.includes('/TPS-Original-App')) {
      return Response.redirect('https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk', 302);
    }

    // 7. Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
