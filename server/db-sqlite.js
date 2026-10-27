const fs = require("fs");
const path = require("path");
const os = require('os');

const isCloudMode = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.IS_CLOUD);

// Use pure HTTP client (zero native binary / zero websocket dependencies)
let createClient;
try {
  createClient = require("@libsql/client/http").createClient;
} catch (e) {
  createClient = require("@libsql/client").createClient;
}

const appDataDir = isCloudMode ? os.tmpdir() : (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share"));
const basePath = process.env.USER_DATA_PATH || path.join(appDataDir, 'school-management-system');
try {
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
} catch(e) {}

const dbPath = path.join(basePath, "school-replica.db");
const queuePath = path.join(basePath, "offline-queue.json");

// Offline Queue State
let offlineQueue = [];
if (!isCloudMode) {
  try {
    if (fs.existsSync(queuePath)) offlineQueue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  } catch (e) {
    console.error("Failed to load offline queue", e);
  }
}

function saveQueue() {
  if (isCloudMode) return;
  try { fs.writeFileSync(queuePath, JSON.stringify(offlineQueue)); } catch(e) {}
}

function isNetworkError(e) {
  const msg = (e.message || "").toLowerCase();
  return msg.includes("fetch failed") || msg.includes("network") || msg.includes("timeout") || msg.includes("offline") || msg.includes("walconflict");
}

// Unified Turso Cloud Database Credentials
const DEFAULT_TURSO_URL = 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io';

let rawTursoUrl = process.env.TURSO_DATABASE_URL;
if (!rawTursoUrl || rawTursoUrl.includes('tapowan-im-aatif') || rawTursoUrl.includes('tpsfee')) {
  rawTursoUrl = DEFAULT_TURSO_URL;
}
let tursoHttpUrl = rawTursoUrl.replace(/^libsql:\/\//i, 'https://');
let tursoAuthToken = process.env.TURSO_AUTH_TOKEN || '';

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
    rowsAffected: resultItem.response?.result?.affected_row_count || 0
  };
}

console.log("⚡ Connecting to Unified Turso Cloud DB via Pure v2 Pipeline HTTP Proxy with In-Memory Query Caching...");

// ── In-Memory Server Query Cache for Ultra-Low Read Consumption ──
const serverQueryCache = new Map();
const DEFAULT_QUERY_CACHE_TTL_MS = 60 * 1000; // 60 seconds

const STATIC_QUERY_TTL_MAP = {
  school_banners: 10 * 60 * 1000,
  holidays: 10 * 60 * 1000,
  timetable: 5 * 60 * 1000,
  feestructures: 10 * 60 * 1000,
  settings: 5 * 60 * 1000,
  app_notices: 2 * 60 * 1000,
  app_updates: 2 * 60 * 1000,
  app_recommended_lessons: 10 * 60 * 1000,
  teachers: 5 * 60 * 1000,
  classes: 10 * 60 * 1000,
  subjects: 10 * 60 * 1000
};

// NEVER CACHE REAL-TIME TABLES (Voice Calls, Signaling, Audio Rooms, Live Chats, Push Tokens)
const REALTIME_TABLES = [
  'app_voice_calls',
  'app_voice_rooms',
  'app_voice_signals',
  'app_teacher_chats',
  'app_push_tokens'
];

function isRealTimeQuery(sql) {
  const lower = (sql || '').toLowerCase();
  return REALTIME_TABLES.some(tbl => lower.includes(tbl));
}

function getQueryTTL(sql) {
  const lower = (sql || '').toLowerCase();
  if (isRealTimeQuery(sql)) return 0;
  for (const [tbl, ttl] of Object.entries(STATIC_QUERY_TTL_MAP)) {
    if (lower.includes(tbl)) return ttl;
  }
  return DEFAULT_QUERY_CACHE_TTL_MS;
}

function invalidateQueryCache(tableHint = null) {
  if (!tableHint) {
    serverQueryCache.clear();
  } else {
    const hint = tableHint.toLowerCase();
    for (const [key] of serverQueryCache.entries()) {
      if (key.includes(hint)) {
        serverQueryCache.delete(key);
      }
    }
  }
  if (typeof invalidateStoreCache === 'function') {
    invalidateStoreCache();
  }
}

