const fs = require('fs');
const path = require('path');

// 1. PATCH public/app.js
const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let appContent = fs.readFileSync(appJsPath, 'utf8');

const oldCheck = `  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("Vercel/Netlify Deployment Protection is active. Please use the production URL or disable Authentication in project settings.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    
    const fullMessage = payload.message ? \`\${payload.error}: \${payload.message}\` : payload.error;
    throw new Error(fullMessage || "Request failed");
  }`;

const newCheck = `  if (!response.ok) {
    let errorMessage = \`Request failed (\${response.status})\`;
    const cType = response.headers.get("content-type") || "";
    if (cType.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      errorMessage = payload.message ? \`\${payload.error}: \${payload.message}\` : (payload.error || errorMessage);
    } else {
      const text = await response.text().catch(() => "");
      if (text && text.length < 200 && !text.includes("<!DOCTYPE") && !text.includes("<html")) {
        errorMessage = text.trim();
      } else {
        errorMessage = \`Server temporarily unavailable (\${response.status} \${response.statusText || ""})\`.trim();
      }
    }
    throw new Error(errorMessage);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error(\`Endpoint '\${path}' returned an unexpected HTML response instead of JSON. The service may be updating.\`);
  }`;

if (appContent.includes(oldCheck)) {
  appContent = appContent.replace(oldCheck, newCheck);
  console.log('✓ Replaced Vercel/Netlify Deployment Protection in app.js (LF)');
} else {
  const oldCheckCRLF = oldCheck.replace(/\n/g, '\r\n');
  const newCheckCRLF = newCheck.replace(/\n/g, '\r\n');
  if (appContent.includes(oldCheckCRLF)) {
    appContent = appContent.replace(oldCheckCRLF, newCheckCRLF);
    console.log('✓ Replaced Vercel/Netlify Deployment Protection in app.js (CRLF)');
  } else {
    console.warn('Could not find oldCheck in app.js');
  }
}

// Also update line 11603 if it still points to vercel
const oldTursoProxy = "TURSO_PROXY_URL = 'https://tapowan-school.vercel.app/api/db/batch'";
const newTursoProxy = "TURSO_PROXY_URL = 'https://tapowan-school.pages.dev/api/db/batch'";
if (appContent.includes(oldTursoProxy)) {
  appContent = appContent.replace(oldTursoProxy, newTursoProxy);
  console.log('✓ Updated TURSO_PROXY_URL to point to Cloudflare Pages');
}

fs.writeFileSync(appJsPath, appContent, 'utf8');

// 2. PATCH public/_worker.js to add native edge IVR routes
const workerJsPath = path.join(__dirname, '..', 'public', '_worker.js');
let workerContent = fs.readFileSync(workerJsPath, 'utf8');

const targetSection = `    // 5. Reverse proxy /api/* requests to dedicated backend with smart edge fallback`;

