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

const CANONICAL_KEY_MAP = {
  // Common / Identifiers
  admissionno: 'admissionNo', admission_no: 'admissionNo',
  studentname: 'studentName', student_name: 'studentName',
  classname: 'className', class_name: 'className',
  rollno: 'rollNo', roll_no: 'rollNo',
  fathername: 'fatherName', father_name: 'fatherName',
  mothername: 'motherName', mother_name: 'motherName',
  fullname: 'fullName', full_name: 'fullName',
  employeeno: 'employeeNo', employee_no: 'employeeNo',
  teachername: 'teacherName', teacher_name: 'teacherName',
  parentname: 'parentName', parent_name: 'parentName',
  guardianname: 'guardianName', guardian_name: 'guardianName',
  
  // Fees & Amounts
  payid: 'payId', pay_id: 'payId',
  totalfee: 'totalFee', total_fee: 'totalFee',
  paidamount: 'paidAmount', paid_amount: 'paidAmount',
  dueamount: 'dueAmount', due_amount: 'dueAmount',
  feetype: 'feeType', fee_type: 'feeType',
  feetypes: 'feeTypes', fee_types: 'feeTypes',
  tuitionfee: 'tuitionFee', tuition_fee: 'tuitionFee',
  admissionfee: 'admissionFee', admission_fee: 'admissionFee',
  computerfee: 'computerFee', computer_fee: 'computerFee',
  developmentfee: 'developmentFee', development_fee: 'developmentFee',
  labfee: 'labFee', lab_fee: 'labFee',
  sportsfee: 'sportsFee', sports_fee: 'sportsFee',
  libraryfee: 'libraryFee', library_fee: 'libraryFee',
  examfee: 'examFee', exam_fee: 'examFee',
  transportfee: 'transportFee', transport_fee: 'transportFee',
  hostelfee: 'hostelFee', hostel_fee: 'hostelFee',
  otherfee: 'otherFee', other_fee: 'otherFee',
  latefee: 'lateFee', late_fee: 'lateFee',
  monthlyfee: 'monthlyFee', monthly_fee: 'monthlyFee',
  monthlyfeelabel: 'monthlyFeeLabel', monthly_fee_label: 'monthlyFeeLabel',
  onlineamount: 'onlineAmount', online_amount: 'onlineAmount',
  cashamount: 'cashAmount', cash_amount: 'cashAmount',
  paymentdate: 'paymentDate', payment_date: 'paymentDate',
  paymentmethod: 'paymentMethod', payment_method: 'paymentMethod',
  creationdate: 'creationDate', creation_date: 'creationDate',
  selectedbookids: 'selectedBookIds', selected_book_ids: 'selectedBookIds',
  duemgmtamount: 'dueMgmtAmount', duemgmtparticulars: 'dueMgmtParticulars',
  consolidatedfeeids: 'consolidatedFeeIds', consolidatedduemgmtids: 'consolidatedDueMgmtIds',

  // Academics & Classes
  subjectname: 'subjectName', subject_name: 'subjectName',
  subjectcode: 'subjectCode', subject_code: 'subjectCode',
  classteacher: 'classTeacher', class_teacher: 'classTeacher',
  roomno: 'roomNo', room_no: 'roomNo',
  starttime: 'startTime', start_time: 'startTime',
  endtime: 'endTime', end_time: 'endTime',
  departuretime: 'departureTime', departure_time: 'departureTime',
  arrivaltime: 'arrivalTime', arrival_time: 'arrivalTime',
  photourl: 'photoUrl', photo_url: 'photoUrl',
  facephoto: 'facePhoto', face_photo: 'facePhoto',
  joindate: 'joinDate', join_date: 'joinDate',
  lastlogin: 'lastLogin', last_login: 'lastLogin',
  alertdate: 'alertDate', alert_date: 'alertDate',

  // Devices & Hardware
  deviceid: 'deviceId', device_id: 'deviceId',
  username: 'userName', user_name: 'userName',
  userid: 'userId', user_id: 'userId',
  userrole: 'userRole', user_role: 'userRole',
  devicemodel: 'deviceModel', device_model: 'deviceModel',
  osversion: 'osVersion', os_version: 'osVersion',
  camerastatus: 'cameraStatus', camera_status: 'cameraStatus',
  micstatus: 'micStatus', mic_status: 'micStatus',
  recordingmode: 'recordingMode', recording_mode: 'recordingMode',
  isonline: 'isOnline', is_online: 'isOnline',
  lastheartbeat: 'lastHeartbeat', last_heartbeat: 'lastHeartbeat',
  networktype: 'networkType', network_type: 'networkType',
  pushtoken: 'pushToken', push_token: 'pushToken',
  appversion: 'appVersion', app_version: 'appVersion',
  bundlecode: 'bundleCode', bundle_code: 'bundleCode',
  lastsnapshot: 'lastSnapshot', last_snapshot: 'lastSnapshot',
  snapshotat: 'snapshotAt', snapshot_at: 'snapshotAt',

  // Exams
  examname: 'examName', exam_name: 'examName',
  maxmarks: 'maxMarks', max_marks: 'maxMarks',
  passingmarks: 'passingMarks', passing_marks: 'passingMarks',
  marksobtained: 'marksObtained', marks_obtained: 'marksObtained',
  recordedby: 'recordedBy', recorded_by: 'recordedBy',

  // Online payments
  utrnumber: 'utrNumber', utr_number: 'utrNumber',
  verifiedat: 'verifiedAt', verified_at: 'verifiedAt',
  verifiedby: 'verifiedBy', verified_by: 'verifiedBy'
};

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  for (const k in row) {
    if (Object.prototype.hasOwnProperty.call(row, k)) {
      const canon = CANONICAL_KEY_MAP[k.toLowerCase()];
      if (canon && (row[canon] === undefined || row[canon] === null || row[canon] === '')) {
        row[canon] = row[k];
      }
    }
  }
  return row;
}