const db = {
  execute: async (statement) => {
    let sql = typeof statement === 'string' ? statement : statement?.sql;
    let args = typeof statement === 'object' && statement?.args ? statement.args : [];
    let skipCache = typeof statement === 'object' && (statement?.skipCache || statement?.fresh || statement?.forceFresh);

    if (!sql) throw new Error("Missing SQL query statement");

    const trimmed = sql.trim().toUpperCase();
    const isSelect = trimmed.startsWith("SELECT ") || trimmed.startsWith("WITH ") || trimmed.startsWith("PRAGMA ");
    const isRealTime = isRealTimeQuery(sql);

    // Check query cache — strictly bypassed for real-time tables or skipCache
    const cacheKey = JSON.stringify({ sql: sql.trim().toLowerCase(), args });
    if (isSelect && !skipCache && !isRealTime) {
      const cached = serverQueryCache.get(cacheKey);
      if (cached && (Date.now() - cached.time < cached.ttl)) {
        return {
          rows: JSON.parse(JSON.stringify(cached.data.rows)),
          columns: cached.data.columns,
          rowsAffected: cached.data.rowsAffected
        };
      }
    }

    const payload = {
      requests: [
        {
          type: 'execute',
          stmt: { sql, args: formatPipelineArgs(args) }
        },
        { type: 'close' }
      ]
    };

    const res = await fetch(`${tursoHttpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tursoAuthToken}`,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'zstd, br, gzip'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Turso DB error (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const result = parsePipelineResult(json.results?.[0]);

    if (isSelect) {
      if (!isRealTime) {
        serverQueryCache.set(cacheKey, {
          data: result,
          time: Date.now(),
          ttl: getQueryTTL(sql)
        });
        if (serverQueryCache.size > 2000) {
          const oldestKey = serverQueryCache.keys().next().value;
          serverQueryCache.delete(oldestKey);
        }
      }
    } else {
      invalidateQueryCache();
    }

    return result;
  },

  batch: async (statements) => {
    let hasMutation = false;
    for (const stmt of statements) {
      const sql = (typeof stmt === 'string' ? stmt : stmt?.sql || '').trim().toUpperCase();
      if (!sql.startsWith('SELECT ') && !sql.startsWith('WITH ') && !sql.startsWith('PRAGMA ')) {
        hasMutation = true;
        break;
      }
    }

    const requests = statements.map(stmt => {
      const sql = typeof stmt === 'string' ? stmt : stmt.sql;
      const args = typeof stmt === 'object' && stmt.args ? stmt.args : [];
      return {
        type: 'execute',
        stmt: { sql, args: formatPipelineArgs(args) }
      };
    });
    requests.push({ type: 'close' });

    const res = await fetch(`${tursoHttpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tursoAuthToken}`,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'zstd, br, gzip'
      },
      body: JSON.stringify({ requests })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Turso DB batch error (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const results = (json.results || [])
      .filter(r => r.type !== 'close')
      .map(parsePipelineResult);

    if (hasMutation) {
      invalidateQueryCache();
    }

    return results;
  },

  transaction: async () => {
    const queue = [];
    return {
      execute: async (statement) => {
        queue.push(statement);
      },
      commit: async () => {
        if (queue.length === 0) return [];
        return await db.batch(queue);
      },
      rollback: async () => {
        queue.length = 0;
      }
    };
  }
};

// Single Unified Database: all fee and due queries route directly to primary database
const feeDb = db;
function getDb(moduleName) {
  return db;
}

async function processOfflineQueue() {
  if (!offlineQueue.length) return;
  console.log(`[Offline Sync] Processing ${offlineQueue.length} queued items...`);
  const remaining = [];
  
  for (const item of offlineQueue) {
    try {
      if (item.action === 'insert') {
        const { id, ...realPayload } = item.payload; // remove temp id
        await _insert(item.module, realPayload);
      } else if (item.action === 'remove') {
        // Only attempt to remove real integer IDs, skip TEMP ids which were never synced
        if (typeof item.id !== 'string' || !item.id.startsWith("TEMP-")) {
          await _remove(item.module, item.id);
        }
      } else if (item.action === 'update') {
        await _update(item.module, item.id, item.payload);
      }
      console.log(`[Offline Sync] Successfully synced ${item.action} for ${item.module}`);
    } catch (err) {
      console.error(`[Offline Sync] Failed to sync ${item.action}:`, err.message);
      if (!isNetworkError(err)) {
        // If it's a hard error (like constraint violation), we might want to drop it,
        // but for safety we'll keep it or you could add retry limits.
        // For now, if it's not a network error, we'll assume it's permanently failed and drop it to prevent blocking the queue.
        console.error(`[Offline Sync] Dropping item due to hard error.`);
      } else {
        remaining.push(item);
      }
    }
  }
  
  if (remaining.length !== offlineQueue.length) {
    offlineQueue = remaining;
    saveQueue();
  }
}

const MODULES = {
  app_student_sessions: ["student_name", "class_name", "admission_no", "roll_no", "status", "last_active_at", "last_login_at", "phone", "device_os"],
  students: [
    "admissionNo", "rollNo", "fullName", "className", "section", "gender", "dob", "age",
    "aadhar", "category", "religion", "phone1", "phone2", "whatsapp", "email",
    "village", "post", "district", "state", "pin", "address",
    "fatherName", "motherName", "guardianName", "relation", "occupation", "incomeRange", "emergencyContact",
    "session", "admissionDate", "prevSchool", "lastClassPassed", "tcReceived",
    "photo", "birthCert", "aadharDoc", "tcDoc", "parentIdDoc",
    "admissionFee", "monthlyFee", "transportFee", "transportArea", "vehicleType", "transportRoute", "pickupPoint", "discount",
    "status", "remarks", "phone", "tc", "reportCard", "fatherAadhar", "motherAadhar",
    "studentAadharNo", "fatherAadharNo", "motherAadharNo",
    "photoUrl", "appPassword", "allow_profile_edit", "allowed_edit_fields",
    "bloodGroup", "medicalIssue", "isFreeOfCharge"
  ],
  admissions: [
    "admissionNo", "rollNo", "fullName", "className", "section", "gender", "dob", "age",
    "aadhar", "category", "religion", "phone1", "phone2", "whatsapp", "email",
    "village", "post", "district", "state", "pin", "address",
    "fatherName", "motherName", "guardianName", "relation", "occupation", "incomeRange", "emergencyContact",
    "classApplyingFor", "session", "admissionDate", "prevSchool", "lastClassPassed", "tcReceived",
    "photo", "birthCert", "aadharDoc", "tcDoc", "parentIdDoc",
    "admissionFee", "monthlyFee", "transportFee", "transportArea", "vehicleType", "transportRoute", "pickupPoint", "discount",
    "status", "remarks", "isDraft", "draftUserId", "phone", "tc", "reportCard", "fatherAadhar", "motherAadhar",
    "studentAadharNo", "fatherAadharNo", "motherAadharNo",
    "photoUrl", "appPassword", "allow_profile_edit", "allowed_edit_fields",
    "bloodGroup", "medicalIssue", "isFreeOfCharge"
  ],
  teachers: ["employeeNo", "fullName", "department", "qualification", "phone", "email", "joinDate", "photo"],
  classes: ["className", "section", "classTeacher", "roomNo", "capacity"],
  subjects: ["subjectCode", "subjectName", "className", "teacher", "credits"],
  attendance: ["admissionNo", "date", "className", "studentName", "rollNo", "status", "arrivalTime", "departureTime", "remarks", "facePhoto"],
  teacherAttendance: ["date", "department", "teacherName", "status", "arrivalTime", "departureTime", "remarks"],
  exams: ["examName", "className", "section", "studentName", "rollNo", "admissionNo", "studentPhoto", "session", "examDate", "reportingTime", "examCenter", "subjectMarks", "totalMarks", "percentage", "grade", "gpa", "rank", "resultStatus", "teacherRemark"],
  examSchedules: ["className", "examName", "dates"],
  fees: ["admissionNo", "studentName", "className", "rollNo", "fatherName", "term", "month", "creationDate", "feeTypes", "tuitionFee", "admissionFee", "computerFee", "developmentFee", "labFee", "sportsFee", "libraryFee", "examFee", "transportFee", "hostelFee", "otherFee", "lateFee", "totalFee", "paidAmount", "balance", "status", "paymentDate", "paymentMethod", "onlineAmount", "cashAmount", "monthlyFee", "monthlyFeeLabel", "selectedBookIds", "dueMgmtAmount", "dueMgmtParticulars", "consolidatedFeeIds", "consolidatedDueMgmtIds", "payId"],
  library: ["bookCode", "bookTitle", "author", "issuedTo", "issueDate", "returnDate", "status"],
  transport: ["routeName", "vehicleNo", "driverName", "studentName", "pickupPoint", "monthlyFee"],
  hostel: ["hostelName", "roomNo", "studentName", "warden", "checkInDate", "bedNo", "status"],
  payroll: ["employeeName", "designation", "month", "basicSalary", "allowances", "deductions", "netPay"],
  users: ["username", "fullName", "role", "email", "status", "lastLogin", "password"],
  timetable: ["className", "day", "period", "subject", "teacher", "roomNo"],
  notifications: ["message", "type", "date"],
  faceEmbeddings: ["targetType", "name", "tag", "descriptorJson"],
  schoolInvestments: ["title", "category", "amount", "expectedReturn", "bank", "startDate", "maturityDate", "notes", "status"],
  schoolIncome: ["date", "source", "category", "amount", "mode", "description"],
  schoolExpenses: ["date", "head", "category", "amount", "mode", "description"],
  booksAndDress: ["className", "itemType", "itemName", "price", "term", "stock"],
  feeStructures: ["className", "feeType", "amount", "term", "description"],
  whatsappAlerts: ["studentName", "className", "phone", "parentName", "balance", "term", "alertDate", "message", "status"],
  dueManagement: ["admissionNo", "studentName", "className", "rollNo", "session", "month", "particulars", "dueAmount", "paidAmount", "balance", "status", "remarks", "payId"],
  holidays: ["date", "name", "type", "description"],
  weeklyEvaluation: ["weekStartDate", "weekEndDate", "className", "section", "studentName", "rollNo", "maths", "english", "hindi", "science", "sst", "readingEng", "readingHindi", "writingEng", "writingHindi", "attanDance", "dicipLine", "uniform", "activities", "overall", "teacherRemark"],
  announcements: ["date", "title", "message", "targetAudience", "postedBy", "category", "targetType", "targetClass", "targetAdmissionNo", "targetStudentName", "priority", "status"],
  settings: ["key", "value", "category", "updatedBy"],
  app_student_sessions: ["admission_no", "student_name", "class_name", "roll_no", "phone", "status", "device_os", "last_login_at", "last_active_at", "created_at"],
  app_teacher_chats: ["student_admission_no", "student_name", "class_name", "teacher_id", "teacher_name", "sender", "message", "created_at", "is_read"],
  app_online_payments: ["admission_no", "student_name", "class_name", "roll_no", "amount", "status", "payId", "payment_method", "utr_number", "remarks", "verified_at", "verified_by", "created_at"]
};

async function runRaw(sql, params = [], moduleName) {
  const targetDb = moduleName ? getDb(moduleName) : db;
  return await targetDb.execute({ sql, args: params });
}

async function createTable(tableName, fields) {
  const cols = fields.map((f) => `${f} TEXT`).join(", ");
  await getDb(tableName).execute(`CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols});`);
}

async function ensureColumns(tableName, fields) {
  const targetDb = getDb(tableName);
  const res = await targetDb.execute(`PRAGMA table_info(${tableName})`);
  const existing = res.rows.map((r) => r.name);
  for (const f of fields) {
    if (!existing.includes(f)) {
      try {
        await targetDb.execute(`ALTER TABLE ${tableName} ADD COLUMN ${f} TEXT`);
      } catch (e) {}
    }
  }
}

async function seedIfEmpty() {
  const res = await db.execute("SELECT COUNT(*) AS c FROM users");
  if (res.rows[0].c > 0) return;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const today = new Date().toISOString().slice(0, 10);

  await insert("students", { admissionNo: "ADM001", rollNo: "10A-01", fullName: "Aarav Sharma", className: "10-A", gender: "Male", dob: "2010-03-12", fatherName: "Rohit Sharma", phone: "9876501234", address: "Sector 5", status: "Active", aadhar: "", tc: "", reportCard: "" });
  await insert("students", { admissionNo: "ADM002", rollNo: "9B-07", fullName: "Ananya Singh", className: "9-B", gender: "Female", dob: "2011-07-20", fatherName: "Vikas Singh", phone: "9823401234", address: "Green Park", status: "Active", aadhar: "", tc: "", reportCard: "" });
  await insert("teachers", { employeeNo: "EMP100", fullName: "Neha Verma", department: "Science", qualification: "M.Sc", phone: "9900112233", email: "neha@school.com", joinDate: "2018-06-10" });
  await insert("teachers", { employeeNo: "EMP101", fullName: "Amit Kumar", department: "Math", qualification: "M.Ed", phone: "9900112244", email: "amit@school.com", joinDate: "2019-01-05" });
  await insert("classes", { className: "10", section: "A", classTeacher: "Neha Verma", roomNo: "204", capacity: "40" });
  await insert("subjects", { subjectCode: "MAT10", subjectName: "Mathematics", className: "10-A", teacher: "Amit Kumar", credits: "5" });
  await insert("attendance", { date: today, className: "10-A", studentName: "Aarav Sharma", rollNo: "10A-01", status: "Present", remarks: "On time" });
  await insert("teacherAttendance", { date: today, department: "Science", teacherName: "Neha Verma", status: "Present", remarks: "On time" });
  await insert("exams", { examName: "Mid Term", className: "10-A", studentName: "Aarav Sharma", rollNo: "10A-01", session: "2026-27", subjectMarks: JSON.stringify([{subject: "Mathematics", theory: 64, practical: 20, total: 84}]), totalMarks: "84", percentage: "84%", grade: "A", resultStatus: "Pass" });
  await insert("fees", { studentName: "Aarav Sharma", className: "10-A", rollNo: "10A-01", term: "Q1", totalFee: "18000", paidAmount: "15000", balance: "3000", status: "Partial", paymentDate: today, paymentMethod: "Cash" });
  await insert("users", { username: "im_aatif", fullName: "System Admin", role: "Administrator", email: "admin@school.com", status: "Active", lastLogin: now, password: "Aatif@123" });
  await insert("users", { username: "principal", fullName: "School Principal", role: "Principal", email: "principal@school.com", status: "Active", lastLogin: now, password: "principal123" });
  await insert("timetable", { className: "10-A", day: "Monday", period: "1", subject: "Mathematics", teacher: "Amit Kumar", roomNo: "204" });
  await insert("notifications", { message: "Parent meeting on Friday 11 AM", type: "Announcement", date: today });
}

async function seedHolidays() {
  const res = await db.execute("SELECT COUNT(*) AS c FROM holidays");
  if (res.rows[0].c > 0) return;
  const holidays = [
    { date: "2026-01-14", name: "Makar Sankranti", type: "Festival", description: "Harvest festival" },
    { date: "2026-01-26", name: "Republic Day", type: "National", description: "Republic Day of India" },
    { date: "2026-02-15", name: "Maha Shivaratri", type: "Religious", description: "Lord Shiva festival" },
    { date: "2026-03-04", name: "Holi", type: "Festival", description: "Festival of colors" },
    { date: "2026-08-15", name: "Independence Day", type: "National", description: "Independence Day of India" },
    { date: "2026-10-02", name: "Gandhi Jayanti", type: "National", description: "Mahatma Gandhi birthday" },
    { date: "2026-10-20", name: "Dussehra", type: "Festival", description: "Victory of good over evil" },
    { date: "2026-11-08", name: "Diwali", type: "Festival", description: "Festival of lights" },
    { date: "2026-12-25", name: "Christmas", type: "Festival", description: "Birth of Jesus Christ" }
  ];
  for (const h of holidays) await insert("holidays", h);
}

async function ensureDefaultAdmin() {
  const adminByUsername = await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: ["im_aatif"] });
  const anyAdmin = await db.execute("SELECT * FROM users WHERE lower(role) = 'administrator' LIMIT 1");
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (adminByUsername.rows.length === 0) {
    await insert("users", {
      username: "im_aatif", fullName: "System Admin", role: "Administrator", email: "admin@school.com",
      status: "Active", lastLogin: now, password: "Aatif@123"
    });
  }
  if (anyAdmin.rows.length > 0 && anyAdmin.rows[0].username !== "im_aatif") {
    await db.execute({ sql: "UPDATE users SET username = ?, password = ? WHERE id = ?", args: ["im_aatif", "Aatif@123", anyAdmin.rows[0].id] });
  }
}

async function resetAndSeed() {
  const tx = await db.transaction();
  for (const moduleName of Object.keys(MODULES)) {
    await tx.execute(`DELETE FROM ${moduleName}`);
    await tx.execute({ sql: `DELETE FROM sqlite_sequence WHERE name = ?`, args: [moduleName] });
  }
  await tx.commit();
  await seedIfEmpty();
}

async function purgeDemoData() {
  for (const tbl of ["schoolInvestments", "schoolIncome", "schoolExpenses"]) {
    try { await db.execute(`DELETE FROM ${tbl} WHERE isDemo = 1 OR isDemo = 'true' OR isDemo = '1'`); } catch (e) {}
  }
}

async function backfillPayIds() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const genId = () => {
    let p = '';
    for (let i = 0; i < 6; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    return p;
  };
  try {
    const dues = await db.execute("SELECT id FROM dueManagement WHERE payId IS NULL OR payId = ''");
    if (dues.rows.length > 0) {
      const tx = await db.transaction();
      for (const d of dues.rows) await tx.execute({ sql: "UPDATE dueManagement SET payId = ? WHERE id = ?", args: [genId(), d.id] });
      await tx.commit();
    }
    const fees = await db.execute("SELECT id FROM fees WHERE payId IS NULL OR payId = ''");
    if (fees.rows.length > 0) {
      const tx = await db.transaction();
      for (const f of fees.rows) await tx.execute({ sql: "UPDATE fees SET payId = ? WHERE id = ?", args: [genId(), f.id] });
      await tx.commit();
    }
  } catch (e) {}
}

async function initDb() {
  for (const [tableName, fields] of Object.entries(MODULES)) {
    await createTable(tableName, fields);
    await ensureColumns(tableName, fields);
  }
  await seedIfEmpty();
  await seedHolidays();
  await purgeDemoData();
  await ensureDefaultAdmin();
  await backfillPayIds();
}

async function list(moduleName) {
  const result = await getDb(moduleName).execute(`SELECT * FROM ${moduleName} ORDER BY id DESC`);
  let rows = result.rows.map(row => {
    if (row.photo && typeof row.photo === 'string' && row.photo.startsWith('data:image')) row.photo = `/api/photo/${moduleName}/${row.id}`;
    if (row.studentPhoto && typeof row.studentPhoto === 'string' && row.studentPhoto.startsWith('data:image')) row.studentPhoto = `/api/photo/${moduleName}/${row.id}?col=studentPhoto`;
    if (row.facePhoto && typeof row.facePhoto === 'string' && row.facePhoto.startsWith('data:image')) row.facePhoto = `/api/photo/${moduleName}/${row.id}?col=facePhoto`;
    return row;
  });

  // Apply offline queue mutations
  const removes = new Set(offlineQueue.filter(q => q.action === 'remove' && q.module === moduleName).map(q => String(q.id)));
  if (removes.size > 0) {
    rows = rows.filter(r => !removes.has(String(r.id)));
  }
  
  const updates = offlineQueue.filter(q => q.action === 'update' && q.module === moduleName);
  updates.forEach(u => {
    const idx = rows.findIndex(r => String(r.id) === String(u.id));
    if (idx !== -1) {
      rows[idx] = { ...rows[idx], ...u.payload };
    }
  });

  const inserts = offlineQueue.filter(q => q.action === 'insert' && q.module === moduleName).map(q => q.payload).reverse(); // newest first
  if (inserts.length > 0) {
    rows = [...inserts, ...rows];
  }

  return rows.map(r => normalizeRow(moduleName, r));
}

function triggerSync() {} // Turso autosyncs in background now

const CANONICAL_CLASS_MAP = {
  '1-A': 'I-A', 'CLASS 1-A': 'I-A', 'CLASS 1': 'I-A', '1': 'I-A', 'CLASS I-A': 'I-A', 'CLASS I': 'I-A', 'I-A': 'I-A', 'I': 'I-A',
  '2-A': 'II-A', 'CLASS 2-A': 'II-A', 'CLASS 2': 'II-A', '2': 'II-A', 'CLASS II-A': 'II-A', 'CLASS II': 'II-A', 'II-A': 'II-A', 'II': 'II-A',
  '3-A': 'III-A', 'CLASS 3-A': 'III-A', 'CLASS 3': 'III-A', '3': 'III-A', 'CLASS III-A': 'III-A', 'CLASS III': 'III-A', 'III-A': 'III-A', 'III': 'III-A',
  '4-A': 'IV-A', 'CLASS 4-A': 'IV-A', 'CLASS 4': 'IV-A', '4': 'IV-A', 'CLASS IV-A': 'IV-A', 'CLASS IV': 'IV-A', 'IV-A': 'IV-A', 'IV': 'IV-A',
  '5-A': 'V-A', 'CLASS 5-A': 'V-A', 'CLASS 5': 'V-A', '5': 'V-A', 'CLASS V-A': 'V-A', 'CLASS V': 'V-A', 'V-A': 'V-A', 'V': 'V-A',
  '6-A': 'VI-A', 'CLASS 6-A': 'VI-A', 'CLASS 6': 'VI-A', '6': 'VI-A', 'CLASS VI-A': 'VI-A', 'CLASS VI': 'VI-A', 'VI-A': 'VI-A', 'VI': 'VI-A',
  '7-A': 'VII-A', 'CLASS 7-A': 'VII-A', 'CLASS 7': 'VII-A', '7': 'VII-A', 'CLASS VII-A': 'VII-A', 'CLASS VII': 'VII-A', 'VII-A': 'VII-A', 'VII': 'VII-A',
  '8-A': 'VIII-A', 'CLASS 8-A': 'VIII-A', 'CLASS 8': 'VIII-A', '8': 'VIII-A', 'CLASS VIII-A': 'VIII-A', 'CLASS VIII': 'VIII-A', 'VIII-A': 'VIII-A', 'VIII': 'VIII-A',
  '9-A': 'IX-A', 'CLASS 9-A': 'IX-A', 'CLASS 9': 'IX-A', '9': 'IX-A', 'CLASS IX-A': 'IX-A', 'CLASS IX': 'IX-A', 'IX-A': 'IX-A', 'IX': 'IX-A',
  '10-A': 'X-A', 'CLASS 10-A': 'X-A', 'CLASS 10': 'X-A', '10': 'X-A', 'CLASS X-A': 'X-A', 'CLASS X': 'X-A', 'X-A': 'X-A', 'X': 'X-A',
  'LKG-A': 'LKG-A', 'CLASS LKG-A': 'LKG-A', 'CLASS LKG': 'LKG-A', 'LKG': 'LKG-A',
  'UKG-A': 'UKG-A', 'CLASS UKG-A': 'UKG-A', 'CLASS UKG': 'UKG-A', 'UKG': 'UKG-A',
  'NURSERY-A': 'Nursery-A', 'CLASS NURSERY-A': 'Nursery-A', 'CLASS NURSERY': 'Nursery-A', 'NURSERY': 'Nursery-A', 'NUR-A': 'Nursery-A', 'CLASS NUR-A': 'Nursery-A'
};

function normalizeCanonicalClass(val) {
  if (!val) return '';
  const clean = String(val).trim().toUpperCase();
  if (CANONICAL_CLASS_MAP[clean]) return CANONICAL_CLASS_MAP[clean];
  const stripped = clean.replace(/^(CLASS|GRADE)\s+/i, '').trim();
  if (CANONICAL_CLASS_MAP[stripped]) return CANONICAL_CLASS_MAP[stripped];
  return String(val).trim();
}

function normalizeRow(moduleName, row) {
  if (!row || typeof row !== 'object') return row;
  if (moduleName === "students") {
    row.admissionNo = row.admissionno ?? row.admissionNo ?? "";
    row.fullName = row.fullname ?? row.fullName ?? "";
    row.rollNo = row.rollno ?? row.rollNo ?? "";
    row.className = normalizeCanonicalClass(row.classname ?? row.className ?? "");
    row.section = row.section ?? "A";
    row.gender = row.gender ?? "Male";
    row.fatherName = row.fathername ?? row.fatherName ?? "";
    row.motherName = row.mothername ?? row.motherName ?? "";
    row.phone = row.phone ?? row.phone1 ?? "";
    row.status = row.status ?? "Active";
    if (row.photoUrl && typeof row.photoUrl === 'string' && row.photoUrl.startsWith('data:image')) {
      row.photoUrl = `/api/photo/students/${row.id}`;
    }
  } else if (moduleName === "dueManagement") {
    row.admissionNo = row.admissionno ?? row.admissionNo ?? "";
    row.studentName = row.studentname ?? row.studentName ?? "";
    row.className = normalizeCanonicalClass(row.classname ?? row.className ?? "");
    row.rollNo = row.rollno ?? row.rollNo ?? "";
    row.dueAmount = String(row.dueamount ?? row.dueAmount ?? "0");
    row.paidAmount = String(row.paidamount ?? row.paidAmount ?? "0");
    row.balance = String(row.balance ?? "0");
    row.payId = row.payid ?? row.payId ?? "";
    row.status = (row.status === "Unpaid" || !row.status) ? "Pending" : row.status;
    row.session = row.session ?? "";
    row.month = row.month ?? "";
    row.particulars = row.particulars ?? "";
    row.remarks = row.remarks ?? "";
  } else if (moduleName === "feeStructures") {
    row.className = normalizeCanonicalClass(row.classname ?? row.className ?? "");
    row.feeType = row.feetype ?? row.feeType ?? "";
    row.amount = row.amount ?? 0;
    row.term = row.term ?? "";
    row.description = row.description ?? "";
  } else if (moduleName === "fees") {
    row.admissionNo = row.admissionno ?? row.admissionNo ?? "";
    row.studentName = row.studentname ?? row.studentName ?? "";
    row.className = normalizeCanonicalClass(row.classname ?? row.className ?? "");
    row.rollNo = row.rollno ?? row.rollNo ?? "";
    row.fatherName = row.fathername ?? row.fatherName ?? "";
    row.term = row.term ?? "";
    row.month = row.month ?? "";
    row.feeTypes = row.feetypes ?? row.feeTypes ?? "";
    row.tuitionFee = row.tuitionfee ?? row.tuitionFee ?? "0";
    row.admissionFee = row.admissionfee ?? row.admissionFee ?? "0";
    row.computerFee = row.computerfee ?? row.computerFee ?? "0";
    row.developmentFee = row.developmentfee ?? row.developmentFee ?? "0";
    row.labFee = row.labfee ?? row.labFee ?? "0";
    row.sportsFee = row.sportsfee ?? row.sportsFee ?? "0";
    row.libraryFee = row.libraryfee ?? row.libraryFee ?? "0";
    row.examFee = row.examfee ?? row.examFee ?? "0";
    row.transportFee = row.transportfee ?? row.transportFee ?? "0";
    row.hostelFee = row.hostelfee ?? row.hostelFee ?? "0";
    row.otherFee = row.otherfee ?? row.otherFee ?? "0";
    row.lateFee = row.latefee ?? row.lateFee ?? "0";
    row.totalFee = row.totalfee ?? row.totalFee ?? "0";
    row.paidAmount = row.paidamount ?? row.paidAmount ?? "0";
    row.balance = row.balance ?? "0";
    row.status = row.status ?? "Paid";
    row.paymentDate = row.paymentdate ?? row.paymentDate ?? "";
    row.paymentMethod = row.paymentmethod ?? row.paymentMethod ?? "Cash";
    row.monthlyFee = row.monthlyfee ?? row.monthlyFee ?? "0";
    row.monthlyFeeLabel = row.monthlyfeelabel ?? row.monthlyFeeLabel ?? "";
    row.payId = row.payid ?? row.payId ?? "";
  }
  return row;
}

async function generateUniquePayId(moduleName = "fees") {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt++) {
    let p = '';
    for (let i = 0; i < 6; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
    try {
      const chk1 = await db.execute({ sql: "SELECT 1 FROM fees WHERE payId = ? LIMIT 1", args: [p] });
      const chk2 = await db.execute({ sql: "SELECT 1 FROM dueManagement WHERE payId = ? LIMIT 1", args: [p] });
      if (chk1.rows.length === 0 && chk2.rows.length === 0) {
        return p;
      }
    } catch(e) {
      return p;
    }
  }
  return 'P' + Date.now().toString(36).toUpperCase().slice(-5);
}

async function _insert(moduleName, payload) {
  if (payload && payload.className) {
    payload.className = normalizeCanonicalClass(payload.className);
  }
  if (moduleName === "students" && payload && payload.photoUrl && payload.photoUrl.startsWith('data:image')) {
    if (!payload.photo || payload.photo.length < 50) {
      payload.photo = payload.photoUrl;
    }
  }
  if ((moduleName === "fees" || moduleName === "dueManagement") && (!payload.payId || String(payload.payId).trim() === "")) {
    payload.payId = await generateUniquePayId(moduleName);
  }
  if (!payload.id || isNaN(Number(payload.id))) {
    try {
      const maxRes = await getDb(moduleName).execute(`SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS nextId FROM ${moduleName} WHERE id IS NOT NULL`);
      payload.id = Number(maxRes.rows[0]?.nextId || maxRes.rows[0]?.nextid || (Date.now() % 1000000));
    } catch(e) {
      payload.id = Math.floor(100000 + Math.random() * 900000);
    }
  } else {
    payload.id = Number(payload.id);
  }
  if (moduleName === "students" && payload && payload.photoUrl && payload.photoUrl.startsWith('data:image')) {
    payload.photoUrl = `/api/photo/students/${payload.id}`;
  }
  if (moduleName === "faceEmbeddings" && payload.name && payload.targetType) {
    try {
      await getDb(moduleName).execute({
        sql: `DELETE FROM faceEmbeddings WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND targetType = ?`,
        args: [payload.name, payload.targetType]
      });
    } catch(e) {}
  }
  const fields = MODULES[moduleName];
  const cols = `id, ${fields.join(", ")}`;
  
  // Use positional ? params — Turso embedded replica silently fails with named :params
  const placeholders = `?, ${fields.map(() => '?').join(", ")}`;
  const values = [payload.id, ...fields.map(f => payload[f] ?? "")];
  
  const res = await getDb(moduleName).execute({ sql: `INSERT INTO ${moduleName} (${cols}) VALUES (${placeholders})`, args: values });
  invalidateStoreCache();
  const finalId = payload.id || Number(res.lastInsertRowid);
  return await getById(moduleName, finalId);
}

async function insert(moduleName, payload) {
  try {
    return await _insert(moduleName, payload);
  } catch (err) {
    if (isNetworkError(err) && dbOptions.syncUrl) {
      console.warn(`[Offline Queue] Insert into ${moduleName} failed, queuing locally...`);
      const tempId = "TEMP-" + Date.now();
      const queuedPayload = { id: tempId, ...payload };
      offlineQueue.push({ action: 'insert', module: moduleName, payload: queuedPayload, tempId });
      saveQueue();
      return queuedPayload;
    }
    throw err;
  }
}

async function getById(moduleName, id) {
  const numId = Number(id);
  const finalId = isNaN(numId) ? id : numId;
  
  // Check if it's a queued offline insert
  if (typeof id === 'string' && id.startsWith("TEMP-")) {
    const queued = offlineQueue.find(q => q.action === 'insert' && q.module === moduleName && q.tempId === id);
    if (queued) return normalizeRow(moduleName, queued.payload);
    return undefined;
  }
  let result = await getDb(moduleName).execute({ sql: `SELECT * FROM ${moduleName} WHERE id = ?`, args: [finalId] });
  if ((!result?.rows || result.rows.length === 0) && moduleName === 'teachers') {
    const sId = String(id).trim();
    const rawId = sId.replace(/^EMP[-_]?/i, '').trim();
    const parsedNum = parseInt(rawId, 10);
    const pad2 = !isNaN(parsedNum) ? String(parsedNum).padStart(2, '0') : rawId;
    const numArg = !isNaN(parsedNum) ? parsedNum : -999999;
    result = await getDb('teachers').execute({
      sql: `SELECT * FROM teachers WHERE id = ? OR employeeNo = ? OR employeeNo = ? OR ('EMP-' || employeeNo) = ? OR ('EMP-' || id) = ? OR (id = ? AND id > 0) OR (CAST(employeeNo AS INTEGER) = ? AND ? > 0) LIMIT 1`,
      args: [sId, sId, pad2, sId, sId, numArg, numArg, numArg]
    });
  } else if ((!result?.rows || result.rows.length === 0) && moduleName === 'students') {
    const sId = String(id).trim();
    const parsedNum = parseInt(sId, 10);
    const numArg = !isNaN(parsedNum) ? parsedNum : -999999;
    result = await getDb('students').execute({
      sql: `SELECT * FROM students WHERE id = ? OR admissionNo = ? OR (id = ? AND id > 0) LIMIT 1`,
      args: [sId, sId, numArg]
    });
  }
  return normalizeRow(moduleName, result.rows[0]);
}

async function _update(moduleName, id, payload) {
  const numId = Number(id);
  const finalId = isNaN(numId) ? id : numId;
  if (payload && payload.className) {
    payload.className = normalizeCanonicalClass(payload.className);
  }
  if (moduleName === "students" && payload && payload.photoUrl && payload.photoUrl.startsWith('data:image')) {
    if (!payload.photo || payload.photo.length < 50) {
      payload.photo = payload.photoUrl;
    }
    payload.photoUrl = `/api/photo/students/${finalId}`;
  }
  const fields = MODULES[moduleName] || [];
  const allowedKeys = Object.keys(payload || {}).filter((k) => fields.includes(k));
  if (!allowedKeys.length) return await getById(moduleName, id);

  // Use positional ? params — Turso embedded replica silently fails with named :params
  const setSql = allowedKeys.map(k => `${k}=?`).join(", ");
  const values = allowedKeys.map(k => payload[k] ?? "");
  values.push(finalId); // for WHERE id=?
  
  await getDb(moduleName).execute({ sql: `UPDATE ${moduleName} SET ${setSql} WHERE id=?`, args: values });
  invalidateStoreCache();

  if (moduleName === "fees" && String(payload.status).toLowerCase() === "paid") {
      const fee = await getById("fees", id);
      if (fee && fee.consolidatedDueMgmtIds) {
          try {
              const mgmtIds = JSON.parse(fee.consolidatedDueMgmtIds);
              if (Array.isArray(mgmtIds) && mgmtIds.length > 0) {
                  for (const mid of mgmtIds) {
                      await getDb("dueManagement").execute({ sql: "DELETE FROM dueManagement WHERE id = ?", args: [mid] });
                  }
              }
          } catch (e) {}
      }
  }
  return await getById(moduleName, id);
}

async function update(moduleName, id, payload) {
  try {
    // If it's a queued insert, update it in the queue instead of executing SQL
    if (typeof id === 'string' && id.startsWith("TEMP-")) {
      const q = offlineQueue.find(q => q.action === 'insert' && q.module === moduleName && q.tempId === id);
      if (q) {
        q.payload = { ...q.payload, ...payload };
        saveQueue();
        return q.payload;
      }
    }
    return await _update(moduleName, id, payload);
  } catch (err) {
    if (isNetworkError(err) && dbOptions.syncUrl) {
      console.warn(`[Offline Queue] Update ${moduleName}/${id} failed, queuing locally...`);
      offlineQueue.push({ action: 'update', module: moduleName, id, payload });
      saveQueue();
      // Return optimistically updated data
      const oldData = await getById(moduleName, id).catch(() => ({}));
      return { ...oldData, ...payload, id };
    }
    throw err;
  }
}

async function _remove(moduleName, id) {
  const numId = Number(id);
  const finalId = isNaN(numId) ? id : numId;
  if (moduleName === "fees") {
      const fee = await getById("fees", id);
      if (fee && fee.consolidatedDueMgmtIds) {
          try {
              const mgmtIds = JSON.parse(fee.consolidatedDueMgmtIds);
              if (Array.isArray(mgmtIds) && mgmtIds.length > 0) {
                  for (const mid of mgmtIds) {
                     await getDb("dueManagement").execute({ sql: "UPDATE dueManagement SET status = 'Pending', paidAmount = 0, balance = dueAmount WHERE id = ?", args: [mid] });
                  }
              }
          } catch(e) {}
      }
  }
  invalidateStoreCache();
  return await getDb(moduleName).execute({ sql: `DELETE FROM ${moduleName} WHERE id = ?`, args: [finalId] });
}

async function remove(moduleName, id) {
  try {
    // If it's a temporary ID, just remove it from the queue
    if (typeof id === 'string' && id.startsWith("TEMP-")) {
      const idx = offlineQueue.findIndex(q => q.action === 'insert' && q.module === moduleName && q.tempId === id);
      if (idx !== -1) {
        offlineQueue.splice(idx, 1);
        saveQueue();
        return;
      }
    }
    return await _remove(moduleName, id);
  } catch (err) {
    if (isNetworkError(err) && dbOptions.syncUrl) {
      console.warn(`[Offline Queue] Delete from ${moduleName} failed, queuing locally...`);
      offlineQueue.push({ action: 'remove', module: moduleName, id });
      saveQueue();
      return;
    }
    throw err;
  }
}

let memoryStoreCache = null;
let memoryStoreCacheTime = 0;
const STORE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache TTL (auto-invalidated on any mutation)
let lastStoreVersion = Date.now();
const tableColsCache = {};
Object.keys(MODULES).forEach(m => {
  tableColsCache[m] = ['id', ...MODULES[m]];
});

function invalidateStoreCache() {
  memoryStoreCache = null;
  memoryStoreCacheTime = 0;
  lastStoreVersion = Date.now();
}

function getStoreVersion() {
  return lastStoreVersion;
}

async function replaceAll(moduleName, rows) {
  invalidateStoreCache();
  await db.execute(`DELETE FROM ${moduleName}`);
  if (!Array.isArray(rows) || rows.length === 0) {
    invalidateQueryCache(moduleName);
    return;
  }

  const fields = MODULES[moduleName] || [];
  if (!fields.length) return;

  const cols = `id, ${fields.join(", ")}`;
  const placeholders = `?, ${fields.map(() => '?').join(", ")}`;
  const insertSql = `INSERT INTO ${moduleName} (${cols}) VALUES (${placeholders})`;

  let currentId = 1;
  const statements = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowId = (r.id && !isNaN(Number(r.id))) ? Number(r.id) : currentId++;
    if (r.className) {
      r.className = normalizeCanonicalClass(r.className);
    }
    const values = [rowId, ...fields.map(f => r[f] ?? "")];
    statements.push({ sql: insertSql, args: values });
  }

  const CHUNK = 50;
  for (let i = 0; i < statements.length; i += CHUNK) {
    const chunk = statements.slice(i, i + CHUNK);
    await db.batch(chunk);
  }

  invalidateQueryCache(moduleName);
  invalidateStoreCache();
}

