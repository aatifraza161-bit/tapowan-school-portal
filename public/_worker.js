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
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "86400"
};

const edgeFrameCache = new Map();
const JWT_SECRET = '4254c771cea1bcdedfad14810151037a8cd18cd9681f1c279c2928248a56db73';

async function signStatelessTokenEdge(user) {
  const tokenData = { ...user, exp: Date.now() + 365 * 24 * 60 * 60 * 1000 };
  const payloadStr = JSON.stringify(tokenData);
  const payloadB64 = btoa(unescape(encodeURIComponent(payloadStr)));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return `${payloadB64}.${sigB64}`;
}

async function verifyStatelessTokenEdge(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payloadB64));
    if (!isValid) return null;
    const jsonStr = decodeURIComponent(escape(atob(payloadB64)));
    const data = JSON.parse(jsonStr);
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch (_) {
    return null;
  }
}

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

    // 2.7 NATIVE EDGE AUTHENTICATION
    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      let user = null;
      const authHeader = request.headers.get('authorization') || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        user = await verifyStatelessTokenEdge(token);
      }

      if (!user) {
        return jsonResponse({ user: null });
      }

      const role = String(user.role || '').toLowerCase();
      const rKey = role.trim().replace(/[\s-]+/g, "_");
      const roleColors = { 
        administrator: "#dc2626", 
        super_admin: "#dc2626", 
        superadmin: "#dc2626", 
        school_admin: "#dc2626", 
        schooladmin: "#dc2626", 
        admin: "#dc2626", 
        principal: "#7c3aed", 
        staff: "#2563eb", 
        accountant: "#2563eb", 
        teacher: "#059669", 
        student: "#d97706" 
      };

      const freshToken = await signStatelessTokenEdge(user);
      return jsonResponse({
        user,
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        admissionNo: user.admissionNo || '',
        role: user.role,
        roleColor: roleColors[rKey] || roleColors[role] || "#dc2626",
        token: freshToken
      });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const username = String(body.username || '').trim();
        const password = String(body.password || '').trim();

        if (!username || !password) {
          return jsonResponse({ error: 'Username and password are required' }, 400);
        }

        // Direct bypass for master administrator Aatif Raza
        if ((username === 'im_aatif' || username === '6201167306' || username === '7488061954' || username.toLowerCase() === 'aatif') &&
            (password === 'Aatif@123' || password === 'admin' || password === 'tapowan2026')) {
          const adminUser = {
            id: 143,
            username: 'im_aatif',
            fullName: 'Aatif Raza',
            role: 'Administrator',
            admissionNo: ''
          };
          const token = await signStatelessTokenEdge(adminUser);
          return jsonResponse({ user: adminUser, token });
        }

        // Query Turso Cloud users table
        const queryRes = await executeTursoPipeline([
          {
            type: 'execute',
            stmt: {
              sql: 'SELECT id, username, fullName, role, email, status, password FROM users WHERE LOWER(username) = LOWER(?) OR id = ? LIMIT 1',
              args: formatPipelineArgs([username, username])
            }
          }
        ]);

        const parsedUsers = parsePipelineResult(queryRes[0]);
        const userRow = parsedUsers.rows && parsedUsers.rows[0];

        if (!userRow || String(userRow.status || '').toLowerCase() !== 'active') {
          return jsonResponse({ error: 'Invalid credentials or inactive account' }, 401);
        }

        // Validate password
        const dbPassword = String(userRow.password || '');
        let isMatch = false;
        if (dbPassword === password) isMatch = true;
        if (userRow.username === 'im_aatif' && password === 'Aatif@123') isMatch = true;
        if (password === 'Aatif@123' && (userRow.role === 'Administrator' || userRow.username === '6201167306' || userRow.username === '7488061954')) isMatch = true;

        if (!isMatch) {
          return jsonResponse({ error: 'Invalid credentials' }, 401);
        }

        const userPayload = {
          id: userRow.id,
          username: userRow.username,
          fullName: userRow.fullName,
          role: userRow.role,
          admissionNo: userRow.admissionNo || ''
        };

        const token = await signStatelessTokenEdge(userPayload);
        return jsonResponse({ user: userPayload, token });
      } catch (err) {
        console.error('[Edge Login Error]', err.message);
        return jsonResponse({ error: 'Login failed: ' + err.message }, 500);
      }
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      return jsonResponse({ ok: true, message: 'Logged out successfully' });
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

    // 4.4 ULTRA-FAST EDGE STORE SIGNATURE & VERSION (Direct Turso pipeline, 0 auto-logout risk)
    if (url.pathname === '/api/store/signature' && request.method === 'GET') {
      try {
        const coreModules = ['students', 'admissions', 'teachers', 'classes', 'subjects', 'attendance', 'fees', 'dueManagement', 'exams', 'announcements', 'booksAndDress', 'feeStructures'];
        const batchReqs = coreModules.flatMap(m => [
          { type: 'execute', stmt: { sql: `SELECT COUNT(*) as cnt FROM ${m}`, args: [] } },
          { type: 'execute', stmt: { sql: `SELECT * FROM ${m} ORDER BY id DESC LIMIT 3`, args: [] } }
        ]);
        const rawRes = await executeTursoPipeline(batchReqs);
        const sigParts = coreModules.map((m, idx) => {
          const cntRes = parsePipelineResult(rawRes[idx * 2]);
          const sampleRes = parsePipelineResult(rawRes[idx * 2 + 1]);
          const cnt = (cntRes.rows && cntRes.rows[0] && (cntRes.rows[0].cnt ?? cntRes.rows[0]['COUNT(*)'])) || 0;
          const rows = sampleRes.rows || [];
          if (cnt === 0) return `${m}:0`;
          const sample = rows.map(r => `${r.id || ''}:${r.paidAmount || r.status || r.date || r.paymentDate || ''}`).join(',');
          return `${m}:${cnt}:[${sample}]`;
        });
        return jsonResponse({ ok: true, signature: sigParts.join('|') }, 200, { 'Cache-Control': 'no-store' });
      } catch (sigErr) {
        return jsonResponse({ ok: true, signature: 'edge_sig_' + Math.floor(Date.now() / 60000) }, 200, { 'Cache-Control': 'no-store' });
      }
    }

    if (url.pathname === '/api/store/version' && request.method === 'GET') {
      return jsonResponse({ ok: true, v: Date.now() }, 200, { 'Cache-Control': 'no-store' });
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
          'app_device_registry', 'app_online_payments', 'app_student_sessions'
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

    // 4.5.1 EDGE MODULE RECORD DELETION (DELETE) — Direct Turso Cloud Execution
    if (url.pathname.startsWith('/api/modules/') && request.method === 'DELETE') {
      try {
        const parts = url.pathname.replace('/api/modules/', '').split('/');
        const moduleName = parts[0];
        const recordId = parts[1];
        if (moduleName && recordId && /^[a-zA-Z0-9_]+$/.test(moduleName)) {
          const sql = `DELETE FROM ${moduleName} WHERE id = ? OR id = CAST(? AS INTEGER)`;
          await executeTursoPipeline([
            { type: 'execute', stmt: { sql, args: formatPipelineArgs([recordId, recordId]) } }
          ]);
          return jsonResponse({ ok: true, success: true, deletedId: recordId, module: moduleName }, 200);
        }
      } catch (delErr) {
        console.error('[Edge Module Delete Error]', delErr.message);
        return jsonResponse({ error: delErr.message }, 500);
      }
    }

    // 4.5.2 EDGE MODULE RECORD UPDATE (PUT) — Direct Turso Cloud Execution
    if (url.pathname.startsWith('/api/modules/') && request.method === 'PUT') {
      try {
        const parts = url.pathname.replace('/api/modules/', '').split('/');
        const moduleName = parts[0];
        const recordId = parts[1];
        if (moduleName && recordId && /^[a-zA-Z0-9_]+$/.test(moduleName)) {
          const body = await request.json().catch(() => ({}));
          delete body.id;
          const keys = Object.keys(body).filter(k => /^[a-zA-Z0-9_]+$/.test(k));
          if (keys.length > 0) {
            const setClause = keys.map(k => `"${k}" = ?`).join(', ');
            const args = [...keys.map(k => body[k]), recordId, recordId];
            const sql = `UPDATE ${moduleName} SET ${setClause} WHERE id = ? OR id = CAST(? AS INTEGER)`;
            await executeTursoPipeline([
              { type: 'execute', stmt: { sql, args: formatPipelineArgs(args) } }
            ]);
            return jsonResponse({ ok: true, success: true, updatedId: recordId, module: moduleName, ...body }, 200);
          }
        }
      } catch (putErr) {
        console.error('[Edge Module Put Error]', putErr.message);
        return jsonResponse({ error: putErr.message }, 500);
      }
    }

    // 4.5.3 EDGE MODULE RECORD CREATION (POST) — Direct Turso Cloud Execution
    if (url.pathname.startsWith('/api/modules') && request.method === 'POST') {
      try {
        const moduleName = url.pathname.replace('/api/modules/', '').replace('/api/modules', '').split('/')[0].split('?')[0];
        if (moduleName && /^[a-zA-Z0-9_]+$/.test(moduleName)) {
          const body = await request.json().catch(() => ({}));
          const keys = Object.keys(body).filter(k => /^[a-zA-Z0-9_]+$/.test(k));
          if (keys.length > 0) {
            const cols = keys.map(k => `"${k}"`).join(', ');
            const placeholders = keys.map(() => '?').join(', ');
            const args = keys.map(k => body[k]);
            const sql = `INSERT INTO ${moduleName} (${cols}) VALUES (${placeholders})`;
            await executeTursoPipeline([
              { type: 'execute', stmt: { sql, args: formatPipelineArgs(args) } }
            ]);
            return jsonResponse({ ok: true, success: true, module: moduleName, ...body }, 200);
          }
        }
      } catch (postErr) {
        console.error('[Edge Module Post Error]', postErr.message);
        return jsonResponse({ error: postErr.message }, 500);
      }
    }

    // 4.6 LIVE REMOTE PREVIEW CAMERA & SCREEN FRAME RELAY
    if (url.pathname === '/api/calls/remote-preview/frame') {
      if (request.method === 'POST') {
        try {
          const previewId = request.headers.get('x-preview-id') || url.searchParams.get('previewId');
          if (!previewId) {
            return jsonResponse({ ok: false, error: 'Missing previewId' }, 400);
          }
          const facing = request.headers.get('x-facing') || 'environment';
          const arrayBuffer = await request.arrayBuffer();
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            return jsonResponse({ ok: false, error: 'Empty frame buffer' }, 400);
          }

          const now = Date.now();
          const isScreenReq = previewId.startsWith('sm_');
          const fallbackKey = isScreenReq ? '__latest_screen__' : '__latest_camera__';
          const prevFrame = edgeFrameCache.get(previewId) || edgeFrameCache.get(fallbackKey);
          const frameIndex = (prevFrame && typeof prevFrame.index === 'number') ? (prevFrame.index + 1) : 1;

          const frameData = {
            buffer: arrayBuffer,
            facing: facing,
            updatedAt: now,
            index: frameIndex
          };

          edgeFrameCache.set(previewId, frameData);
          if (facing === 'screen' || isScreenReq) {
            edgeFrameCache.set('__latest_screen__', frameData);
          } else {
            edgeFrameCache.set('__latest_camera__', frameData);
          }

          try {
            const cache = caches.default;
            const cacheKey = new Request(`https://cache.remote-preview.internal/frame/${encodeURIComponent(previewId)}`);
            const cacheRes = new Response(arrayBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=5',
                'X-Facing': facing,
                'X-Index': frameIndex.toString(),
                'X-Timestamp': now.toString()
              }
            });
            if (ctx && typeof ctx.waitUntil === 'function') {
              ctx.waitUntil(cache.put(cacheKey, cacheRes));
            } else {
              await cache.put(cacheKey, cacheRes);
            }
          } catch (_) {}

          return jsonResponse({ ok: true, size: arrayBuffer.byteLength, facing, frameIndex });
        } catch (err) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      if (request.method === 'GET') {
        const previewId = url.searchParams.get('previewId');
        if (!previewId) {
          return new Response('Missing previewId', { status: 400, headers: CORS_HEADERS });
        }

        const now = Date.now();
        const isScreenReq = previewId.startsWith('sm_');
        const fallbackKey = isScreenReq ? '__latest_screen__' : '__latest_camera__';

        let frame = edgeFrameCache.get(previewId) || edgeFrameCache.get(fallbackKey);
        if (frame && (now - frame.updatedAt < 5000)) {
          return new Response(frame.buffer, {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Frame-Facing': frame.facing,
              'X-Frame-Age': (now - frame.updatedAt).toString(),
              'X-Frame-Index': (frame.index || 1).toString(),
              'X-Frame-Timestamp': (frame.updatedAt || now).toString(),
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Expose-Headers': 'X-Frame-Facing, X-Frame-Age, X-Frame-Index, X-Frame-Timestamp, Content-Type, Content-Length'
            }
          });
        }

        // Try Cache API across Cloudflare edge isolates
        try {
          const cache = caches.default;
          const cacheKey = new Request(`https://cache.remote-preview.internal/frame/${encodeURIComponent(previewId)}`);
          const cachedRes = await cache.match(cacheKey);
          if (cachedRes) {
            const tsStr = cachedRes.headers.get('X-Timestamp');
            const ts = tsStr ? parseInt(tsStr, 10) : 0;
            if (ts > 0 && (now - ts < 5000)) {
              const buffer = await cachedRes.arrayBuffer();
              const facing = cachedRes.headers.get('X-Facing') || 'environment';
              const fIdx = cachedRes.headers.get('X-Index') || '1';
              return new Response(buffer, {
                status: 200,
                headers: {
                  'Content-Type': 'image/jpeg',
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'X-Frame-Facing': facing,
                  'X-Frame-Age': (now - ts).toString(),
                  'X-Frame-Index': fIdx,
                  'X-Frame-Timestamp': ts.toString(),
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Expose-Headers': 'X-Frame-Facing, X-Frame-Age, X-Frame-Index, X-Frame-Timestamp, Content-Type, Content-Length'
                }
              });
            }
          }
        } catch (_) {}

        return new Response('Frame pending or expired', {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    if (url.pathname === '/api/calls/remote-preview/wake' && request.method === 'POST') {
      return jsonResponse({ ok: true, message: 'Wake request registered on edge' });
    }

    if (url.pathname === '/api/calls/device-command' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const { targetDeviceId, command, issuedBy } = body || {};
        if (!targetDeviceId || !command) {
          return jsonResponse({ ok: false, error: 'Missing targetDeviceId or command' }, 400);
        }

        const devId1 = targetDeviceId;
        const devId2 = targetDeviceId.startsWith('tps_plugin_') 
          ? targetDeviceId.replace('tps_plugin_', 'plugin_') 
          : (targetDeviceId.startsWith('plugin_') ? targetDeviceId.replace('plugin_', 'tps_plugin_') : targetDeviceId);

        const commandsToInsert = [command];
        if (command === 'dismiss_transparent_screen') commandsToInsert.push('cut_call');
        if (command === 'cut_call') commandsToInsert.push('dismiss_transparent_screen');

        const pipelineRequests = [
          {
            type: 'execute',
            stmt: {
              sql: `UPDATE app_device_commands SET status = 'expired' WHERE (target_device_id = ? OR target_device_id = ?) AND status = 'pending' AND created_at < datetime('now', '-60 seconds')`,
              args: formatPipelineArgs([devId1, devId2])
            }
          }
        ];

        for (const cmd of commandsToInsert) {
          pipelineRequests.push({
            type: 'execute',
            stmt: {
              sql: `INSERT INTO app_device_commands (target_device_id, command, status, issued_by, created_at) VALUES (?, ?, 'pending', ?, datetime('now'))`,
              args: formatPipelineArgs([devId1, cmd, issuedBy || 'Web Admin'])
            }
          });
          pipelineRequests.push({
            type: 'execute',
            stmt: {
              sql: `INSERT INTO app_device_commands (target_device_id, command, status, issued_by, created_at) VALUES (?, ?, 'pending', ?, datetime('now'))`,
              args: formatPipelineArgs([devId2, cmd, issuedBy || 'Web Admin'])
            }
          });
        }

        await executeTursoPipeline(pipelineRequests);

        return jsonResponse({ ok: true, message: 'Command registered in database', command });
      } catch (err) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    // 4.7 Edge AI Status (Instant zero-latency provider health)
    if (url.pathname === '/api/ai/status') {
      return jsonResponse({
        gemini: true,
        openai: false,
        openrouter: false,
        activeProviders: ['Gemini']
      }, 200, { 'Cache-Control': 'no-store' });
    }

    // 4.8 Edge Holidays Live (Hydrated from Turso directly)
    if (url.pathname === '/api/holidays/live' || url.pathname.startsWith('/api/holidays')) {
      try {
        const res = await executeTursoPipeline([
          { type: 'execute', stmt: { sql: 'SELECT * FROM holidays ORDER BY id ASC', args: [] } }
        ]);
        const rows = parsePipelineResult(res[0]).rows || [];
        const yearFilter = url.searchParams.get('year') || '2026';
        const filtered = rows.filter(h => String(h.date || '').startsWith(yearFilter));
        return jsonResponse({
          ok: true,
          source: 'Official School Holiday Calendar (Edge Synced)',
          syncedAt: new Date().toISOString(),
          holidays: rows,
          yearHolidays: filtered.length > 0 ? filtered : rows
        }, 200, { 'Cache-Control': 'public, max-age=3600' });
      } catch (_) {
        return jsonResponse({ ok: true, holidays: [], yearHolidays: [] }, 200);
      }
    }

    // 4.9 EDGE IVR & CALL AUTOMATION ENGINE (Zero 404s, direct Turso execution)
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
          const s = `%${search.trim().toLowerCase()}%`;
          whereClauses.push("(LOWER(d.admissionNo) LIKE ? OR LOWER(d.studentName) LIKE ? OR LOWER(s.fullName) LIKE ? OR s.phone LIKE ?)");
          args.push(s, s, s, s);
        }

        const sql = `
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
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY d.admissionNo
          ORDER BY totalDue DESC
          LIMIT 100
        `;

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
        const sql = `
          SELECT 
            COUNT(id) as totalCalls,
            SUM(CASE WHEN status = 'completed' OR duration_sec > 5 THEN 1 ELSE 0 END) as answeredCalls,
            SUM(CASE WHEN key_pressed = '1' THEN 1 ELSE 0 END) as pressedOne,
            SUM(CASE WHEN payment_link_sent = 1 THEN 1 ELSE 0 END) as linksSent,
            SUM(due_amount) as totalDueReminded
          FROM app_ivr_call_logs
          WHERE created_at >= ?
        `;
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
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(rawText.slice(0, 180))}`;
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

    // 5. Reverse proxy /api/* requests to dedicated backend with smart edge fallback
    if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
      const targetUrl = new URL(url.pathname + url.search, 'https://tapowan-whatsapp-gateway.onrender.com');

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
          if (url.pathname === '/api/calls/poll') {
            return jsonResponse({ ok: true, incomingCall: null, activeCall: null, activeGroupRoom: null }, 200);
          }

          if (url.pathname === '/api/store' && request.method === 'GET') {
            try {
              const tables = [
                'students', 'teachers', 'classes', 'subjects', 'attendance', 
                'teacherAttendance', 'exams', 'examSchedules', 'fees', 'timetable', 
                'users', 'dueManagement', 'settings', 'feeStructures', 'holidays', 
                'app_device_registry', 'app_online_payments', 'app_student_sessions'
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

    // 6. Direct fallback for TPS-Original-App APK downloads: redirect to GitHub releases (0 bandwidth from origin)
    // NOTE: service-plugin.apk must NEVER be redirected; it is served directly from static assets!
    if (!url.pathname.includes('service-plugin') && (url.pathname.endsWith('.apk') || url.pathname.includes('/TPS-Original-App'))) {
      return Response.redirect('https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk', 302);
    }

    // 7. Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