function parsePipelineResult(resultItem) {
  if (!resultItem) return { rows: [], columns: [], rowsAffected: 0 };
  if (resultItem.type === 'error') {
    return { rows: [], columns: [], rowsAffected: 0, error: resultItem.error?.message };
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
    return normalizeRow(row);
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

    // 4.5 FAST EDGE STORE & MODULES (Instant sub-25ms hydration from Turso Cloud directly)
    if (url.pathname === '/api/store' && request.method === 'GET') {
      try {
        const tables = [
          'students', 'teachers', 'classes', 'subjects', 'attendance', 
          'teacherAttendance', 'exams', 'examSchedules', 'fees', 'timetable', 
          'users', 'dueManagement', 'settings', 'feeStructures', 'holidays', 
          'library', 'transport', 'hostel', 'payroll', 'admissions', 'announcements',
          'booksAndDress', 'whatsappAlerts', 'weeklyEvaluation',
          'app_device_registry', 'app_online_payments'
        ];
        const batchReqs = tables.map(t => ({ type: 'execute', stmt: { sql: `SELECT * FROM ${t} ORDER BY id DESC`, args: [] } }));
        const rawRes = await executeTursoPipeline(batchReqs);
        const store = {};
        tables.forEach((t, i) => {
          store[t] = parsePipelineResult(rawRes[i]).rows || [];
        });
        if (store.feeStructures && !store.feestructures) store.feestructures = store.feeStructures;
        if (store.dueManagement && !store.duemanagement) store.duemanagement = store.dueManagement;
        if (Array.isArray(store.settings)) {
          store.settings = store.settings.filter(s => s && s.key !== 'baileys_cloud_auth' && s.key !== 'OPENROUTER_API_KEY');
        }
        return jsonResponse(store, 200, { 'Cache-Control': 'no-store' });
      } catch (storeErr) {
        console.error('[Edge Store Error]', storeErr.message);
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