async function rawList(moduleName) {
  const heavyFields = ["photo", "photoUrl", "birthCert", "aadharDoc", "tcDoc", "parentIdDoc", "reportCard", "fatherAadhar", "motherAadhar", "aadhar", "tc"];
  
  try {
    const db = getDb(moduleName);
    
    // Cache column info to avoid repeated PRAGMA queries
    if (!tableColsCache[moduleName]) {
      const pragmaRes = await db.execute(`PRAGMA table_info(${moduleName})`);
      tableColsCache[moduleName] = pragmaRes.rows.map(r => r.name);
    }
    const actualCols = tableColsCache[moduleName] || [];
    
    const selectCols = actualCols.map(col => {
      if (heavyFields.includes(col)) {
        // Instead of sending full base64, just mark presence with length check
        return `CASE WHEN length("${col}") > 50 THEN 'HAS_DATA' ELSE NULL END as "${col}"`;
      }
      return `"${col}"`;
    });

    const selectClause = selectCols.length > 0 ? selectCols.join(", ") : "*";
    const res = await db.execute(`SELECT ${selectClause} FROM ${moduleName} ORDER BY id DESC`);
    
    // Convert 'HAS_DATA' markers to proper streaming URLs and normalize casing
    const rows = (res.rows || []).map(row => {
      if (row.photo === 'HAS_DATA') row.photo = `/api/photo/${moduleName}/${row.id}`;
      if (row.photoUrl === 'HAS_DATA') row.photoUrl = `/api/photo/${moduleName}/${row.id}`;
      if (row.studentPhoto === 'HAS_DATA') row.studentPhoto = `/api/photo/${moduleName}/${row.id}?col=studentPhoto`;
      if (row.facePhoto === 'HAS_DATA') row.facePhoto = `/api/photo/${moduleName}/${row.id}?col=facePhoto`;
      return normalizeRow(moduleName, row);
    });

    // ── UNIFIED EXAMS & APP_EXAM_MARKS BRIDGE ──
    // Universal Tenant-Aware Exams & app_exam_marks Unification Bridge
    // Automatically merge any subjects recorded in app_exam_marks into exams so mobile and web always share 100% of subjects
    if (moduleName === 'exams') {
      try {
        const appMarksRes = await db.execute(`SELECT exam_name, class_name, subject, student_name, admission_no, roll_no, marks_obtained, max_marks, passing_marks, grade, remarks, pa1_marks, notebook_marks, enrichment_marks, subjective_marks FROM app_exam_marks ORDER BY id ASC`);
        const appRows = appMarksRes.rows || [];
        if (appRows.length > 0) {
          // 1. Fetch tenant-specific exam settings & curriculum dynamically from current tenant database
          let tenantExamConfig = null;
          let tenantCustomRules = null;
          let tenantCustomGrading = null;
          try {
            const settingsRes = await db.execute("SELECT key, value FROM settings WHERE key IN ('exam_system_config', 'exam_main_subjects_rules', 'customGradingScale')");
            for (const sRow of (settingsRes.rows || [])) {
              if (sRow.key === 'exam_system_config' && sRow.value) {
                try { tenantExamConfig = JSON.parse(sRow.value); } catch(e){}
              } else if (sRow.key === 'exam_main_subjects_rules' && sRow.value) {
                try { tenantCustomRules = JSON.parse(sRow.value); } catch(e){}
              } else if (sRow.key === 'customGradingScale' && sRow.value) {
                try { tenantCustomGrading = JSON.parse(sRow.value); } catch(e){}
              }
            }
          } catch(e) {}

          // 2. Fetch registered class subjects from tenant's subjects table
          const classCurriculumDb = new Map();
          try {
            const subjectsRes = await db.execute("SELECT subjectName, className FROM subjects");
            for (const sRow of (subjectsRes.rows || [])) {
              const cKey = String(sRow.className || '').trim().toLowerCase();
              if (!classCurriculumDb.has(cKey)) classCurriculumDb.set(cKey, new Set());
              if (sRow.subjectName) classCurriculumDb.get(cKey).add(String(sRow.subjectName).trim().toLowerCase());
            }
          } catch(e) {}

          const MAIN_KEYWORDS_SERVER = [
            'english', 'hindi', 'science', 'social science', 'math',
            'mathematics', 'maths', 'social studies', 'sst', 'evs', 'environmental',
            'physics', 'chemistry', 'biology', 'accountancy', 'business', 'economics',
            'history', 'geography', 'civics', 'political science'
          ];
          const ADDITIONAL_KEYWORDS_SERVER = [
            'drawing', 'art', 'craft', 'gk', 'g.k', 'gk & me', 'me & gk', 'me/gk',
            'general knowledge', 'moral science', 'moral', 'computer', 'computer science',
            'information tech', 'infotech', 'it (402)', 'it', 'sanskrit', 'urdu',
            'physical education', 'phe', 'pe', 'sports', 'yoga', 'music', 'dance'
          ];

          const isSubjectMainServer = (subName, className) => {
            const s = String(subName || '').trim().toLowerCase();
            if (!s) return false;

            // Tenant-specific classRules or global rules
            const cKey = String(className || '').trim().toLowerCase();
            if (tenantCustomRules) {
              if (cKey && tenantCustomRules.classRules && tenantCustomRules.classRules[cKey]) {
                const cr = tenantCustomRules.classRules[cKey];
                if (Array.isArray(cr.main) && cr.main.some(m => String(m).trim().toLowerCase() === s)) return true;
                if (Array.isArray(cr.additional) && cr.additional.some(a => String(a).trim().toLowerCase() === s)) return false;
              }
              if (Array.isArray(tenantCustomRules.mainSubjects) && tenantCustomRules.mainSubjects.some(m => String(m).trim().toLowerCase() === s)) return true;
              if (Array.isArray(tenantCustomRules.additionalSubjects) && tenantCustomRules.additionalSubjects.some(a => String(a).trim().toLowerCase() === s)) return false;
            }

            // Universal exam_system_config
            if (tenantExamConfig && tenantExamConfig.coScholasticAreas) {
              if (tenantExamConfig.coScholasticAreas.some(ca => String(ca.name || '').trim().toLowerCase() === s)) return false;
            }

            // Fallback heuristics
            if (ADDITIONAL_KEYWORDS_SERVER.some(k => s === k || s.includes(k))) return false;
            if (MAIN_KEYWORDS_SERVER.some(k => s === k || s.includes(k))) return true;
            return true;
          };

          const getSubjectDisplayOrderServer = (subName, className) => {
            const raw = String(subName || '').trim().toLowerCase();
            if (raw.includes('english') || raw === 'eng') return 10;
            if (raw.includes('hindi') || raw === 'hin') return 20;
            if (raw.includes('math')) return 30;
            if (raw.includes('social') || raw.includes('sst') || raw.includes('history') || raw.includes('geography') || raw.includes('civics') || raw.includes('pol') || raw.includes('econ')) return 50;
            if (raw.includes('science') || raw.includes('evs') || raw.includes('environmental') || raw.includes('physics') || raw.includes('chemistry') || raw.includes('biology')) return 40;
            if (isSubjectMainServer(subName, className)) return 60;
            if (raw.includes('comp') || raw.includes('it') || raw.includes('info')) return 70;
            if (raw.includes('gk') || raw.includes('knowledge') || raw.includes('moral')) return 80;
            if (raw.includes('sansk') || raw.includes('urdu')) return 90;
            if (raw.includes('draw') || raw.includes('art') || raw.includes('craft')) return 100;
            if (raw.includes('physical') || raw.includes('sport') || raw.includes('yoga') || raw.includes('pe') || raw.includes('music') || raw.includes('dance')) return 110;
            return 120;
          };

          const getUniversalServerGrade = (pct) => {
            const p = parseFloat(pct);
            if (isNaN(p)) return '---';

            // Check custom grading scale from tenant config
            let scaleBands = null;
            if (tenantExamConfig && tenantExamConfig.gradingScale && Array.isArray(tenantExamConfig.gradingScale.bands) && tenantExamConfig.gradingScale.bands.length > 0) {
              scaleBands = tenantExamConfig.gradingScale.bands;
            } else if (Array.isArray(tenantCustomGrading) && tenantCustomGrading.length > 0) {
              scaleBands = tenantCustomGrading;
            }

            if (scaleBands) {
              const sorted = [...scaleBands].sort((a, b) => (parseFloat(b.min) || 0) - (parseFloat(a.min) || 0));
              const match = sorted.find(b => p >= (parseFloat(b.min) || 0));
              if (match && match.grade) return match.grade;
            }

            // CBSE Standard 9-Point Fallback
            if (p >= 91) return 'A1';
            if (p >= 81) return 'A2';
            if (p >= 71) return 'B1';
            if (p >= 61) return 'B2';
            if (p >= 51) return 'C1';
            if (p >= 41) return 'C2';
            if (p >= 33) return 'D';
            return 'E';
          };

          const tenantMinPassingPct = (tenantExamConfig && tenantExamConfig.passingCriteria && tenantExamConfig.passingCriteria.minOverallPercentage) 
            ? parseFloat(tenantExamConfig.passingCriteria.minOverallPercentage) 
            : (tenantCustomRules && tenantCustomRules.passingPercentage ? parseFloat(tenantCustomRules.passingPercentage) : 33);

          const appMarksMap = new Map();
          for (const ar of appRows) {
            const eName = (ar.exam_name || '').trim().toLowerCase();
            const adm = (ar.admission_no || '').trim().toLowerCase();
            const admKey = adm ? `${eName}:::adm_${adm}` : null;

            const isAb = ar.grade === 'AB' || ar.remarks === 'Absent' || String(ar.marks_obtained).toUpperCase() === 'AB' || String(ar.subjective_marks).toUpperCase() === 'AB';
            const subObj = {
              subject: (ar.subject || '').trim(),
              max: parseFloat(ar.max_marks) || 100,
              min: parseFloat(ar.passing_marks) || tenantMinPassingPct,
              pa1: isAb ? 0 : (parseFloat(ar.pa1_marks) || 0),
              pa2: 0,
              notebook: isAb ? 0 : (parseFloat(ar.notebook_marks) || 0),
              enrichment: isAb ? 0 : (parseFloat(ar.enrichment_marks) || 0),
              theory: isAb ? 'AB' : (parseFloat(ar.subjective_marks) || 0),
              subjective: isAb ? 'AB' : (parseFloat(ar.subjective_marks) || 0),
              practical: isAb ? 0 : ((parseFloat(ar.pa1_marks) || 0) + (parseFloat(ar.notebook_marks) || 0) + (parseFloat(ar.enrichment_marks) || 0)),
              total: isAb ? 'AB' : (parseFloat(ar.marks_obtained) || 0),
              grade: isAb ? 'AB' : (ar.grade || ''),
              isAbsent: isAb
            };

            if (admKey) {
              if (!appMarksMap.has(admKey)) appMarksMap.set(admKey, []);
              appMarksMap.get(admKey).push(subObj);
            }
          }

          rows.forEach(r => {
            const eName = (r.examName || '').trim().toLowerCase();
            const adm = (r.admissionNo || '').trim().toLowerCase();
            const admKey = adm ? `${eName}:::adm_${adm}` : null;
            const cKey = String(r.className || '').trim().toLowerCase();

            const appSubjects = admKey ? appMarksMap.get(admKey) : null;
            if (appSubjects && appSubjects.length > 0) {
              let existingSubjects = [];
              try {
                existingSubjects = typeof r.subjectMarks === 'string' ? JSON.parse(r.subjectMarks) : r.subjectMarks;
                if (!Array.isArray(existingSubjects)) existingSubjects = [];
              } catch(e) { existingSubjects = []; }

              const mergedMap = new Map();
              existingSubjects.forEach(s => {
                if (s && s.subject) mergedMap.set(s.subject.trim().toLowerCase(), s);
              });
              appSubjects.forEach(s => {
                if (s && s.subject) mergedMap.set(s.subject.trim().toLowerCase(), s);
              });
              const mergedList = Array.from(mergedMap.values());
              mergedList.sort((a, b) => getSubjectDisplayOrderServer(a.subject, r.className) - getSubjectDisplayOrderServer(b.subject, r.className));
              r.subjectMarks = JSON.stringify(mergedList);

              let grandTotal = 0;
              let evaluatedMax = 0;
              let mainTotal = 0;
              let mainMax = 0;
              let mainCount = 0;
              let failedMainCount = 0;

              // Dynamic class subjects count from tenant database curriculum
              const dbClassSubs = classCurriculumDb.get(cKey) || classCurriculumDb.get('all');
              const dynamicSubjectsCount = (dbClassSubs && dbClassSubs.size > 0) ? dbClassSubs.size : Math.max(mergedList.length, 5);
              const expectedMainCount = Math.max(1, Math.min(4, dynamicSubjectsCount - 1));

              mergedList.forEach(s => {
                const isSubAb = s.isAbsent === true || String(s.total).trim().toUpperCase() === 'AB' || String(s.theory).trim().toUpperCase() === 'AB' || s.grade === 'AB';
                const tot = isSubAb ? 0 : (parseFloat(s.total) || 0);
                const mx = parseFloat(s.max) || 100;
                const mn = parseFloat(s.min) || Math.round(mx * (tenantMinPassingPct / 100));
                const isMain = isSubjectMainServer(s.subject, r.className);

                grandTotal += tot;
                evaluatedMax += mx;

                if (isMain) {
                  mainCount++;
                  mainTotal += tot;
                  mainMax += mx;
                  if (isSubAb || tot < mn) failedMainCount++;
                }
              });

              r.totalMarks = String(grandTotal);

              // Dynamic percentage calculation based on actual curriculum
              const effectiveMax = Math.max(evaluatedMax, dynamicSubjectsCount * 100);
              r.percentage = effectiveMax > 0 ? ((grandTotal / effectiveMax) * 100).toFixed(1) : (r.percentage || '0');

              const mainPct = mainMax > 0 ? (mainTotal / mainMax) * 100 : 0;

              // Dynamic Pass / Fail / Compartment determination
              if (mainCount === 0) {
                r.resultStatus = 'PENDING';
                r.grade = '---';
              } else if (mainCount < expectedMainCount) {
                r.resultStatus = 'PENDING';
                r.grade = '---';
              } else if (failedMainCount > 0) {
                const maxCompartment = (tenantExamConfig && tenantExamConfig.passingCriteria && tenantExamConfig.passingCriteria.maxCompartmentSubjects !== undefined)
                  ? tenantExamConfig.passingCriteria.maxCompartmentSubjects
                  : 1;
                r.resultStatus = (failedMainCount <= maxCompartment) ? 'COMPARTMENT' : 'FAIL';
                r.grade = getUniversalServerGrade(r.percentage);
                if (r.grade === 'A1' || r.grade === 'A2' || r.grade === 'B1' || r.grade === 'B2') r.grade = 'D'; // Cap failed subjects grade
              } else if (mainPct >= tenantMinPassingPct) {
                r.resultStatus = 'PASS';
                r.grade = getUniversalServerGrade(r.percentage);
              } else {
                r.resultStatus = 'FAIL';
                r.grade = getUniversalServerGrade(r.percentage);
              }
            }
          });
        }
      } catch(e) {
        console.warn("Exam marks unification note:", e.message);
      }
    }

    return rows;
  } catch (err) {
    console.error(`Error in rawList for ${moduleName}:`, err.message);
    throw err;
  }
}