const ivrEdgeCode = `    // 4.9 EDGE IVR & CALL AUTOMATION ENGINE (Zero 404s, direct Turso execution)
    if (url.pathname === '/api/calls/ivr/target-students' && request.method === 'GET') {
      try {
        const className = url.searchParams.get('className') || '';
        const minDue = Number(url.searchParams.get('minDue') || 0);
        const search = url.searchParams.get('search') || '';

        let whereClauses = ["d.status IN ('Pending', 'Partial')", "CAST(d.balance AS REAL) > 0"];
        let args = [];

        if (className && className !== 'All') {
          whereClauses.push("(d.className = ? OR s.className = ?)");
          args.push(className, className);
        }

        if (minDue > 0) {
          whereClauses.push("CAST(d.balance AS REAL) >= ?");
          args.push(minDue);
        }

        if (search && search.trim()) {
          const s = \`%\${search.trim().toLowerCase()}%\`;
          whereClauses.push("(LOWER(d.admissionNo) LIKE ? OR LOWER(d.studentName) LIKE ? OR LOWER(s.fullName) LIKE ? OR s.phone LIKE ?)");
          args.push(s, s, s, s);
        }

        const sql = \`
          SELECT 
            d.admissionNo,
            COALESCE(s.fullName, d.studentName) as studentName,
            COALESCE(s.className, d.className) as className,
            COALESCE(s.phone, '') as phone,
            s.rollNo,
            SUM(CAST(d.balance AS REAL)) as totalDue,
            COUNT(d.id) as dueCount,
            GROUP_CONCAT(d.particulars || ' (' || d.month || '): ₹' || d.balance, '; ') as particularsSummary
          FROM duemanagement d
          LEFT JOIN students s ON s.admissionNo = d.admissionNo
          WHERE \${whereClauses.join(' AND ')}
          GROUP BY d.admissionNo
          ORDER BY totalDue DESC
          LIMIT 100
        \`;

        const res = await executeTursoPipeline([{ type: 'execute', stmt: { sql, args } }]);
        const parsed = parsePipelineResult(res[0]);
        const students = (parsed.rows || []).map(st => {
          const adm = st.admissionNo || st.admissionno || '';
          return {
            admissionNo: adm,
            studentName: st.studentName || st.studentname || '',
            className: st.className || st.classname || '',
            phone: st.phone || '',
            rollNo: st.rollNo || st.rollno || '',
            totalDue: Math.round(Number(st.totalDue || st.totaldue || 0)),
            dueCount: Number(st.dueCount || st.duecount || 1),
            particularsSummary: st.particularsSummary || st.particularssummary || '',
            hasAppInstalled: true
          };
        });

        return jsonResponse({ ok: true, count: students.length, students }, 200, { 'Cache-Control': 'no-store' });
      } catch (ivrErr) {
        return jsonResponse({ ok: false, error: ivrErr.message, students: [] }, 500);
      }
    }

    if (url.pathname === '/api/calls/ivr/stats' && request.method === 'GET') {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
        const sql = \`
          SELECT 
            COUNT(id) as totalCalls,
            SUM(CASE WHEN status = 'completed' OR duration_sec > 5 THEN 1 ELSE 0 END) as answeredCalls,
            SUM(CASE WHEN key_pressed = '1' THEN 1 ELSE 0 END) as pressedOne,
            SUM(CASE WHEN payment_link_sent = 1 THEN 1 ELSE 0 END) as linksSent,
            SUM(due_amount) as totalDueReminded
          FROM app_ivr_call_logs
          WHERE created_at >= ?
        \`;
        const res = await executeTursoPipeline([{ type: 'execute', stmt: { sql, args: [since] } }]);
        const parsed = parsePipelineResult(res[0]);
        const r = (parsed.rows && parsed.rows[0]) || {};
        return jsonResponse({
          ok: true,
          stats: {
            totalCalls: Number(r.totalCalls || r.totalcalls || 0),
            answeredCalls: Number(r.answeredCalls || r.answeredcalls || 0),
            pressedOne: Number(r.pressedOne || r.pressedone || 0),
            linksSent: Number(r.linksSent || r.linkssent || 0),
            totalDueReminded: Math.round(Number(r.totalDueReminded || r.totalduereminded || 0))
          }
        }, 200, { 'Cache-Control': 'no-store' });
      } catch (err) {
        return jsonResponse({
          ok: true,
          stats: { totalCalls: 0, answeredCalls: 0, pressedOne: 0, linksSent: 0, totalDueReminded: 0 }
        }, 200);
      }
    }

    if (url.pathname === '/api/calls/ivr/tts-audio' && request.method === 'GET') {
      try {
        const rawText = String(url.searchParams.get('text') || url.searchParams.get('q') || '').trim();
        const lang = String(url.searchParams.get('lang') || 'hi').trim().toLowerCase();
        if (!rawText) {
          return new Response('Missing text', { status: 400 });
        }
        const ttsUrl = \`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=\${encodeURIComponent(lang)}&q=\${encodeURIComponent(rawText.slice(0, 180))}\`;
        const ttsRes = await fetch(ttsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://translate.google.com/'
          }
        });
        const audioData = await ttsRes.arrayBuffer();
        return new Response(audioData, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400',
            ...CORS_HEADERS
          }
        });
      } catch (ttsErr) {
        return new Response('TTS error: ' + ttsErr.message, { status: 500, headers: CORS_HEADERS });
      }
    }

    if (url.pathname === '/api/calls/ivr/logs' && request.method === 'GET') {
      try {
        const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
        const res = await executeTursoPipeline([
          { type: 'execute', stmt: { sql: 'SELECT * FROM app_ivr_call_logs ORDER BY id DESC LIMIT ?', args: [limit] } }
        ]);
        const parsed = parsePipelineResult(res[0]);
        return jsonResponse({ ok: true, logs: parsed.rows || [], total: (parsed.rows || []).length }, 200, { 'Cache-Control': 'no-store' });
      } catch (logsErr) {
        return jsonResponse({ ok: true, logs: [], total: 0 }, 200);
      }
    }

`;

if (!workerContent.includes('/api/calls/ivr/target-students')) {
  if (workerContent.includes(targetSection)) {
    workerContent = workerContent.replace(targetSection, ivrEdgeCode + targetSection);
    console.log('✓ Added Edge IVR routes to _worker.js');
  } else {
    console.warn('targetSection not found in _worker.js');
  }
} else {
  console.log('Edge IVR routes already present in _worker.js');
}

fs.writeFileSync(workerJsPath, workerContent, 'utf8');
console.log('Finished updating app.js and _worker.js!');