async function getStore(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryStoreCache && (now - memoryStoreCacheTime < STORE_CACHE_TTL_MS)) {
    return memoryStoreCache;
  }

  const store = {};
  const moduleKeys = Object.keys(MODULES).filter(m => m !== "faceEmbeddings");
  // Parallel edge pipeline

  try {
    const results = await Promise.allSettled(moduleKeys.map(m => rawList(m)));
    moduleKeys.forEach((m, idx) => {
      if (results[idx].status === "fulfilled") {
        store[m] = results[idx].value;
      } else {
        console.error(`[getStore] Failed to load module '${m}':`, results[idx].reason);
        store[m] = [];
      }
    });
    memoryStoreCache = store;
    memoryStoreCacheTime = Date.now();
    return store;
  } catch (err) {
    console.error("GETSTORE CRITICAL ERROR:", err);
    return memoryStoreCache || store;
  }
}

async function fullList(moduleName) {
  const heavyModules = ["students", "admissions", "teachers", "attendance", "exams", "faceEmbeddings"];
  const db = getDb(moduleName);

  try {
    if (heavyModules.includes(moduleName)) {
      // Fetch in paginated chunks to avoid Turso mem_hrana_response memory limits
      const allRows = [];
      const PAGE_SIZE = 25;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await db.execute({
          sql: `SELECT * FROM ${moduleName} ORDER BY id DESC LIMIT ? OFFSET ?`,
          args: [PAGE_SIZE, offset]
        });
        const rows = res.rows || [];
        allRows.push(...rows);
        if (rows.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += PAGE_SIZE;
        }
      }
      return allRows.map(r => normalizeRow(moduleName, r));
    } else {
      const res = await db.execute(`SELECT * FROM ${moduleName} ORDER BY id DESC`);
      return (res.rows || []).map(r => normalizeRow(moduleName, r));
    }
  } catch (err) {
    console.error(`Error in fullList for ${moduleName}:`, err.message);
    throw err;
  }
}

async function getFullStore() {
  const store = {};
  const moduleKeys = Object.keys(MODULES);
  const BATCH_SIZE = 3;

  try {
    for (let i = 0; i < moduleKeys.length; i += BATCH_SIZE) {
      const batch = moduleKeys.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(m => fullList(m)));
      batch.forEach((m, idx) => {
        if (results[idx].status === "fulfilled") {
          store[m] = results[idx].value;
        } else {
          console.error(`[getFullStore] Failed to load module '${m}':`, results[idx].reason);
          store[m] = [];
        }
      });
    }
    return store;
  } catch (err) {
    console.error("GETFULLSTORE CRITICAL ERROR:", err);
    return store;
  }
}

const withRetry = (fn) => async (...args) => {
  let retries = 0;
  while (true) {
    try {
      return await fn(...args);
    } catch (err) {
      if (err.message && (err.message.includes("busy") || err.message.includes("locked")) && retries < 3) {
        retries++;
        console.warn(`[DB] Database busy/locked, retrying (${retries}/3)...`);
        await new Promise(r => setTimeout(r, retries * 500));
      } else {
        throw err;
      }
    }
  }
};

module.exports = { 
  db, feeDb, MODULES, initDb, list, getById, getStore, getFullStore, resetAndSeed, runRaw, seedIfEmpty,
  getDb, normalizeRow, generateUniquePayId,
  DEFAULT_TURSO_URL, tursoHttpUrl, invalidateQueryCache, invalidateStoreCache, getStoreVersion,
  insert: withRetry(insert), 
  update: withRetry(update), 
  remove: withRetry(remove), 
  replaceAll: withRetry(replaceAll)
};
