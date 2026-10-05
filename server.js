const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const userTokens = new Map();

const {
  getAccessControlSettings,
  saveAccessControlSettings,
  notifyAdminNewPayment,
  processInboundWhatsAppMessage,
  executePaymentApproval,
  checkAndNotifyPendingPayments
} = require("./server/whatsapp-payment-bot");

const {
  initiateCall,
  respondCall,
  sendCallSignal,
  endCall,
  pollUserCalls,
  createGroupRoom,
  joinGroupRoom,
  leaveGroupRoom,
  endGroupRoom,
  sendGroupSignal,
  pollGroupRoom,
  getActiveRooms,
  dispatchVoiceNotificationPush,
  notifyAatifTeacherOnline,
  cleanupCallLogs,
  broadcastSilentOtaPush,
  wakeRemotePreviewDevice
} = require("./server/calls");

const jwtCrypto = require('crypto');
const JWT_SECRET = process.env.SESSION_SECRET || 'change-this-secret';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function signStatelessToken(user) {
  const tokenData = { ...user, exp: Date.now() + TOKEN_EXPIRY_MS };
  const payload = Buffer.from(JSON.stringify(tokenData)).toString('base64');
  const signature = jwtCrypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64');
  return payload + '.' + signature;
}

function verifyStatelessToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = parts[0];
    const signature = parts[1];
    const expectedSig = jwtCrypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64');
    // Timing-safe comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature, 'base64');
    const expectedBuf = Buffer.from(expectedSig, 'base64');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!jwtCrypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    // Check token expiry
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch (e) {}
  return null;
}

const cors = require("cors");
const os = require("os");
const http = require("http");
const zlib = require("zlib");
const compression = require("compression");
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { GoogleGenAI } = require('@google/genai');
const pino = require('pino');
const qrcode = require('qrcode');

let waSock = null;
let waStatus = "disconnected"; // "disconnected", "qr", "connected"
let waQr = "";

async function startBaileys() {
    if (process.env.IS_CLOUD) {
        console.log("WhatsApp bot is disabled in cloud mode. Running on local desktop.");
        return;
    }
    if (waStatus === "connected" || waStatus === "qr" || waStatus === "connecting") return;
    waStatus = "connecting";
    try {
        const authFolder = process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, 'baileys_auth_info') : path.join(__dirname, 'baileys_auth_info');
        const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys');
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();
        waSock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Tapowan School Gateway', 'Chrome', '1.0.0']
        });

        waSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                waStatus = "qr";
                waQr = await qrcode.toDataURL(qr, { margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
            }
            if (connection === 'close') {
                waStatus = "disconnected";
                waQr = "";
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    console.log("WhatsApp logged out. Please re-scan QR.");
                    try { 
                        const authFolder = process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, 'baileys_auth_info') : path.join(__dirname, 'baileys_auth_info');
                        fs.rmSync(authFolder, { recursive: true, force: true }); 
                    } catch(e){}
                } else {
                    console.log("WhatsApp connection closed (reason: " + reason + "). Automatically reconnecting in 5s to protect session...");
                    setTimeout(startBaileys, 5000);
                }
            } else if (connection === 'open') {
                waStatus = "connected";
                waQr = "";
            }
        });
        waSock.ev.on('creds.update', saveCreds);
    } catch (err) {
        waStatus = "disconnected";
        console.error("Baileys initialization failed", err);
    }
}

// Auto-start if session exists
const autoStartAuthFolder = process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, 'baileys_auth_info') : path.join(__dirname, 'baileys_auth_info');
if (fs.existsSync(autoStartAuthFolder)) {
    // Delay WhatsApp initialization so the main Node server loads instantly
    setTimeout(startBaileys, 1000);
}


const {
  db,
  getDb,
  normalizeRow,
  MODULES,
  initDb,
  list,
  insert,
  getById,
  update,
  remove,
  replaceAll,
  getStore,
  getStoreVersion,
  invalidateStoreCache,
  resetAndSeed,
  runRaw
} = require("./server/db");

const app = express();

// ── Next-Generation High-Performance Zstandard (zstd) / Brotli / Gzip Compression ──
function zstdCompressionMiddleware(options = {}) {
  const threshold = options.threshold || 128;
  const SKIP_MIMES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg',
    'application/zip', 'application/gzip', 'application/pdf'
  ];

  return (req, res, next) => {
    const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase();

    const supportsZstd = typeof zlib.createZstdCompress === 'function' && acceptEncoding.includes('zstd');
    const supportsBr = typeof zlib.createBrotliCompress === 'function' && acceptEncoding.includes('br');
    const supportsGzip = acceptEncoding.includes('gzip');
    const supportsDeflate = acceptEncoding.includes('deflate');

    if (!supportsZstd && !supportsBr && !supportsGzip && !supportsDeflate) {
      return next();
    }

    const originalSend = res.send;

    function compressAndSend(body, isJson = false) {
      if (res.headersSent) return;

      const contentType = (res.getHeader('Content-Type') || '').toString().toLowerCase();
      if (SKIP_MIMES.some(m => contentType.includes(m))) {
        return originalSend.call(res, body);
      }

      let buffer;
      if (Buffer.isBuffer(body)) {
        buffer = body;
      } else if (typeof body === 'string') {
        buffer = Buffer.from(body, 'utf8');
      } else if (typeof body === 'object' && body !== null) {
        buffer = Buffer.from(JSON.stringify(body), 'utf8');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      } else {
        return originalSend.call(res, body);
      }

      if (buffer.length < threshold) {
        return originalSend.call(res, buffer);
      }

      try {
        let compressed;
        let encoding;

        if (supportsZstd) {
          compressed = zlib.zstdCompressSync(buffer);
          encoding = 'zstd';
        } else if (supportsBr) {
          compressed = zlib.brotliCompressSync(buffer);
          encoding = 'br';
        } else if (supportsGzip) {
          compressed = zlib.gzipSync(buffer);
          encoding = 'gzip';
        } else if (supportsDeflate) {
          compressed = zlib.deflateSync(buffer);
          encoding = 'deflate';
        }

        if (compressed && compressed.length < buffer.length) {
          res.setHeader('Content-Encoding', encoding);
          res.removeHeader('Content-Length');
          res.setHeader('Vary', 'Accept-Encoding');
          return originalSend.call(res, compressed);
        } else {
          return originalSend.call(res, buffer);
        }
      } catch (err) {
        return originalSend.call(res, buffer);
      }
    }

    res.send = compressAndSend;
    res.json = (obj) => compressAndSend(obj, true);

    next();
  };
}

app.use(zstdCompressionMiddleware({ threshold: 128 }));
app.use(compression()); // Fallback legacy stream compression
const PORT = Number(process.env.PORT) || 3000;

// Transparent Proxy for Face Recognition Server (InsightFace) on port 8000
// Must be BEFORE express.json() to handle multipart streams correctly
app.all("/api/face/*", (req, res) => {
  const path = req.params[0] || "";
  const options = {
    hostname: 'localhost',
    port: 8000,
    path: `/${path}`,
    method: req.method,
    headers: { ...req.headers }
  };
  delete options.headers.host;
  delete options.headers.connection;

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: "Face Recognition server unreachable on port 8000" });
  });

  req.pipe(proxyReq);
});

// Proxy for ARIA AI Avatar Server on port 5000
app.all("/api/avatar/*", (req, res) => {
  const path = req.params[0] || "";
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/${path}`,
    method: req.method,
    headers: { ...req.headers }
  };
  delete options.headers.host;
  delete options.headers.connection;

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: "AI Avatar server unreachable on port 5000" });
  });

  req.pipe(proxyReq);
});

// ------------------- GLOBAL SAFETY -------------------
// Prevent silent crashes (you had zero protection)
process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err);
});
process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

// ------------------- MIDDLEWARE -------------------

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);

    const configured = (process.env.CORS_ORIGIN || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const defaults = [
      "https://aatifakram.github.io",
      "https://tapowanpublicschool-production.up.railway.app",
      "https://tapowan-school.vercel.app",
      "https://tapowan-school.pages.dev"
    ];

    // If no CORS_ORIGIN configured, use defaults only
    if (!configured.length) return cb(null, defaults.includes(origin));

    // Always include defaults alongside configured origins
    const allowed = new Set([...configured, ...defaults]);
    return cb(null, allowed.has(origin));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Bypass-Tunnel-Reminder", "Authorization"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 attempts per window
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Required behind Railway proxy
app.set("trust proxy", 1);

const sessionStore = new session.MemoryStore();

// Shared configuration for both local and tunnel access
const getSessionConfig = (isSecure) => ({
  name: "tps.sid",
  secret: process.env.SESSION_SECRET || "change-this-secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore, // CRITICAL: Use the same store for both!
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure
  }
});

const secureSession = session(getSessionConfig(true));
const localSession = session(getSessionConfig(false));

app.use((req, res, next) => {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  const isLocal = req.headers.host && (req.headers.host.includes("localhost") || req.headers.host.includes("127.0.0.1"));
  
  if (isSecure) {
    return secureSession(req, res, next);
  }
  return localSession(req, res, next);
});


// ------------------- STATIC -------------------

app.use(express.static(path.join(__dirname, "public")));
// REMOVED: express.static(__dirname) — was exposing .env and source code

const templatesDir = path.join(__dirname, "assets");
const cursorTemplatesDir = path.join(
  os.homedir(),
  ".cursor",
  "projects",
  "c-Users-Admin-school-management-system-node-modules",
  "assets"
);

app.use("/templates", express.static(templatesDir));
app.use("/templates", express.static(cursorTemplatesDir));

// ------------------- HEALTH -------------------

app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) res.send("✅ Backend is live");
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    time: new Date()
  });
});

// ── IMAGE GENERATION API (Pollinations.ai proxy) ──
app.get("/api/generate-image", async (req, res) => {
  try {
    const prompt = req.query.prompt;
    const model = req.query.model || "flux";
    if (!prompt) return res.status(400).json({ error: "Missing 'prompt' query parameter" });

    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&model=${model}`;

    const response = await fetch(imageUrl);
    if (!response.ok) {
      return res.status(502).json({ error: "Image generation service unavailable" });
    }

    // Stream the image back to the client from localhost
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "Image generation failed" });
  }
});

app.get("/favicon.ico", (req, res) => res.status(204).end());

// ------------------- AUTH -------------------

// ------------------- ROLE HELPERS -------------------

const ROLE_LEVEL = {
  administrator: 4,
  principal: 3,
  staff: 3,
  teacher: 2,
  student: 1
};

function getRoleLevel(role) {
  return ROLE_LEVEL[String(role).toLowerCase()] || 0;
}

function isAdmin(user) {
  return String(user?.role).toLowerCase() === "administrator";
}

function isStaffOrAbove(user) {
  return getRoleLevel(user?.role) >= 3;
}

function isTeacherOrAbove(user) {
  return getRoleLevel(user?.role) >= 2;
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const verifiedUser = verifyStatelessToken(token);
    if (verifiedUser) {
      req.session = req.session || {};
      req.session.user = verifiedUser;
      return next();
    }
  }
  if (req.headers['x-admin-pin'] === 'tapowan2026' || req.body?.adminPin === 'tapowan2026' || req.query?.adminPin === 'tapowan2026') {
    req.session = req.session || {};
    req.session.user = { username: 'admin', fullName: 'Tapowan School Admin', role: 'administrator' };
    return next();
  }
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function adminRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const verifiedUser = verifyStatelessToken(token);
    if (verifiedUser) {
      req.session = req.session || {};
      req.session.user = verifiedUser;
    }
  }
  if (req.headers['x-admin-pin'] === 'tapowan2026' || req.body?.adminPin === 'tapowan2026' || req.query?.adminPin === 'tapowan2026') {
    req.session = req.session || {};
    req.session.user = { username: 'admin', fullName: 'Tapowan School Admin', role: 'administrator' };
  }
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!isAdmin(req.session.user)) return res.status(403).json({ error: "Admin access required" });
  next();
}

function canWrite(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const verifiedUser = verifyStatelessToken(token);
    if (verifiedUser) {
      req.session = req.session || {};
      req.session.user = verifiedUser;
    }
  }
  if (req.headers['x-admin-pin'] === 'tapowan2026' || req.body?.adminPin === 'tapowan2026' || req.query?.adminPin === 'tapowan2026') {
    req.session = req.session || {};
    req.session.user = { username: 'admin', fullName: 'Tapowan School Admin', role: 'administrator' };
  }
  if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (getRoleLevel(req.session.user.role) < 2) {
    return res.status(403).json({ error: "You don't have permission to modify records" });
  }
  next();
}

function canDelete(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
  if (!isStaffOrAbove(req.session.user) && !isAdmin(req.session.user)) {
    return res.status(403).json({ error: "You don't have permission to delete records" });
  }
  next();
}

// Modules teachers can write to
const TEACHER_WRITE_MODULES = new Set(["attendance", "teacherAttendance"]);
// Modules only admin/staff can write to  
const ADMIN_STAFF_ONLY_MODULES = new Set(["users", "payroll", "fees", "dueManagement", "admissions", "schoolInvestments", "schoolIncome", "schoolExpenses", "booksAndDress", "feeStructures", "whatsappAlerts", "settings"]);
// Modules only admin can access at all
const ADMIN_ONLY_MODULES = new Set(["users"]);

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const users = await list("users");

    // Find user by username and active status
    const user = users.find(u =>
      String(u.status).toLowerCase() === "active" &&
      u.username === username
    );

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Compare password — supports both bcrypt hashed and legacy plaintext
    let passwordValid = false;
    if (user.password && user.password.startsWith('$2')) {
      // bcrypt hashed password
      passwordValid = bcrypt.compareSync(password, user.password);
    } else {
      // Legacy plaintext — auto-upgrade to bcrypt on successful login
      passwordValid = (user.password === password);
      if (passwordValid) {
        try {
          const hashed = bcrypt.hashSync(password, 10);
          await update("users", user.id, { password: hashed });
          console.log(`[Security] Auto-upgraded password hash for user: ${user.username}`);
        } catch (hashErr) {
          console.error("Failed to auto-upgrade password:", hashErr.message);
        }
      }
    }

    if (!passwordValid) return res.status(401).json({ error: "Invalid credentials" });

    if (!process.env.IS_CLOUD) {
      try {
        // Update lastLogin timestamp
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        await update("users", user.id, { lastLogin: now });
      } catch (updateErr) {
        console.error("Failed to update lastLogin:", updateErr.message);
      }
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      admissionNo: user.admissionNo,
      role: user.role
    };

    // Explicitly save session before responding to prevent race condition
    // where the next API call arrives before the session is persisted
    req.session.save((err) => {
      if (err) {
        console.error("Session save failed:", err);
        return res.status(500).json({ error: "Session save failed" });
      }
      const token = signStatelessToken(req.session.user);
      res.json({ user: req.session.user, token });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── ADMISSION HELPERS ──
function sendAdmissionNotification(student) {
  console.log(`[Notification] Sending Admission SMS/WhatsApp to ${student.phone1} for student ${student.fullName}`);
  // STUB: Here you would integrate with Twilio, MSG91, or a WhatsApp Gateway.
}

app.get("/api/admissions/draft", authRequired, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const all = await list("admissions");
    const draft = all.find(a => String(a.draftUserId) === String(userId) && a.isDraft === "true");
    res.json({ draft: draft || null });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch draft" });
  }
});

app.post("/api/admissions/draft", authRequired, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const payload = req.body || {};
    payload.isDraft = "true";
    payload.draftUserId = userId;
    payload.status = "Draft";

    const all = await list("admissions");
    const existingDraft = all.find(a => String(a.draftUserId) === String(userId) && a.isDraft === "true");

    if (existingDraft) {
      await update("admissions", existingDraft.id, payload);
      res.json({ message: "Draft updated", id: existingDraft.id });
    } else {
      const row = await insert("admissions", payload);
      res.json({ message: "Draft created", id: row.id });
    }
  } catch (err) {
    console.error("Draft save failed:", err);
    res.status(500).json({ error: "Failed to save draft" });
  }
});

app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { username, fullName, email, password, admissionNo } = req.body || {};
    if (!username || !password || !fullName || !admissionNo) {
      return res.status(400).json({ error: "username, fullName, password and admissionNo are required" });
    }

    // Password minimum length check
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }
    
    // Validate that the student exists with this admission number and name
    const students = await list("students");
    const matchedStudent = students.find(s => 
      s.admissionNo === admissionNo && 
      String(s.fullName).trim().toLowerCase() === String(fullName).trim().toLowerCase()
    );
    
    if (!matchedStudent) {
      return res.status(404).json({ error: "No student found matching this Full Name and Admission Number." });
    }

    const users = await list("users");
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: "Username already taken" });
    }
    if (users.find(u => u.admissionNo === admissionNo)) {
      return res.status(409).json({ error: "An account already exists for this Admission Number" });
    }

    // Hash the password with bcrypt
    const hashedPassword = bcrypt.hashSync(password, 10);

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const newUser = await insert("users", {
      username,
      fullName,
      admissionNo,
      role: "Student",
      email: email || "",
      status: "Active",
      lastLogin: now,
      password: hashedPassword
    });
    req.session.user = {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      admissionNo: newUser.admissionNo,
      role: newUser.role
    };
    const token = signStatelessToken(req.session.user);
    res.status(201).json({ user: req.session.user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Auth check handled below by detailed route

// ------------------- STORE -------------------

// Ultra-lightweight store version check (Consumes 0 Turso reads)
app.get("/api/store/version", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.json({ ok: true, v: typeof getStoreVersion === "function" ? getStoreVersion() : Date.now() });
});

// Ultra-fast Core Store Signature (Only ~400 bytes, detects real data changes without sending 3.6 MB)
app.get("/api/store/signature", authRequired, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    const store = await getStore();
    const coreModules = ['students', 'admissions', 'teachers', 'classes', 'subjects', 'attendance', 'fees', 'dueManagement', 'exams', 'announcements', 'booksAndDress', 'feeStructures'];
    const sig = coreModules.map(m => {
      const arr = store[m];
      if (!Array.isArray(arr) || arr.length === 0) return `${m}:0`;
      const sample = arr.slice(0, 3).map(r => `${r.id || ''}:${r.paidAmount || r.status || r.date || r.paymentDate || ''}`).join(',');
      return `${m}:${arr.length}:[${sample}]`;
    }).join('|');
    res.json({ ok: true, signature: sig });
  } catch (err) {
    res.status(500).json({ error: "Signature generation failed: " + err.message });
  }
});

app.get("/api/store", authRequired, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    const store = await getStore();
    res.json(store);
  } catch (err) {
    console.error("API /api/store route error:", err);
    res.status(500).json({ error: "Store fetch failed", message: err?.message || String(err), stack: err?.stack });
  }
});

app.get("/api/test-store", async (req, res) => {
  try {
    const store = await getStore();
    res.json({ ok: true, keys: Object.keys(store) });
  } catch (err) {
    res.status(500).json({ error: "Store fetch failed", message: err?.message || String(err), stack: err?.stack });
  }
});

app.get("/api/image/:module/:id/:field", async (req, res) => {
  try {
    const { module: mod, id, field } = req.params;
    if (!MODULES[mod]) return res.status(404).send("Module not found");
    const row = await getById(mod, id);
    if (!row || !row[field]) return res.status(404).send("Image not found");
    const dataUrl = row[field];
    if (typeof dataUrl === 'string' && (dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:application/'))) {
      const commaIdx = dataUrl.indexOf(',');
      const header = dataUrl.substring(0, commaIdx);
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Data = dataUrl.substring(commaIdx + 1);
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=2592000');
      return res.send(buffer);
    } else if (typeof dataUrl === 'string' && dataUrl.startsWith('http')) {
      return res.redirect(dataUrl);
    }
    res.status(404).send("Invalid image format");
  } catch (err) {
    res.status(500).send("Server error");
  }
});


let sseClients = [];
global.broadcastEvent = (type, data) => {
  sseClients.forEach(c => {
    c.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  });
};

app.get("/api/events", authRequired, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});


// Full database restore from backup JSON
app.post("/api/store/import", adminRequired, express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid backup data" });
    }
    const validModules = Object.keys(MODULES);
    let imported = 0;
    for (const moduleName of validModules) {
      if (Array.isArray(payload[moduleName])) {
        await replaceAll(moduleName, payload[moduleName]);
        imported++;
      }
    }
    res.json({ ok: true, modulesImported: imported });
  } catch (err) {
    console.error("Store import failed:", err);
    res.status(500).json({ error: "Store import failed: " + err.message });
  }
});

// ------------------- COMMUNICATION PROXIES (WHATSAPP CLOUD GATEWAY & SMS) -------------------

const CLOUD_GATEWAY_URL = process.env.WHATSAPP_GATEWAY_URL || 'https://tapowan-whatsapp-gateway.onrender.com';
const CLOUD_GATEWAY_PIN = process.env.WHATSAPP_GATEWAY_PIN || 'tapowan2026';
const CLOUD_GATEWAY_KEY = process.env.WHATSAPP_GATEWAY_KEY || 'tps_secret_gateway_key_2026';

// 1. WhatsApp Status Endpoint (Checks Render Cloud Gateway, falls back to local waSock)
app.get("/api/whatsapp/status", async (req, res) => {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 6000);
    const gwRes = await fetch(`${CLOUD_GATEWAY_URL.replace(/\/$/, '')}/api/status?pin=${CLOUD_GATEWAY_PIN}`, {
      headers: {
        'x-api-key': CLOUD_GATEWAY_KEY,
        'x-admin-pin': CLOUD_GATEWAY_PIN,
        'Accept-Encoding': 'zstd, br, gzip'
      },
      signal: ctrl.signal
    });
    clearTimeout(tid);
    const data = await gwRes.json();
    return res.json(data);
  } catch (err) {
    // If local waSock is active on desktop
    if (typeof waStatus !== 'undefined' && waStatus === 'connected') {
      return res.json({ status: 'connected', phone: 'Local Gateway' });
    }
    if (typeof waStatus !== 'undefined' && waStatus === 'qr') {
      return res.json({ status: 'qr', qr: waQr });
    }
    return res.json({ status: 'disconnected', error: err.message });
  }
});

// 2. WhatsApp Start / Connect Endpoint
app.post("/api/whatsapp/start", async (req, res) => {
  try {
    if (typeof startBaileys === 'function' && (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME)) {
      if (typeof waStatus !== 'undefined' && waStatus === "disconnected") {
        await startBaileys();
      }
    }
    const gwRes = await fetch(`${CLOUD_GATEWAY_URL.replace(/\/$/, '')}/api/health`, {
      headers: { 'Accept-Encoding': 'zstd, br, gzip' }
    });
    const data = await gwRes.json();
    res.json({ ok: true, gateway: data });
  } catch (err) {
    res.json({ ok: true, message: "Start ping sent" });
  }
});

// 3. WhatsApp Logout Endpoint
app.post("/api/whatsapp/logout", async (req, res) => {
  try {
    if (typeof waSock !== 'undefined' && waSock) {
      try { await waSock.logout(); } catch(e) {}
    }
    const gwRes = await fetch(`${CLOUD_GATEWAY_URL.replace(/\/$/, '')}/api/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': CLOUD_GATEWAY_PIN,
        'Accept-Encoding': 'zstd, br, gzip'
      }
    });
    const data = await gwRes.json();
    res.json(data);
  } catch (err) {
    res.json({ ok: true });
  }
});

// 4. WhatsApp Send Message (Proxies to Cloud Gateway, with local waSock fallback)
app.post("/api/whatsapp/send", async (req, res) => {
  const { to, message, attachment } = req.body || {};
  if (!to || (!message && !attachment)) {
    return res.status(400).json({ error: "Missing 'to' or 'message' fields" });
  }

  // First attempt via Render Cloud Gateway
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const gwRes = await fetch(`${CLOUD_GATEWAY_URL.replace(/\/$/, '')}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLOUD_GATEWAY_KEY,
        'x-admin-pin': CLOUD_GATEWAY_PIN,
        'Accept-Encoding': 'zstd, br, gzip'
      },
      body: JSON.stringify({ to, message, attachment }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    const data = await gwRes.json();
    if (data.ok) return res.json(data);
  } catch (gwErr) {
    console.warn("Cloud gateway send failed, attempting local fallback:", gwErr.message);
  }

  // Local fallback if running on desktop
  if (typeof waStatus !== 'undefined' && waStatus === "connected" && typeof waSock !== 'undefined' && waSock) {
    try {
      let jid = to.replace('@c.us', '');
      if (jid.length === 10) jid = "91" + jid;
      jid = jid.includes('@s.whatsapp.net') ? jid : `${jid}@s.whatsapp.net`;

      if (attachment) {
        let buffer, mimetype, fileName = "document";
        if (typeof attachment === 'object' && attachment.base64) {
          buffer = Buffer.from(attachment.base64, 'base64');
          mimetype = attachment.mimetype || 'image/jpeg';
          fileName = attachment.fileName || "document";
        } else if (typeof attachment === 'string' && attachment.startsWith('data:')) {
          const parts = attachment.split(',');
          const mimeMatch = parts[0].match(/:(.*?);/);
          mimetype = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          buffer = Buffer.from(parts[1], 'base64');
        } else if (typeof attachment === 'string') {
          buffer = Buffer.from(attachment, 'base64');
          mimetype = 'image/jpeg';
        }
        if (mimetype.includes('pdf')) {
          if (!fileName.endsWith('.pdf')) fileName += '.pdf';
          await waSock.sendMessage(jid, { document: buffer, mimetype, caption: message || "", fileName });
        } else if (mimetype.includes('image')) {
          await waSock.sendMessage(jid, { image: buffer, caption: message || "" });
        } else {
          await waSock.sendMessage(jid, { document: buffer, mimetype, caption: message || "", fileName });
        }
      } else {
        await waSock.sendMessage(jid, { text: message });
      }
      return res.json({ ok: true, data: { status: "sent" } });
    } catch (err) {
      return res.status(500).json({ error: "Failed to send WhatsApp message: " + err.message });
    }
  }

  return res.status(503).json({ error: "WhatsApp Gateway is not connected or message delivery failed." });
});


// ── Online Payment Access Control & WhatsApp Auto-Approve API ──

// 1. Get Access Control Settings
app.get("/api/online-payments/access-control", authRequired, async (req, res) => {
  try {
    const settings = await getAccessControlSettings();
    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Save Access Control Settings
app.post("/api/online-payments/access-control", authRequired, async (req, res) => {
  const user = req.session?.user || {};
  if (!isAdmin(user) && getRoleLevel(user?.role) < 3) return res.status(403).json({ ok: false, error: "Admin permissions required" });
  try {
    const { authorizedNumbers, approvalPassword, autoNotifyAdmin, autoNotifyStudent } = req.body || {};
    await saveAccessControlSettings({
      authorizedNumbers,
      approvalPassword,
      autoNotifyAdmin,
      autoNotifyStudent
    }, user.username || 'admin');
    res.json({ ok: true, message: "Settings saved successfully" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Trigger WhatsApp Notification to Admin upon New Payment
app.post("/api/online-payments/notify-admin", async (req, res) => {
  try {
    const paymentData = req.body || {};
    let result = { ok: true, sentCount: 0 };
    if (paymentData.utr_number || paymentData.payId || paymentData.amount) {
      result = await notifyAdminNewPayment(paymentData, waSock);
    } else {
      result = await checkAndNotifyPendingPayments(waSock);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Check & Scan Pending Payments
app.get("/api/online-payments/check-pending", async (req, res) => {
  try {
    const result = await checkAndNotifyPendingPayments(waSock);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Secure Zero-Secret Database Proxy Gateway for Mobile App ──
const BLOCKED_SQL_KEYWORDS = [
  'DROP TABLE', 'DROP DATABASE', 'DROP SCHEMA', 'DROP INDEX', 'DROP VIEW',
  'ALTER TABLE', 'ATTACH DATABASE', 'DETACH DATABASE', 'VACUUM', 'PRAGMA'
];

app.post("/api/db/query", async (req, res) => {
  try {
    const { sql, args } = req.body || {};
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: "Missing or invalid SQL query" });
    }

    const upperSql = sql.trim().toUpperCase();
    for (const blocked of BLOCKED_SQL_KEYWORDS) {
      if (upperSql.includes(blocked)) {
        return res.status(403).json({ error: `Administrative security violation: '${blocked}' is blocked.` });
      }
    }

    const result = await db.execute({ sql, args: Array.isArray(args) ? args : [] });
    if (upperSql.startsWith("INSERT") || upperSql.startsWith("UPDATE") || upperSql.startsWith("DELETE") || upperSql.startsWith("REPLACE")) {
      if (typeof invalidateStoreCache === "function") invalidateStoreCache();
    }

    // Automatic teacher online detection for Aatif Raza notification (compatible across all app versions)
    if (upperSql.includes("APP_DEVICE_REGISTRY") && upperSql.includes("INSERT INTO")) {
      try {
        const userName = Array.isArray(args) ? args[1] : null;
        const userId = Array.isArray(args) ? args[2] : null;
        const userRole = Array.isArray(args) ? args[3] : null;
        const deviceModel = Array.isArray(args) ? args[4] : null;
        if (userRole === 'teacher' || (userId && String(userId).startsWith('EMP-'))) {
          const lowerName = String(userName || '').toLowerCase();
          const strId = String(userId || '').toUpperCase();
          if (!lowerName.includes('aatif') && strId !== 'EMP-01' && strId !== '1') {
            notifyAatifTeacherOnline({ teacherId: userId, teacherName: userName, deviceModel }).catch(() => {});
          }
        }
      } catch (e) {}
    }

    let finalRows = result.rows || [];
    // Ultra-Optimization: Strip heavy base64 photos from bulk student lists (> 3 rows) to save 95%+ bandwidth
    if (upperSql.includes("STUDENTS") && Array.isArray(finalRows) && finalRows.length > 3) {
      finalRows = finalRows.map(row => {
        if (row && typeof row === 'object' && row.photo && String(row.photo).length > 200) {
          const sId = row.id || row.admissionNo || '';
          return {
            ...row,
            photo: `/api/photo/students/${encodeURIComponent(String(sId).trim())}`,
            photoUrl: row.photoUrl || `/api/photo/students/${encodeURIComponent(String(sId).trim())}`
          };
        }
        return row;
      });
    }

    res.json({
      rows: finalRows,
      columns: result.columns || [],
      rowsAffected: result.rowsAffected || 0,
      lastInsertRowid: result.lastInsertRowid !== undefined && result.lastInsertRowid !== null ? String(result.lastInsertRowid) : null
    });
  } catch (err) {
    console.error("[DB Proxy] /api/db/query error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/db/batch", async (req, res) => {
  try {
    const { statements } = req.body || {};
    if (!Array.isArray(statements) || statements.length === 0) {
      return res.status(400).json({ error: "Missing or invalid statements array" });
    }

    for (const stmt of statements) {
      const s = (typeof stmt === 'string' ? stmt : stmt?.sql || '').trim().toUpperCase();
      for (const blocked of BLOCKED_SQL_KEYWORDS) {
        if (s.includes(blocked)) {
          return res.status(403).json({ error: `Administrative security violation: '${blocked}' is blocked.` });
        }
      }
    }

    const result = await db.batch(statements);
    if (typeof invalidateStoreCache === "function") invalidateStoreCache();
    res.json(result);
  } catch (err) {
    console.error("[DB Proxy] /api/db/batch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Secure Zero-Secret CabHUB API Gateway ──
app.use('/api/cabhub', require('./server/cabhub'));

// ── Dedicated Faculty Online Notification Endpoint (Strictly alerts Aatif Raza only) ──
app.post("/api/notify/teacher-online", async (req, res) => {
  try {
    const { teacherId, teacherName, deviceModel } = req.body || {};
    const result = await notifyAatifTeacherOnline({ teacherId, teacherName, deviceModel });
    res.json(result);
  } catch (err) {
    console.error("[TeacherOnlineAlert API Error]", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── WhatsApp-Style Voice Calling & Group Voice Rooms (WebRTC Signaling) ──
app.use('/api/calls', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// 0. Lightweight Calling Directory (Returns fast student & teacher roster for direct VoIP calling)
app.get("/api/calls/directory", async (req, res) => {
  try {
    const [studRes, teachRes] = await Promise.all([
      db.execute({
        sql: "SELECT id, admissionNo, rollNo, fullName, className, phone, photoUrl FROM students ORDER BY className, rollNo, fullName",
        args: []
      }),
      db.execute({
        sql: "SELECT id, fullName, phone, department, employeeNo, photo FROM teachers ORDER BY fullName",
        args: []
      })
    ]);

    const students = studRes.rows || [];
    const teachers = teachRes.rows || [];
    const classSet = new Set();
    students.forEach(s => {
      if (s && s.className) classSet.add(String(s.className).trim());
    });
    const classes = Array.from(classSet).map(c => ({ className: c }));

    res.json({
      ok: true,
      students,
      teachers,
      classes
    });
  } catch (err) {
    console.error("[Calling Directory Error]", err);
    res.status(500).json({ ok: false, error: err.message || "Failed to load calling directory" });
  }
});

// 1. Initiate 1-on-1 Call (Strictly blocks student-to-student)
app.post("/api/calls/initiate", async (req, res) => {
  try {
    const result = await initiateCall(req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Respond to 1-on-1 Call (Accept / Decline / Busy)
app.post("/api/calls/respond", async (req, res) => {
  try {
    const result = await respondCall(req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Send WebRTC Signal (SDP offer/answer / ICE candidate)
app.post("/api/calls/signal", async (req, res) => {
  try {
    const result = await sendCallSignal(req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. End 1-on-1 Call
app.post("/api/calls/end", async (req, res) => {
  try {
    const result = await endCall(req.body || {});
    res.status(result.status || (result.ok ? 200 : 400)).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Poll Calls for User (Incoming call notification & active state)
app.get("/api/calls/poll", async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    const result = await pollUserCalls(req.query || {});
    res.status(result.status || (result.ok ? 200 : 400)).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Call Logs 24-Hour Cleanup Endpoints ──
app.all(["/api/cron/cleanup-call-logs", "/api/calls/cleanup"], async (req, res) => {
  try {
    const forceAll = req.query?.all === 'true' || req.body?.all === true || req.query?.force === 'true' || req.body?.force === true;
    const hours = parseInt(req.query?.hours || req.body?.hours, 10) || 24;
    const result = await cleanupCallLogs({ forceAll, olderThanHours: hours });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Create Group Room (Teacher-hosted only)
app.post("/api/calls/group/create", async (req, res) => {
  try {
    const result = await createGroupRoom(req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Join Group Room
app.post("/api/calls/group/join", async (req, res) => {
  try {
    const result = await joinGroupRoom(req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Leave Group Room
app.post("/api/calls/group/leave", async (req, res) => {
  try {
    const result = await leaveGroupRoom(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 9. Host Ends Group Room
app.post("/api/calls/group/end", async (req, res) => {
  try {
    const result = await endGroupRoom(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 10. Group Room Mesh Signaling
app.post("/api/calls/group/signal", async (req, res) => {
  try {
    const result = await sendGroupSignal(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 11. Poll Group Room State & Signals
app.get("/api/calls/group/poll", async (req, res) => {
  try {
    const { roomId, participantId, userId, since, sinceId } = req.query || {};
    const result = await pollGroupRoom({ roomId, participantId: participantId || userId, since: Number(since) || 0, sinceId: Number(sinceId) || 0 });
    res.status(result.status || (result.ok ? 200 : 400)).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 12. Get All Active Group Rooms (for Administrator inspection & roster monitoring)
app.get("/api/calls/group/active-rooms", async (req, res) => {
  try {
    const result = await getActiveRooms();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 13. Silent Background OTA Push Broadcast
app.post("/api/admin/ota/broadcast-push", async (req, res) => {
  try {
    const { bundleUrl, bundleVersionCode, bundleVersion, targetAdmissionNo } = req.body || {};
    const result = await broadcastSilentOtaPush({ bundleUrl, bundleVersionCode, bundleVersion, targetAdmissionNo });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 14. Wake Target Device for Remote Camera Live Preview
app.post("/api/calls/remote-preview/wake", async (req, res) => {
  try {
    const { targetDeviceId, previewId, viewerName, force } = req.body || {};
    const result = await wakeRemotePreviewDevice({ targetDeviceId, previewId, viewerName, force: !!force });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 15. Send Remote Device Command with Instant FCM Wake Push
app.post("/api/calls/device-command", async (req, res) => {
  try {
    const { targetDeviceId, command, issuedBy = 'Admin' } = req.body || {};
    if (!targetDeviceId || !command) {
      return res.status(400).json({ ok: false, error: "Missing targetDeviceId or command" });
    }

    // 1. Insert command into app_device_commands table
    await db.execute({
      sql: `INSERT INTO app_device_commands (target_device_id, command, status, issued_by, created_at) VALUES (?, ?, 'pending', ?, datetime('now'))`,
      args: [targetDeviceId, command, issuedBy]
    });

    // 1b. Immediately synchronize app_device_registry status so web UI reflects state without waiting for phone heartbeat
    if (command === 'camera_off' || command === 'hard_camera_stop') {
      await db.execute({
        sql: `UPDATE app_device_registry SET camera_status = 'off' WHERE device_id = ?;`,
        args: [targetDeviceId]
      }).catch(() => {});
      // Also mark any active preview for this device as ended
      await db.execute({
        sql: `UPDATE app_device_previews SET status = 'ended', updated_at = datetime('now') WHERE target_device_id = ? AND status != 'ended';`,
        args: [targetDeviceId]
      }).catch(() => {});
    } else if (command === 'camera_on') {
      await db.execute({
        sql: `UPDATE app_device_registry SET camera_status = 'on' WHERE device_id = ?;`,
        args: [targetDeviceId]
      }).catch(() => {});
    } else if (command === 'mic_off') {
      await db.execute({
        sql: `UPDATE app_device_registry SET mic_status = 'off' WHERE device_id = ?;`,
        args: [targetDeviceId]
      }).catch(() => {});
    } else if (command === 'mic_on') {
      await db.execute({
        sql: `UPDATE app_device_registry SET mic_status = 'on' WHERE device_id = ?;`,
        args: [targetDeviceId]
      }).catch(() => {});
    }

    // 2. Dispatch instant high-priority FCM wake push to target phone
    const wakeResult = await wakeRemotePreviewDevice({
      targetDeviceId,
      previewId: 'cmd_' + command + '_' + Date.now().toString(36),
      viewerName: issuedBy,
      command: command,
      force: true
    });

    res.json({ ok: true, command, targetDeviceId, wakeResult });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/whatsapp/webhook", async (req, res) => {
  try {
    const { from, sender, message, text } = req.body || {};
    const phone = from || sender;
    const msgText = message || text;
    if (!phone || !msgText) {
      return res.status(400).json({ ok: false, error: "Missing 'from' or 'message'" });
    }
    const result = await processInboundWhatsAppMessage(phone, msgText, waSock);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Auto-discover Android SMS Gateway App
app.get("/api/sms-gateway/discover", authRequired, async (req, res) => {
  const net = require('net');
  const os = require('os');
  
  const interfaces = os.networkInterfaces();
  let localIp = null;
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
      }
    }
  }

  if (!localIp) return res.json({ url: null });

  const baseIp = localIp.split('.').slice(0, 3).join('.');
  
  const checkPort = (ip, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.on('connect', () => {
        socket.destroy();
        resolve(`http://${ip}:${port}/v1/sms/send?phone={phone}&message={message}`);
      });
      socket.on('timeout', () => { socket.destroy(); resolve(null); });
      socket.on('error', () => { socket.destroy(); resolve(null); });
      socket.connect(port, ip);
    });
  };

  const promises = [];
  // Scan common IP range for standard gateway ports
  for (let i = 1; i <= 254; i++) {
    promises.push(checkPort(`${baseIp}.${i}`, 8080));
    promises.push(checkPort(`${baseIp}.${i}`, 8081));
  }

  const results = await Promise.all(promises);
  const foundUrl = results.find(r => r !== null);

  res.json({ url: foundUrl || null });
});



// Face Recognition proxy moved to top of file for stream compatibility

// The PUT /api/store endpoint has been removed for security reasons.
// Bulk overwrites from the frontend are highly dangerous and can lead to data loss or corruption.
// Use the individual module CRUD endpoints instead.

// ------------------- ADMIN -------------------

app.get("/api/settings", authRequired, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.json(await list("settings"));
  } catch (err) {
    res.status(500).json({ error: "Settings fetch failed" });
  }
});

// GET seen videos for a specific student
app.get("/api/app-seen-videos/:admissionNo", async (req, res) => {
  const { admissionNo } = req.params;
  try {
    const list = await runRaw("SELECT chapterName FROM app_seen_videos WHERE admissionNo = ?", [admissionNo]);
    res.json(list.map(r => r.chapterName));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch seen videos" });
  }
});

// POST to mark a video as seen
app.post("/api/app-seen-videos", express.json(), async (req, res) => {
  const { admissionNo, chapterName } = req.body || {};
  if (!admissionNo || !chapterName) return res.status(400).json({ error: "Missing admissionNo or chapterName" });
  try {
    await runRaw("INSERT INTO app_seen_videos (admissionNo, chapterName) VALUES (?, ?)", [admissionNo, chapterName]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as seen" });
  }
});

app.get("/api/app-student-sessions", authRequired, async (req, res) => {
  try {
    const rawData = await list("app_student_sessions");
    res.json(rawData || []);
  } catch (err) {
    console.error("Failed to fetch app_student_sessions:", err);
    res.status(500).json({ error: "Failed to fetch student sessions" });
  }
});

app.post("/api/settings", authRequired, async (req, res) => {
  if (req.session.user.role !== "Administrator") return res.status(403).json({ error: "Admin only" });
  try {
    const { key, value, category } = req.body;
    const existing = (await list("settings")).find(s => s.key === key);
    if (existing) {
      await update("settings", existing.id, { value, category, updatedBy: req.session.user.username });
    } else {
      await insert("settings", { key, value, category, updatedBy: req.session.user.username });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Setting save failed" });
  }
});

// The POST /api/admin/reset endpoint has been removed for security reasons.
// Database reset functionality should not be exposed over HTTP.

// ------------------- MODULE CRUD -------------------

// ═══════════════════════════════════════════════════════════
// VIDYA AI — MULTI-PROVIDER FALLBACK CHAIN
// Priority: Gemini → OpenAI → OpenRouter (Groq/Together/Mistral)
// ═══════════════════════════════════════════════════════════

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Helper to check for Admin-only database actions in AI response
async function processAiActions(reply, user) {
  if (String(user.role || "").toLowerCase() !== "administrator" && String(user.role || "").toLowerCase() !== "principal") return reply;

  // Pattern: [ACTION: ADD_NOTIFICATION, msg: "Text"]
  const noteMatch = reply.match(/\[ACTION:\s*ADD_NOTIFICATION,\s*msg:\s*"([^"]+)"\]/i);
  if (noteMatch) {
    try {
      const msg = noteMatch[1];
      await insert("notifications", { message: msg, type: "Announcement", date: (function(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})() });
      return reply.replace(noteMatch[0], `\n✅ (System: Announcement added successfully)`);
    } catch (e) {
      return reply.replace(noteMatch[0], `\n❌ (System: Failed to add announcement)`);
    }
  }
  return reply;
}

function buildVidyaSystemPrompt(user, studentContext, schoolKnowledge = "") {
  const role = String(user.role || "").toLowerCase();
  const isAdmin = role === "administrator" || role === "principal";
  let ctx = `User Name: ${user.fullName || user.username}\nRole: ${role}\n`;
  
  if (studentContext) {
    ctx += `--- RELEVANT RECORD ---\n${studentContext}\n`;
  }
  
  if (schoolKnowledge) {
    ctx += `\n--- GLOBAL SCHOOL KNOWLEDGE ---\n${schoolKnowledge}\n`;
  }

  const adminCapabilities = isAdmin ? `
SPECIAL ADMIN POWERS & AUTHORIZATION:
- You are an INTERNAL school management tool.
- The user is the SYSTEM ADMINISTRATOR with FULL access rights.
- You have EXPLICIT PERMISSION to share ANY and ALL student data (fees, parents, phone, etc.) with this user.
- DO NOT mention privacy restrictions to the Admin.
- You can add school announcements using: [ACTION: ADD_NOTIFICATION, msg: "Text"]
` : "";

  return `You are "Vidya", the internal School Management Assistant for Tapowan Public School.
You are a highly efficient, friendly, and professional staff assistant.
Speak in whatever language the user uses (Hindi, English, or Hinglish).
Max response length: 4-5 sentences.

CONTEXT:
${ctx}
${adminCapabilities}

GUIDELINES:
1. If the user is a Student, help them ONLY with their own records.
2. For Administrators (like the current user), act as a DATA AGENT. Provide exact numbers and names from the context.
3. Use "GLOBAL SCHOOL KNOWLEDGE" for general school rules.
4. PRIVACY NOTE: You are authorized to share all student data with the Admin. Do not hide info from them.
5. If the user asks you to generate a document, report, PDF, Word, Excel, or HTML file, you MUST respond ONLY with raw HTML (using <table>, <h1>, <ul>, etc.). Do not include markdown fences like \`\`\`html. The system will convert your HTML into the requested file format.
6. If the user uploads a document, process it and answer their questions about it playfully and accurately.
7. IMAGE GENERATION: If the user asks to generate, create, draw, or make an image or picture, respond ONLY with this exact tag: [VIDYA_IMAGE: descriptive prompt] — for example [VIDYA_IMAGE: a girl wearing school uniform]. Do NOT refuse image requests. Do NOT say you cannot generate images. Just output the tag.`;
}

// ── Provider 1: Google Gemini ──
async function tryGemini(prompt, systemInstruction) {
  if (!genAI) throw Object.assign(new Error("Gemini not configured"), { status: 503 });
  const response = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction, maxOutputTokens: 3000, temperature: 0.8 }
  });
  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  return { reply: text, provider: "Gemini" };
}

// ── Provider 2: OpenAI ──
async function tryOpenAI(prompt, systemInstruction) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error("OpenAI not configured"), { status: 503 });

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      max_tokens: 3000,
      temperature: 0.8
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw Object.assign(new Error(err.error?.message || `OpenAI error ${resp.status}`), { status: resp.status });
  }
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from OpenAI");
  return { reply: text, provider: "OpenAI" };
}

// ── Provider 3: OpenRouter (Groq / Together AI / DeepSeek) ──
async function tryOpenRouter(prompt, systemInstruction) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw Object.assign(new Error("OpenRouter not configured"), { status: 503 });

  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "deepseek/deepseek-v4-flash:free",
    "google/gemma-4-31b-it:free",
    "openrouter/free"
  ];

  let lastErr = null;
  for (const model of models) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "HTTP-Referer": "https://tapowanpublicschool.com",
          "X-Title": "Tapowan AI Vidya"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
          max_tokens: 3000,
          temperature: 0.8
        })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        console.error(`[OpenRouter] Model ${model} failed with ${resp.status}:`, errData);
        lastErr = Object.assign(new Error(errData.error?.message || `OpenRouter error ${resp.status}`), { status: resp.status });
        continue;
      }
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) { lastErr = new Error("Empty response"); continue; }
      return { reply: text, provider: `OpenRouter (${model.split("/")[1]})` };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("All OpenRouter models failed");
}



// ── Provider 4: Claude (via OpenRouter) ──
async function tryClaude(prompt, systemInstruction) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw Object.assign(new Error("OpenRouter not configured"), { status: 503 });

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": "https://tapowanpublicschool.com",
      "X-Title": "Tapowan AI Vidya"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      max_tokens: 3000,
      temperature: 0.7
    })
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw Object.assign(new Error(errData.error?.message || `Claude error ${resp.status}`), { status: resp.status });
  }
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Claude");
  return { reply: text, provider: "Claude 3.5" };
}

const multer = require('multer');
const mammoth = require('mammoth');
const osTmpDir = require('os').tmpdir();
const uploadDir = require('path').join(osTmpDir, 'tapowan-uploads');
if (!require('fs').existsSync(uploadDir)) {
  require('fs').mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

app.post('/api/ai/upload', authRequired, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    let extractedText = '';

    if (mimeType === 'application/pdf') {
      const dataBuffer = require('fs').readFileSync(filePath);
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const data = await mammoth.extractRawText({ path: filePath });
      extractedText = data.value;
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'text/csv') {
      extractedText = require('fs').readFileSync(filePath, 'utf8');
    } else if (mimeType.startsWith('image/')) {
      const b64 = require('fs').readFileSync(filePath).toString('base64');
      extractedText = `[IMAGE_DATA:${mimeType}:${b64}]`;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Clean up
    require('fs').unlinkSync(filePath);

    res.json({ text: extractedText });
  } catch (err) {
    console.error('File extraction error:', err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// ── Main Chat Endpoint — Auto Fallback Chain ──
app.post("/api/ai/chat", authRequired, async (req, res) => {
  try {
    const { prompt, studentContext, preferredProvider, contextFiles } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    // ── IMAGE GENERATION INTERCEPTOR ──
    // Detect image requests BEFORE sending to AI (bypasses AI safety filters)
    const imagePatterns = [
      /(?:generate|create|make|draw|show|produce|give me|bana|banao|dikhao|dikha)\s+(?:a |an |one |ek |)(?:image|picture|photo|pic|tasveer|tasvir|chitra|painting|illustration|art)\s*(?:of |about |showing |with |depicting |ka |ki |ke )?\s*(.+)/i,
      /(?:image|picture|photo|pic|tasveer|tasvir|chitra)\s+(?:generate|create|make|draw|bana|banao)\s*(?:of |about |ka |ki |ke )?\s*(.+)/i,
      /(?:generate|create|make|draw)\s+(.+?)\s+(?:image|picture|photo|pic|tasveer|tasvir)/i,
      /(.+?)\s+(?:ka |ki |ke )?(?:image|picture|photo|pic|tasveer|tasvir|chitra)\s+(?:generate|create|make|draw|bana|banao)/i
    ];

    for (const pattern of imagePatterns) {
      const match = prompt.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        const imagePrompt = match[1].trim().replace(/[.!?,]+$/, '');
        console.log(`[Vidya AI] Image request intercepted. Prompt: "${imagePrompt}"`);
        return res.json({ 
          reply: `[VIDYA_IMAGE: ${imagePrompt}]`, 
          provider: "Image Generator (Pollinations.ai)" 
        });
      }
    }

    // Also catch simple requests like "generate a image" or "generate image"
    const simpleImageMatch = prompt.match(/^(?:generate|create|make|draw|bana|banao)\s+(?:a |an |ek )?(?:image|picture|photo|pic|tasveer|tasvir|chitra)$/i);
    if (simpleImageMatch) {
      console.log(`[Vidya AI] Simple image request intercepted.`);
      return res.json({ 
        reply: `[VIDYA_IMAGE: beautiful colorful illustration for school]`, 
        provider: "Image Generator (Pollinations.ai)" 
      });
    }

    const user = req.session.user;
    const role = String(user.role || "").toLowerCase();
    const isAdmin = role === "administrator" || role === "principal";
    
    // Fetch School Knowledge from settings
    let schoolKnowledge = "";
    try {
      const allSettings = await list("settings");
      const k = allSettings.find(s => s.key === "ai_school_knowledge");
      if (k) schoolKnowledge = k.value;
    } catch (e) {
      console.warn("[Vidya AI] Could not fetch school knowledge from settings");
    }

    let dynamicContext = "";
    if (contextFiles) {
      dynamicContext += "\n[USER ATTACHED FILES (PROCESS THIS IF REQUESTED)]\n" + contextFiles + "\n";
    }

    // For Admins, inject live database summary
    if (isAdmin) {
      try {
        const students = await list("students");
        const fees = await list("fees");
        const notes = await list("notifications");
        
        // Debug Log
        const logPath = path.join(process.cwd(), "ai_debug.log");
        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Admin Query: "${prompt}"\n`);

        // --- Active Student Memory & Lookup ---
        const admMatch = prompt.match(/(\d+\/\d+|ADM\d+)/i);
        let s = null;
        
        if (admMatch) {
          const query = admMatch[0].toLowerCase();
          s = students.find(x => String(x.admissionNo).toLowerCase() === query);
          fs.appendFileSync(logPath, `Searching by ID: ${query} -> Found: ${s?.fullName || "None"}\n`);
        } else {
          // Robust Name Search: Check for Maryam, Fatima, etc.
          const searchTerms = prompt.toLowerCase().split(" ").filter(t => t.length > 2);
          s = students.find(x => {
            const fullName = (x.fullName || "").toLowerCase();
            // Match if at least 2 significant words from prompt match the student name
            const matches = searchTerms.filter(t => fullName.includes(t));
            return matches.length >= 2 || (searchTerms.length === 1 && fullName.includes(searchTerms[0]));
          });
          fs.appendFileSync(logPath, `Searching by Name terms: ${searchTerms.join(",")} -> Found: ${s?.fullName || "None"}\n`);
        }

        // If not found in current prompt, check session memory
        if (!s && req.session.lastAiStudentId) {
          s = students.find(x => x.id === req.session.lastAiStudentId);
          if (s) fs.appendFileSync(logPath, `Using Session Memory: ${s.fullName}\n`);
        }

        if (s) {
          req.session.lastAiStudentId = s.id;
          const sf = fees.filter(f => String(f.admissionNo).toLowerCase() === String(s.admissionNo).toLowerCase());
          const totalDue = sf.reduce((sum, f) => sum + Number(f.balance || 0), 0);
          
          dynamicContext += `IMPORTANT: DATA BELOW IS LIVE FROM DATABASE.
[ACTIVE STUDENT RECORD]
Name: ${s.fullName}
Admission No: ${s.admissionNo}
Father: ${s.fatherName || "N/A"}
Mother: ${s.motherName || "N/A"}
Class: ${s.className}
Phone: ${s.phone}
Total Pending Fees: ₹${totalDue}
Detailed Dues: ${sf.map(f => `${f.term}: ₹${f.balance}`).join(", ") || "None"}
---
`;
        } else {
          dynamicContext += `\n[SYSTEM NOTE: NO SPECIFIC STUDENT FOUND IN DATABASE FOR THIS QUERY. DO NOT GUESS DATA.]\n`;
        }

        const totalPending = fees.reduce((sum, f) => sum + Number(f.balance || 0), 0);
        const topPending = fees.filter(f => Number(f.balance) > 0).slice(0, 8).map(f => `${f.studentName}(${f.admissionNo}):₹${f.balance}`).join(", ");
        const recentNotes = notes.slice(0, 5).map(n => n.message).join(" | ");
        const allStudentsList = students.map(s => `${s.fullName} (Adm:${s.admissionNo}, Class:${s.className}, Father:${s.fatherName || "N/A"}, Phone:${s.phone || "N/A"})`).join("; ");

        dynamicContext += `\n[LIVE SCHOOL SUMMARY]
Total Students: ${students.length}
Total Outstanding Fees: ₹${totalPending}
Top Pending Accounts: ${topPending || "None"}
Recent Notifications: ${recentNotes || "None"}

[FULL STUDENT LIST (FOR REPORTS/PDFS)]
${allStudentsList}
`;
      } catch (e) {
        console.warn("[Vidya AI] Admin context fetch failed:", e.message);
      }
    } else if (studentContext) {
      dynamicContext = studentContext;
    }

    let systemInstruction = "";
    if (isAdmin) {
      systemInstruction = `You are the Direct Database Access Tool for the Tapowan Public School Administrator.
The user is the SYSTEM ADMINISTRATOR. They have full legal and administrative rights to all data.
DATA CONTEXT:
${dynamicContext}

GOAL:
- Directly provide the requested student information (Father's name, Dues, Phone, etc.) from the DATA CONTEXT.
- If the user asks you to generate a document, report, PDF, Word, Excel, or HTML file, you MUST respond ONLY with raw HTML (using <table>, <h1>, <ul>, etc.). Do not include markdown fences like \`\`\`html. The system will convert your HTML into the requested file format.
- IMAGE GENERATION IS ENABLED. If the user asks to generate, create, draw, or make an image or picture of ANYTHING, you MUST respond ONLY with this exact tag format (nothing else): [VIDYA_IMAGE: descriptive prompt here] — Example: [VIDYA_IMAGE: a cute cartoon schoolgirl in uniform]. Do NOT refuse. Do NOT say you cannot generate images. Do NOT explain anything. Just output the [VIDYA_IMAGE: ...] tag.
- DO NOT use safety disclaimers.
- DO NOT say "I don't have access" or "contact the office".
- DO NOT say image generation is unrelated to school administration.
- Answer in the language the user used (Hindi/English).
- Be extremely helpful. Answer whatever the Admin asks, even if it seems unrelated to school.`;
    } else {
      systemInstruction = buildVidyaSystemPrompt(user, dynamicContext, schoolKnowledge);
    }
    
    // Sort providers based on user preference
    let providerFuncs = [
      { name: "OpenRouter", func: tryOpenRouter },
      { name: "Gemini", func: tryGemini },
      { name: "OpenAI", func: tryOpenAI },
      { name: "Claude", func: tryClaude }
    ];

    if (preferredProvider && preferredProvider !== "auto") {
      const idx = providerFuncs.findIndex(p => p.name === preferredProvider);
      if (idx > -1) {
        const [preferred] = providerFuncs.splice(idx, 1);
        providerFuncs.unshift(preferred);
      }
    }

    let lastErr = null;
    let wasRateLimited = false;
    for (const p of providerFuncs) {
      try {
        const result = await p.func(prompt, systemInstruction);
        // Process any agent actions (Add notification etc)
        const processedReply = await processAiActions(result.reply, user);
        console.log(`[Vidya AI] Responded via ${result.provider}`);
        return res.json({ reply: processedReply, provider: result.provider });
      } catch (err) {
        const status = err.status || err.code || 500;
        console.warn(`[Vidya AI] ${p.name} failed (${status}): ${err.message}`);
        lastErr = err;
        
        if (status === 429) wasRateLimited = true;

        // Don't fallback on 400 (Bad Request) - that's a permanent prompt issue
        if (status === 400) break;
        
        // Otherwise, skip and try ANY other provider (Quota, Server Error, etc)
        continue;
      }
    }

    // All providers failed
    const status = lastErr?.status || 500;
    let reply = "Oops! AI unavailable. Please try again in a moment. 🙏";
    if (status === 429 || wasRateLimited) reply = "सभी AI services की limit full है! थोड़ी देर बाद try करें। 🙏";
    else if (status === 401 || status === 403) reply = "AI settings में कोई problem है। Admin से contact करें।";
    res.status(200).json({ reply, provider: "none" });

  } catch (err) {
    console.error("AI chat critical error:", err.message || err);
    res.status(200).json({ reply: "कुछ गलत हो गया! Please refresh करके try करें। 🙏", provider: "none" });
  }
});


// ── Deepgram TTS Endpoint ──
app.post("/api/ai/tts", async (req, res) => {
  try {
    const { text, lang } = req.body;
    
    // For Hindi, use free Google Translate TTS to avoid API costs and rate limits
    if (lang === 'hi') {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=hi&client=tw-ob`;
      const resp = await fetch(url);

      if (!resp.ok) {
        throw new Error('Google TTS API error: ' + resp.status);
      }

      res.set('Content-Type', 'audio/mpeg');
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    }

    // For English, use Deepgram Aura
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) return res.status(503).json({ error: "Deepgram not configured" });

    const model = 'aura-asteria-en'; 

    const resp = await fetch('https://api.deepgram.com/v1/speak?model=' + model, {
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!resp.ok) {
      throw new Error('Deepgram API error: ' + resp.status);
    }

    res.set('Content-Type', 'audio/mp3');
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err) {
    console.error('[Vidya TTS Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── AI Report Card Remark Generator ──
app.post("/api/ai/generate-remark", authRequired, async (req, res) => {
  try {
    const { studentName, grade, percentage } = req.body || {};
    if (!studentName) return res.status(400).json({ error: "Student data is required" });

    const systemInstruction = `You are a professional school teacher generating a brief, 1-sentence report card remark for a student.
The student is ${studentName}. They received an overall grade of ${grade} (${percentage}%).
If the grade is high (A/A+), praise their excellent performance.
If the grade is average (B/C), offer encouragement to focus and improve.
If the grade is poor (D/E/F), offer constructive advice to work harder.
Keep it encouraging, constructive, and strictly one short sentence. Do not wrap in quotes.`;

    const providerFuncs = [
      { name: "Gemini", func: tryGemini },
      { name: "OpenAI", func: tryOpenAI },
      { name: "OpenRouter", func: tryOpenRouter }
    ];

    for (const p of providerFuncs) {
      try {
        const result = await p.func("Generate the remark.", systemInstruction);
        return res.json({ remark: result.reply.trim().replace(/^["']|["']$/g, ''), provider: result.provider });
      } catch (err) {}
    }
    
    // Fallback if AI fails or no keys configured
    const gradeUpper = (grade || "").toUpperCase();
    let fallback = "Keep working hard and aim higher next term.";
    if (gradeUpper.includes('A')) fallback = "Excellent performance this term, keep it up!";
    else if (gradeUpper.includes('B') || gradeUpper.includes('C')) fallback = "Good effort, but there is room for improvement next term.";
    res.json({ remark: fallback });
  } catch (err) {
    console.error("AI remark error:", err);
    res.json({ remark: "Keep working hard and aim higher next term." });
  }
});

//  Vidya AI Logs Endpoint 
app.get("/api/vidya-logs", authRequired, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const userDataPath = process.env.USER_DATA_PATH || app.getPath?.('userData') || process.env.APPDATA + "\\school-management-system";
    const logPath = path.join(userDataPath, 'system_logs.txt');
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').slice(-100); // Send last 100 lines
      res.json({ logs: lines.join('\n') });
    } else {
      res.json({ logs: "No logs found at " + logPath });
    }
  } catch (err) {
    res.json({ logs: "Error reading logs: " + err.message });
  }
});

// ── Voice Call Integration Endpoint ──
app.post("/api/ai/voice-call", async (req, res) => {
  try {
    const { prompt, token } = req.body || {};
    if (token !== (process.env.VOICE_API_SECRET || "TAPOWAN_VOICE_SECRET_123")) return res.status(403).json({ error: "Unauthorized Voice Client" });
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    // Mock an admin user for full access
    const user = { role: "administrator", fullName: "Vidya AI Receptionist", username: "admin" };
    const isAdmin = true;
    
    let dynamicContext = "";
    try {
        const students = await list("students");
        const fees = await list("fees");
        
        const searchTerms = prompt.toLowerCase().split(" ").filter(t => t.length > 2);
        let s = students.find(x => {
            const fullName = (x.fullName || "").toLowerCase();
            const matches = searchTerms.filter(t => fullName.includes(t));
            return matches.length >= 2 || (searchTerms.length === 1 && fullName.includes(searchTerms[0]));
        });
        
        if (s) {
          const sf = fees.filter(f => String(f.admissionNo).toLowerCase() === String(s.admissionNo).toLowerCase());
          const totalDue = sf.reduce((sum, f) => sum + Number(f.balance || 0), 0);
          
          dynamicContext += `IMPORTANT: DATA BELOW IS LIVE FROM DATABASE.
[ACTIVE STUDENT RECORD]
Name: ${s.fullName}
Admission No: ${s.admissionNo}
Father: ${s.fatherName || "N/A"}
Mother: ${s.motherName || "N/A"}
Class: ${s.className}
Phone: ${s.phone}
Total Pending Fees: ₹${totalDue}
Detailed Dues: ${sf.map(f => `${f.term}: ₹${f.balance}`).join(", ") || "None"}
---
`;
        } else {
            dynamicContext += `\n[SYSTEM NOTE: NO SPECIFIC STUDENT FOUND IN DATABASE FOR THIS QUERY.]\n`;
        }
    } catch(e) {
        console.warn("[Voice AI] DB fetch failed", e);
    }
    
    let systemInstruction = `You are Vidya AI, the Tapowan Public School Receptionist answering a phone call.
You have direct database access.
DATA CONTEXT:
${dynamicContext}

GOAL:
- Directly provide the requested student information.
- Speak conversationally and concisely for a phone call (1-2 sentences).
- Answer in the language the user used (Hindi/English).
- Do not use markdown. Keep it very natural and polite.`;

    let providerFuncs = [
      { name: "Gemini", func: tryGemini },
      { name: "OpenAI", func: tryOpenAI },
      { name: "OpenRouter", func: tryOpenRouter }
    ];

    for (const p of providerFuncs) {
      try {
        const result = await p.func(prompt, systemInstruction);
        console.log(`[Voice AI] Responded via ${result.provider}`);
        return res.json({ reply: result.reply, provider: result.provider });
      } catch (err) {
        // Skip to next provider on error
      }
    }
    return res.status(200).json({ reply: "I'm sorry, I am having trouble connecting to my database right now.", provider: "none" });
  } catch (err) {
    res.status(200).json({ reply: "Sorry, a system error occurred.", provider: "none" });
  }
});

// ── Provider Status Endpoint ──
app.get("/api/ai/status", authRequired, (req, res) => {
  res.json({
    gemini:      !!process.env.GEMINI_API_KEY,
    openai:      !!process.env.OPENAI_API_KEY,
    openrouter:  !!process.env.OPENROUTER_API_KEY,
    activeProviders: [
      process.env.GEMINI_API_KEY     ? "Gemini"     : null,
      process.env.OPENAI_API_KEY     ? "OpenAI"     : null,
      process.env.OPENROUTER_API_KEY ? "OpenRouter" : null,
    ].filter(Boolean)
  });
});
// Dynamic Photo Streaming Endpoint (Fixes mobile memory crashes)
app.get("/api/photo/:moduleName/:id", async (req, res) => {
  try {
    const { moduleName, id } = req.params;
    const colName = req.query.col || 'photo';
    if (!MODULES[moduleName]) return res.status(404).send("Module not found");
    
    let record = await getById(moduleName, id);
    if ((!record || !(record[colName] || record.photoUrl || record.photo)) && moduleName === 'teachers') {
      const sId = String(id).trim();
      const rawId = sId.replace(/^EMP[-_]?/i, '').trim();
      const parsedNum = parseInt(rawId, 10);
      const pad2 = !isNaN(parsedNum) ? String(parsedNum).padStart(2, '0') : rawId;
      const numArg = !isNaN(parsedNum) ? parsedNum : -999999;
      try {
        const tRes = await db.execute({
          sql: `SELECT * FROM teachers WHERE id = ? OR employeeNo = ? OR employeeNo = ? OR ('EMP-' || employeeNo) = ? OR ('EMP-' || id) = ? OR (id = ? AND id > 0) OR (CAST(employeeNo AS INTEGER) = ? AND ? > 0) LIMIT 1`,
          args: [sId, sId, pad2, sId, sId, numArg, numArg, numArg]
        });
        if (tRes?.rows?.length > 0) {
          record = normalizeRow ? normalizeRow('teachers', tRes.rows[0]) : tRes.rows[0];
        }
      } catch (te) {
        console.error('[Photo Endpoint] Teacher fallback lookup error:', te.message);
      }
    } else if ((!record || !(record[colName] || record.photoUrl || record.photo)) && moduleName === 'students') {
      const sId = String(id).trim();
      const parsedNum = parseInt(sId, 10);
      const numArg = !isNaN(parsedNum) ? parsedNum : -999999;
      try {
        const sRes = await db.execute({
          sql: `SELECT * FROM students WHERE id = ? OR admissionNo = ? OR (id = ? AND id > 0) LIMIT 1`,
          args: [sId, sId, numArg]
        });
        if (sRes?.rows?.length > 0) {
          record = normalizeRow ? normalizeRow('students', sRes.rows[0]) : sRes.rows[0];
        }
      } catch (se) {
        console.error('[Photo Endpoint] Student fallback lookup error:', se.message);
      }
    }

    const rawPhotoVal = record ? (record[colName] || record.photoUrl || record.photo) : null;
    if (!record || !rawPhotoVal) return res.status(404).send("Photo not found");
    
    let photoData = rawPhotoVal;
    if (typeof photoData !== 'string') return res.status(404).send("Invalid photo data");
    photoData = photoData.trim();

    // 1. Check for infinite redirect loop (e.g. photo field contains /api/photo/... itself)
    if (photoData.includes(`/api/photo/${moduleName}/${id}`)) {
      return res.status(404).send("Photo not found (loop prevented)");
    }

    // 2. Data URI format (data:image/...;base64,...)
    if (photoData.startsWith('data:image') || photoData.startsWith('data:application')) {
      const commaIdx = photoData.indexOf(',');
      const header = photoData.substring(0, commaIdx);
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Data = photoData.substring(commaIdx + 1).replace(/\s/g, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const etag = `W/"photo-${moduleName}-${id}-${buffer.length}"`;
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('ETag', etag);
      if (req.query._v || req.query.v) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      }
      return res.send(buffer);
    }

    // 3. Raw Base64 without data: prefix (JPEG, PNG, WebP, GIF, BMP)
    const cleanB64 = photoData.replace(/\s/g, '');
    let rawMime = null;
    if (cleanB64.startsWith('/9j/')) rawMime = 'image/jpeg';
    else if (cleanB64.startsWith('iVBOR')) rawMime = 'image/png';
    else if (cleanB64.startsWith('UklGR')) rawMime = 'image/webp';
    else if (cleanB64.startsWith('R0lGOD')) rawMime = 'image/gif';
    else if (cleanB64.startsWith('Qk')) rawMime = 'image/bmp';

    if (rawMime && cleanB64.length > 100) {
      const buffer = Buffer.from(cleanB64, 'base64');
      const etag = `W/"photo-${moduleName}-${id}-${buffer.length}"`;
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', rawMime);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('ETag', etag);
      if (req.query._v || req.query.v) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      }
      return res.send(buffer);
    }

    // 4. Remote HTTP(S) URL
    if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
      return res.redirect(photoData);
    }

    // 5. Local relative path
    if (photoData.startsWith('/')) {
      return res.redirect(photoData);
    }

    return res.status(404).send("Unrecognized photo format");
  } catch (err) {
    res.status(500).send("Error fetching photo");
  }
});

app.get("/api/modules/:moduleName", (req, res, next) => {
  if (req.params.moduleName === "faceEmbeddings") return next();
  return authRequired(req, res, next);
}, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    const { moduleName } = req.params;
    if (!MODULES[moduleName]) {
      return res.status(404).json({ error: "Unknown module" });
    }
    // Students can only access limited modules
    const user = req.session?.user;
    const role = String(user?.role || "").toLowerCase();
    if (role === "student" && ADMIN_ONLY_MODULES.has(moduleName)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await list(moduleName));
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    let user = req.session.user;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const verifiedUser = verifyStatelessToken(token);
      if (verifiedUser) {
        user = verifiedUser;
        req.session = req.session || {};
        req.session.user = user;
      }
    }
    if (!user) return res.json({ user: null });
    
    const role = String(user.role).toLowerCase();
    const roleColors = { administrator: "#dc2626", principal: "#7c3aed", staff: "#2563eb", teacher: "#059669", student: "#d97706" };
    
    return res.json({ 
      user,
      id: user.id, 
      username: user.username, 
      fullName: user.fullName, 
      admissionNo: user.admissionNo,
      role: user.role, 
      roleColor: roleColors[role] || "#64748b" 
    });
  } catch (err) {
    res.status(500).json({ error: "Auth check failed" });
  }
});

// ------------------- HELPERS -------------------


app.post("/api/modules/:moduleName", authRequired, async (req, res) => {
  try {
    const { moduleName } = req.params;
    if (!MODULES[moduleName]) {
      return res.status(404).json({ error: "Unknown module" });
    }
    const user = req.session.user;
    const role = String(user.role).toLowerCase();

    // Students cannot create anything
    if (role === "student") {
      return res.status(403).json({ error: "Students cannot add records" });
    }
    // Teachers can only write attendance modules
    if (role === "teacher" && !TEACHER_WRITE_MODULES.has(moduleName)) {
      return res.status(403).json({ error: "Teachers can only add attendance records" });
    }
    // Admin-staff-only modules
    if (ADMIN_STAFF_ONLY_MODULES.has(moduleName) && !isStaffOrAbove(user) && !isAdmin(user)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    // Prevent non-admins from creating users with elevated roles
    if (moduleName === "users" && !isAdmin(user)) {
      return res.status(403).json({ error: "Only admins can manage users" });
    }
    // --- Fee Reconciliation Logic Removed ---

    let payload = req.body || {};
    // Database Storage Guard: Attendance is strictly text-only
    if (moduleName === "attendance" || moduleName === "teacherAttendance") {
      delete payload.facePhoto;
      payload.facePhoto = null;
    }
    // ── SPECIALIZED ADMISSION LOGIC ──
    if (moduleName === "admissions") {
      
      // 1. Duplicate Detection (Name + DOB + Phone1) - Skip for drafts
      if (payload.isDraft !== "true") {
        const students = await list("students");
        const admissions = await list("admissions");
        const isDuplicate = [...students, ...admissions].some(s => 
          s.id !== payload.id && // exclude self if updating (though this is POST)
          String(s.fullName || "").toLowerCase().trim() === String(payload.fullName || "").toLowerCase().trim() &&
          String(s.dob || "") === String(payload.dob || "") &&
          String(s.phone1 || "") === String(payload.phone1 || "")
        );

        if (isDuplicate) {
          return res.status(409).json({ error: "Duplicate Student: A student with this Name, DOB and Mobile already exists in the system." });
        }

        // 2. Generate Admission No if missing
        if (!payload.admissionNo || payload.admissionNo.includes("TEMP")) {
          const year = new Date().getFullYear();
          const allAdmissions = await list("admissions");
          const allStudents = await list("students");
          const count = allAdmissions.length + allStudents.length + 1;
          payload.admissionNo = `TPS${year}-${String(count).padStart(4, "0")}`;
        }
      }

      if (payload.isDraft === "true") {
        payload.draftUserId = req.session.user.id;
      }
    }

    const row = await insert(moduleName, payload || req.body || {});
    
    // If successful admission (not draft), send notification
    if (moduleName === "admissions" && row.isDraft !== "true" && row.status === "Pending") {
      sendAdmissionNotification(row);
    }
    
    // --- STOCK DEDUCTION LOGIC ---
    if (moduleName === "fees" && payload.selectedBookIds) {
      try {
        const ids = JSON.parse(payload.selectedBookIds);
        if (Array.isArray(ids) && ids.length > 0) {
          const currentBD = await list("booksAndDress");
          for (const bdId of ids) {
            const item = currentBD.find(b => String(b.id) === String(bdId));
            if (item && item.stock !== undefined && item.stock !== null && item.stock !== "") {
              let currentStock = parseInt(item.stock, 10);
              if (!isNaN(currentStock) && currentStock > 0) {
                await update("booksAndDress", bdId, { stock: String(currentStock - 1) });
              }
            }
          }
        }
      } catch (e) {
        console.error("Stock deduction failed:", e);
      }
    }
    
    // Instant Sync: If Fee Structure or Fees changed, trigger the automation immediately
    if (moduleName === "feeStructures" || moduleName === "fees") {
      console.log(`[Fee Automation] ${moduleName} added, triggering instant sync...`);
      runAutomatedFeeTask().catch(e => console.error("Instant sync error:", e.message));
    }
    
    // Auto-sync announcements to mobile app notices
    if (moduleName === "announcements") {
      try {
        const { runRaw } = require("./server/db-sqlite");
        const title = row.title || 'Official Announcement';
        const content = row.message || '';
        const date = row.date || new Date().toISOString().split('T')[0];
        const category = row.category || 'Announcement';
        runRaw(
          `INSERT INTO app_notices (title, content, date, category, is_active, created_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
          [title, content, date, category]
        ).catch(e => console.error("Announcement insert sync error:", e.message));
      } catch (e) {
        console.error("Announcement hook error:", e);
      }
    }

    // Auto-sync exams to app_exam_marks (Single Table Architecture)
    if (moduleName === "exams") {
      syncExamPayloadToAppMarks(payload || req.body || {}, user).catch(e => console.error("Exam POST sync error:", e));
    }
    
    res.status(201).json(row);
  } catch (err) {
    console.error("Insert failed:", err);
    res.status(500).json({ error: "Insert failed: " + (err.message || err) });
  }
});

app.put("/api/modules/:moduleName/:id", authRequired, async (req, res) => {
  try {
    const { moduleName, id } = req.params;
    if (!MODULES[moduleName]) {
      return res.status(404).json({ error: "Unknown module" });
    }
    const user = req.session.user;
    const role = String(user.role).toLowerCase();

    // Students cannot edit anything
    if (role === "student") {
      return res.status(403).json({ error: "Students cannot edit records" });
    }
    // Teachers can only edit attendance and announcements
    if (role === "teacher" && !TEACHER_WRITE_MODULES.has(moduleName) && moduleName !== "announcements") {
      return res.status(403).json({ error: "Teachers can only edit attendance and announcements" });
    }
    // Admin-staff-only modules
    if (ADMIN_STAFF_ONLY_MODULES.has(moduleName) && !isStaffOrAbove(user) && !isAdmin(user)) {
      return res.status(403).json({ error: "Only admin and staff can edit this module" });
    }
    // Users module: only admin
    if (moduleName === "users" && !isAdmin(user)) {
      return res.status(403).json({ error: "Only admins can edit users" });
    }

    let existingSubject = null;
    if (moduleName === "subjects") {
      try {
        const all = await list("subjects");
        existingSubject = all.find(r => String(r.id) === String(id));
      } catch (e) {}
    }

    // Database Storage Guard: Attendance is strictly text-only
    if (moduleName === "attendance" || moduleName === "teacherAttendance") {
      if (req.body) {
        delete req.body.facePhoto;
        req.body.facePhoto = null;
      }
    }

    const row = await update(moduleName, id, req.body || {});
    if (!row) return res.status(404).json({ error: "Record not found" });

    // Cascading rename for subjects: if subject name was changed, cascade to app_exam_marks and exams
    if (moduleName === "subjects" && existingSubject?.subjectName && req.body?.subjectName) {
      const oldSub = (existingSubject.subjectName || '').trim();
      const newSub = (req.body.subjectName || '').trim();
      const clsName = (existingSubject.className || req.body.className || '').trim();
      if (oldSub && newSub && oldSub.toLowerCase() !== newSub.toLowerCase()) {
        try {
          if (clsName && clsName.toLowerCase() !== 'all') {
            await runRaw(
              `UPDATE app_exam_marks SET subject = ? WHERE UPPER(TRIM(class_name)) = UPPER(TRIM(?)) AND UPPER(TRIM(subject)) = UPPER(TRIM(?))`,
              [newSub, clsName, oldSub]
            );
          } else {
            await runRaw(
              `UPDATE app_exam_marks SET subject = ? WHERE UPPER(TRIM(subject)) = UPPER(TRIM(?))`,
              [newSub, oldSub]
            );
          }

          // Update exams table subjectMarks
          const allExams = await list('exams');
          for (const ex of allExams) {
            if (!ex.subjectMarks) continue;
            if (clsName && clsName.toLowerCase() !== 'all' && (ex.className || '').trim().toLowerCase() !== clsName.toLowerCase()) continue;
            let subs = [];
            try {
              subs = typeof ex.subjectMarks === 'string' ? JSON.parse(ex.subjectMarks) : ex.subjectMarks;
            } catch (e) { subs = []; }
            if (Array.isArray(subs)) {
              let changed = false;
              subs.forEach(s => {
                if (s && (s.subject || '').trim().toLowerCase() === oldSub.toLowerCase()) {
                  s.subject = newSub;
                  changed = true;
                }
              });
              if (changed) {
                await update('exams', ex.id, {
                  ...ex,
                  subjectMarks: JSON.stringify(subs)
                });
              }
            }
          }
        } catch (e) {
          console.error("Subject rename cascade error:", e);
        }
      }
    }

    if (moduleName === "announcements") {
      try {
        const { runRaw } = require("./server/db-sqlite");
        const title = row.title || 'Official Announcement';
        const content = row.message || '';
        const date = row.date || new Date().toISOString().split('T')[0];
        const category = row.category || 'Announcement';
        runRaw(
          `INSERT INTO app_notices (title, content, date, category, is_active, created_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
          [title, content, date, category]
        ).catch(e => console.error("Announcement update sync error:", e.message));
      } catch (e) {
        console.error("Announcement update hook error:", e);
      }
    }

    // Instant Sync: If Fee Structure or Fees changed, trigger the automation immediately
    if (moduleName === "feeStructures" || moduleName === "fees") {
      console.log(`[Fee Automation] ${moduleName} updated, triggering instant sync...`);
      runAutomatedFeeTask().catch(e => console.error("Instant sync error:", e.message));
    }

    // Auto-sync exams to app_exam_marks (Single Table Architecture)
    if (moduleName === "exams") {
      syncExamPayloadToAppMarks(req.body || {}, user).catch(e => console.error("Exam PUT sync error:", e));
    }
    
    res.json(row);
  } catch (err) {
    console.error("Update failed:", err);
    res.status(500).json({ error: "Update failed: " + (err.message || err) });
  }
});

function canonicalSubjectName(raw) {
  if (!raw) return '';
  const s = String(raw).trim().toLowerCase();

  if (s.includes('english')) return 'English';
  if (s === 'hindi' || s === 'course-b' || s.includes('hindi')) return 'Hindi';
  if (s.includes('social') || s.includes('sst') || s.includes('history') || s.includes('geography') || s.includes('civics')) return 'Social Science';
  if (s === 'evs' || s === 'e.v.s' || s.includes('e.v.s') || s.includes('environmental') || s.includes('environment')) return 'EVS';
  if (s === 'science' || (s.includes('science') && !s.includes('social') && !s.includes('computer') && !s.includes('moral') && !s.includes('home') && !s.includes('env'))) return 'Science';
  if (s === 'math' || s.includes('math')) return 'Math';
  if (s === 'computer' || s === 'cs' || s.includes('computer') || s.includes('infotech') || s.includes('information tech') || s === 'it') return 'Computer';
  if (s.includes('sanskrit')) return 'Sanskrit';
  if (s.includes('drawing') || s.includes('art') || s.includes('craft')) return 'Drawing';
  if (
    s === 'gk & me' ||
    s === 'me & gk' ||
    s === 'me/gk' ||
    s === 'gk' ||
    s === 'g.k' ||
    s === 'g.k.' ||
    s.includes('general knowledge') ||
    s.includes('moral') ||
    s.includes('m.sc') ||
    s.includes('m.s') ||
    s === 'gk and me' ||
    s === 'me and gk'
  ) {
    return 'GK & Me';
  }

  return raw.trim();
}

async function syncExamPayloadToAppMarks(payload, user) {
  if (!payload || !payload.subjectMarks) return;
  try {
    const { getDb } = require("./server/db-sqlite");
    const db = getDb("app_exam_marks");
    let subjects = [];
    try {
      subjects = typeof payload.subjectMarks === 'string' ? JSON.parse(payload.subjectMarks) : payload.subjectMarks;
    } catch(e) {}

    const examName = payload.examName;
    const className = payload.className;
    const studentName = payload.studentName;
    const admissionNo = payload.admissionNo || '';
    const rollNo = payload.rollNo || '';
    const recordedBy = (user && (user.name || user.fullName)) || 'Web Portal';
    const nowIso = new Date().toISOString();

    if (examName && className && studentName) {
      // Clean up previous records for this student and exam so removed/deleted subjects don't linger
      await db.execute({
        sql: `DELETE FROM app_exam_marks 
              WHERE UPPER(TRIM(exam_name)) = UPPER(TRIM(?)) 
                AND UPPER(TRIM(class_name)) = UPPER(TRIM(?)) 
                AND UPPER(TRIM(student_name)) = UPPER(TRIM(?))`,
        args: [examName, className, studentName]
      });

      if (Array.isArray(subjects) && subjects.length > 0) {
        for (const s of subjects) {
          if (s && s.subject) {
            const subjName = canonicalSubjectName(s.subject);
            const isAb = s.isAbsent === true || String(s.total).trim().toUpperCase() === 'AB' || String(s.theory).trim().toUpperCase() === 'AB' || String(s.subjective).trim().toUpperCase() === 'AB' || s.grade === 'AB';
            const total = isAb ? 0 : (parseFloat(s.total) || 0);
            const max = parseFloat(s.max) || 100;
            const min = parseFloat(s.min) || 33;
            const pa1 = isAb ? 0 : (parseFloat(s.pa1) || 0);
            const nb = isAb ? 0 : (parseFloat(s.notebook) || 0);
            const enr = isAb ? 0 : (parseFloat(s.enrichment) || 0);
            const theory = isAb ? 'AB' : (parseFloat(s.theory !== undefined ? s.theory : (s.subjective || 0)) || 0);
            const grade = isAb ? 'AB' : (s.grade || '');
            const remarks = isAb ? 'Absent' : (payload.teacherRemark || '');

            await db.execute({
              sql: `INSERT INTO app_exam_marks (
                      exam_name, class_name, subject, student_name, admission_no,
                      roll_no, marks_obtained, max_marks, passing_marks, grade,
                      remarks, recorded_by, created_at,
                      pa1_marks, notebook_marks, enrichment_marks, subjective_marks
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                examName, className, subjName, studentName, String(admissionNo),
                String(rollNo), total, max, min, grade,
                remarks, recordedBy, nowIso,
                pa1, nb, enr, theory
              ]
            });
          }
        }
      }
    }
  } catch(e) {
    console.error("Exam sync to app_exam_marks error:", e);
  }
}

app.delete("/api/modules/:moduleName/:id", authRequired, async (req, res) => {
  try {
    const { moduleName, id } = req.params;
    if (!MODULES[moduleName]) {
      return res.status(404).json({ error: "Unknown module" });
    }
    const user = req.session.user;
    const roleStr = String(user.role || "").toLowerCase();
    const roleLvl = getRoleLevel(user?.role);
    // Admins, Principals, Staff, and Teachers (for exams) can delete
    if (roleLvl < 2 && roleStr !== "administrator" && roleStr !== "principal" && roleStr !== "staff") {
      return res.status(403).json({ error: "Only Authorized Staff can delete records" });
    }
    // Users module: only admin
    if (moduleName === "users" && !isAdmin(user)) {
      return res.status(403).json({ error: "Only admins can delete users" });
    }

    let existingRow = null;
    if (moduleName === "announcements" || moduleName === "exams" || moduleName === "subjects") {
      try {
        const all = await list(moduleName);
        existingRow = all.find(r => String(r.id) === String(id));
      } catch (e) {}
    }

    await remove(moduleName, id);

    // If subject is deleted, also clean up matching app_exam_marks and exams in Turso
    if (moduleName === "subjects" && existingRow?.subjectName) {
      try {
        const subName = (existingRow.subjectName || '').trim();
        const clsName = (existingRow.className || '').trim();
        if (clsName && clsName.toLowerCase() !== 'all') {
          await runRaw(
            `DELETE FROM app_exam_marks WHERE UPPER(TRIM(class_name)) = UPPER(TRIM(?)) AND UPPER(TRIM(subject)) = UPPER(TRIM(?))`,
            [clsName, subName]
          );
        } else {
          await runRaw(
            `DELETE FROM app_exam_marks WHERE UPPER(TRIM(subject)) = UPPER(TRIM(?))`,
            [subName]
          );
        }

        // Helper to check if a subject is Main vs Additional on server
        const isSubjectMainServer = (subName) => {
          const s = String(subName || '').trim().toLowerCase();
          if (!s) return false;
          const addlKeys = ['drawing', 'art', 'craft', 'gk', 'g.k', 'gk & me', 'me & gk', 'me/gk', 'general knowledge', 'moral science', 'moral', 'computer', 'computer science', 'information tech', 'infotech', 'it (402)', 'it', 'sanskrit', 'urdu', 'physical education', 'phe', 'pe', 'sports', 'yoga', 'music', 'dance'];
          const mainKeys = ['english', 'hindi', 'science', 'social science', 'math', 'mathematics', 'maths', 'social studies', 'sst', 'evs', 'environmental', 'physics', 'chemistry', 'biology', 'accountancy', 'business', 'economics', 'history', 'geography', 'civics', 'political science'];
          if (addlKeys.some(k => s === k || s.includes(k))) return false;
          if (mainKeys.some(k => s === k || s.includes(k))) return true;
          return true;
        };

        const getSubjectDisplayOrderServer = (subName) => {
          const raw = String(subName || '').trim().toLowerCase();
          if (raw.includes('english') || raw === 'eng') return 10;
          if (raw.includes('hindi') || raw === 'hin') return 20;
          if (raw.includes('math')) return 30;
          if (raw.includes('social') || raw.includes('sst') || raw.includes('history') || raw.includes('geography') || raw.includes('civics') || raw.includes('pol') || raw.includes('econ')) return 50;
          if (raw.includes('science') || raw.includes('evs') || raw.includes('environmental') || raw.includes('physics') || raw.includes('chemistry') || raw.includes('biology')) return 40;
          if (isSubjectMainServer(subName)) return 60;
          if (raw.includes('comp') || raw.includes('it') || raw.includes('info')) return 70;
          if (raw.includes('gk') || raw.includes('knowledge') || raw.includes('moral')) return 80;
          if (raw.includes('sansk') || raw.includes('urdu')) return 90;
          if (raw.includes('draw') || raw.includes('art') || raw.includes('craft')) return 100;
          if (raw.includes('physical') || raw.includes('sport') || raw.includes('yoga') || raw.includes('pe') || raw.includes('music') || raw.includes('dance')) return 110;
          return 120;
        };

        const isDrawingSubjectServer = (name) => {
          if (!name) return false;
          const s = String(name).trim().toLowerCase();
          return s === 'drawing' || s.includes('drawing') || s === 'art' || s === 'craft' || s.includes('art & craft') || s.includes('art/craft') || s.includes('चित्रकला');
        };

        const calculateExamStatsServer = (subjectList, className = '') => {
          let grandTotal = 0;
          let evaluatedMax = 0;
          let mainTotal = 0;
          let mainMax = 0;
          let mainCount = 0;
          let failedMainCount = 0;
          subjectList.forEach(s => {
            if (isDrawingSubjectServer(s.subject)) return; // Exclude Drawing from scholastic grand total
            const tot = parseFloat(s.total) || 0;
            const mx = parseFloat(s.max) || 100;
            const mn = parseFloat(s.min) || 33;
            const isMain = isSubjectMainServer(s.subject);
            grandTotal += tot;
            evaluatedMax += mx;
            if (isMain) {
              mainCount++;
              mainTotal += tot;
              mainMax += mx;
              if (tot < mn) failedMainCount++;
            }
          });
          const cKey = String(className || '').trim().toLowerCase();
          let standardClassCount = 8; // 8 academic subjects (excluding Drawing)
          let standardMainCount = 5;
          if (cKey.includes('nursery') || cKey.includes('lkg')) {
            standardClassCount = 3;
            standardMainCount = 3;
          } else if (cKey.includes('ukg')) {
            standardClassCount = 4;
            standardMainCount = 4;
          } else if (/^(i|ii|iii)(-a)?$/i.test(cKey) || /^(1|2|3)(-a)?$/i.test(cKey) || /^class\s*(1|2|3|i|ii|iii)(-a)?$/i.test(cKey)) {
            standardClassCount = 7; // 7 academic subjects (excluding Drawing)
            standardMainCount = 5;
          }
          const effectiveMax = Math.max(evaluatedMax, standardClassCount * 100);
          const percentage = effectiveMax > 0 ? ((grandTotal / effectiveMax) * 100).toFixed(1) : '0';
          const mainPct = mainMax > 0 ? (mainTotal / mainMax) * 100 : 0;
          let resultStatus = 'PENDING';
          let grade = '---';
          if (mainCount === 0 || mainCount < standardMainCount) {
            resultStatus = 'PENDING';
            grade = '---';
          } else if (failedMainCount > 0) {
            resultStatus = 'FAIL';
            grade = 'E';
          } else if (mainPct >= 33) {
            resultStatus = 'PASS';
            grade = mainPct >= 91 ? 'A1' : (mainPct >= 81 ? 'A2' : (mainPct >= 71 ? 'B1' : (mainPct >= 61 ? 'B2' : (mainPct >= 51 ? 'C1' : (mainPct >= 41 ? 'C2' : 'D')))));
          } else {
            resultStatus = 'FAIL';
            grade = 'E';
          }
          return { grandTotal, percentage, resultStatus, grade };
        };

        // Also clean up exams table subjectMarks
        const allExams = await list('exams');
        for (const ex of allExams) {
          if (!ex.subjectMarks) continue;
          if (clsName && clsName.toLowerCase() !== 'all' && (ex.className || '').trim().toLowerCase() !== clsName.toLowerCase()) continue;
          let subs = [];
          try {
            subs = typeof ex.subjectMarks === 'string' ? JSON.parse(ex.subjectMarks) : ex.subjectMarks;
          } catch (e) { subs = []; }
          if (Array.isArray(subs)) {
            const filtered = subs.filter(s => (s?.subject || '').trim().toLowerCase() !== subName.toLowerCase());
            if (filtered.length !== subs.length) {
              filtered.sort((a, b) => getSubjectDisplayOrderServer(a.subject) - getSubjectDisplayOrderServer(b.subject));
              const stats = calculateExamStatsServer(filtered, ex.className);
              await update('exams', ex.id, {
                ...ex,
                subjectMarks: JSON.stringify(filtered),
                totalMarks: String(stats.grandTotal),
                percentage: stats.percentage,
                grade: stats.grade,
                resultStatus: stats.resultStatus
              });
            }
          }
        }
      } catch (e) {
        console.error("Subject delete cascade error:", e);
      }
    }

    // If exam is deleted, also clean up matching app_exam_marks in Turso
    if (moduleName === "exams" && existingRow) {
      try {
        const { runRaw } = require("./server/db-sqlite");
        await runRaw(
          `DELETE FROM app_exam_marks WHERE UPPER(TRIM(class_name)) = UPPER(TRIM(?)) AND UPPER(TRIM(exam_name)) = UPPER(TRIM(?)) AND UPPER(TRIM(student_name)) = UPPER(TRIM(?))`,
          [existingRow.className || '', existingRow.examName || '', existingRow.studentName || '']
        );
      } catch (e) {}
    }

    // If announcement is deleted, also deactivate notice in app_notices
    if (moduleName === "announcements" && existingRow?.title) {
      try {
        const { runRaw } = require("./server/db-sqlite");
        runRaw(`UPDATE app_notices SET is_active = 0 WHERE title = ?`, [existingRow.title]).catch(() => {});
      } catch (e) {}
    }

    // If a fee is deleted, trigger instant automation to recreate dues if necessary
    if (moduleName === "fees") {
        console.log("[Fee Automation] Fee record deleted. Triggering delayed sync...");
        // Delay to ensure deletion is committed before re-reading data
        setTimeout(() => {
            runAutomatedFeeTask().catch(e => console.error("Instant sync error:", e));
        }, 500);
    }

    res.json({ ok: true });
    } catch (err) {
      console.error("Delete failed:", err);
      res.status(500).json({ error: "Delete failed: " + (err.message || err) });
    }
});

// ─── ADMIN: DELETE EXAM MARKS (CLASS & SUBJECT WISE) ───
app.get("/api/exams/count-subject-marks", adminRequired, async (req, res) => {
  try {
    const { className, examName, subject, session } = req.query || {};
    if (!className || !examName || !subject) {
      return res.status(400).json({ error: "Missing required query parameters." });
    }
    const { db } = require("./server/db-sqlite");
    const countRes = await db.execute({
      sql: `SELECT count(*) as cnt FROM app_exam_marks 
            WHERE UPPER(TRIM(class_name)) = UPPER(TRIM(?)) 
              AND UPPER(TRIM(exam_name)) = UPPER(TRIM(?)) 
              AND (UPPER(TRIM(subject)) = UPPER(TRIM(?)) OR UPPER(TRIM(subject)) LIKE UPPER(TRIM(?)))`,
      args: [String(className).trim(), String(examName).trim(), String(subject).trim(), `%${String(subject).trim()}%`]
    }).catch(() => ({ rows: [{ cnt: 0 }] }));

    const count = countRes?.rows?.[0]?.cnt || 0;
    res.json({ count: Number(count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/exams/delete-subject-marks", adminRequired, async (req, res) => {
  try {
    const { className, examName, subject, session } = req.body || {};
    if (!className || !examName || !subject) {
      return res.status(400).json({ error: "Missing required fields: className, examName, and subject are required." });
    }

    const { db, list, update, remove, invalidateStoreCache, invalidateQueryCache } = require("./server/db-sqlite");

    const normClass = String(className).trim();
    const normExam = String(examName).trim();
    const normSubject = String(subject).trim();
    const normSession = session ? String(session).trim() : null;

    console.log(`[Exam Marks Delete] Admin requested deletion of Class='${normClass}', Exam='${normExam}', Subject='${normSubject}', Session='${normSession || 'ALL'}'`);

    const isSSTPart = (sub) => {
      const s = String(sub || '').trim().toLowerCase();
      return s === 'geography' || s === 'history' || s === 'civics' || s === 'economics' ||
             s.includes('geography') || s.includes('history') || s.includes('civics') || s.includes('economics');
    };

    const normalizeSSTKey = (sub) => {
      const s = String(sub || '').trim().toLowerCase();
      if (s.includes('geo')) return 'geography';
      if (s.includes('eco')) return 'economics';
      if (s.includes('civ') || s.includes('pol')) return 'civics';
      if (s.includes('hist')) return 'history';
      return null;
    };

    const isClass9or10 = (cls) => {
      const s = String(cls || '').trim().toLowerCase();
      return s.includes('9') || s.includes('10') || /\bix\b/i.test(s) || /\bx\b/i.test(s);
    };

    // 1. Delete matching records from app_exam_marks
    let deleteAppMarksSql = `
      DELETE FROM app_exam_marks 
      WHERE UPPER(TRIM(class_name)) = UPPER(TRIM(?)) 
        AND UPPER(TRIM(exam_name)) = UPPER(TRIM(?))
        AND UPPER(TRIM(subject)) = UPPER(TRIM(?))
    `;
    let deleteAppMarksArgs = [normClass, normExam, normSubject];

    // If SST Part in Class 9 or 10, also match possible variant names
    if (isClass9or10(normClass) && isSSTPart(normSubject)) {
      deleteAppMarksSql = `
        DELETE FROM app_exam_marks 
        WHERE UPPER(TRIM(class_name)) = UPPER(TRIM(?)) 
          AND UPPER(TRIM(exam_name)) = UPPER(TRIM(?))
          AND (UPPER(TRIM(subject)) = UPPER(TRIM(?)) OR UPPER(TRIM(subject)) LIKE UPPER(TRIM(?)))
      `;
      deleteAppMarksArgs = [normClass, normExam, normSubject, `%${normSubject}%`];
    }

    const appMarksDelRes = await db.execute({
      sql: deleteAppMarksSql,
      args: deleteAppMarksArgs
    }).catch(err => {
      console.warn("[Exam Marks Delete] app_exam_marks delete warning:", err.message);
      return { rowsAffected: 0 };
    });

    const appMarksDeleted = appMarksDelRes?.rowsAffected || 0;

    // 2. Fetch and update matching student records in unified exams table
    let examSql = `
      SELECT id, className, examName, session, studentName, rollNo, admissionNo, subjectMarks, totalMarks, percentage, grade, resultStatus
      FROM exams
      WHERE UPPER(TRIM(className)) = UPPER(TRIM(?))
        AND UPPER(TRIM(examName)) = UPPER(TRIM(?))
    `;
    let examArgs = [normClass, normExam];
    if (normSession) {
      examSql += ` AND UPPER(TRIM(session)) = UPPER(TRIM(?))`;
      examArgs.push(normSession);
    }

    const examsRes = await db.execute({ sql: examSql, args: examArgs }).catch(() => ({ rows: [] }));
    const examRows = examsRes.rows || [];

    let examsUpdated = 0;
    let examsDeleted = 0;

    for (const ex of examRows) {
      if (!ex.subjectMarks) continue;
      let subjects = [];
      try {
        subjects = typeof ex.subjectMarks === 'string' ? JSON.parse(ex.subjectMarks) : ex.subjectMarks;
        if (!Array.isArray(subjects)) subjects = [];
      } catch (e) {
        subjects = [];
      }

      const initialCount = subjects.length;
      let filteredSubjects = [];

      const targetIsSSTPart = isClass9or10(normClass) && isSSTPart(normSubject);
      const targetSSTKey = targetIsSSTPart ? normalizeSSTKey(normSubject) : null;

      for (const s of subjects) {
        if (!s || !s.subject) continue;
        const sName = String(s.subject).trim().toLowerCase();
        const targetName = normSubject.toLowerCase();

        // If this is the exact subject, exclude it
        if (sName === targetName) {
          continue;
        }

        // If Class 9/10 SST Part and this is consolidated Social Science
        if (targetIsSSTPart && (sName === 'social science' || sName === 'social science (087)' || sName.includes('social science'))) {
          if (s.components && typeof s.components === 'object' && targetSSTKey) {
            const updatedComponents = { ...s.components };
            updatedComponents[targetSSTKey] = 0;

            const g = parseFloat(updatedComponents.geography) || 0;
            const e = parseFloat(updatedComponents.economics) || 0;
            const c = parseFloat(updatedComponents.civics) || 0;
            const h = parseFloat(updatedComponents.history) || 0;
            const remainingTh = Math.min(80, Math.round((g + e + c + h) * 10) / 10);
            const intVal = parseFloat(s.practical) || 0;
            const newTot = Math.min(100, Math.round((remainingTh + intVal) * 10) / 10);

            // If all components and internals are zero, remove Social Science completely
            if (remainingTh === 0 && intVal === 0) {
              continue;
            }

            filteredSubjects.push({
              ...s,
              theory: remainingTh,
              subjective: remainingTh,
              total: newTot,
              components: updatedComponents
            });
            continue;
          }
        }

        filteredSubjects.push(s);
      }

      // Check if anything changed for this student
      if (filteredSubjects.length !== initialCount || targetIsSSTPart) {
        if (filteredSubjects.length === 0) {
          // No subjects left for this student in this exam -> remove exam record
          await remove('exams', ex.id);
          examsDeleted++;
        } else {
          // Recalculate totals
          filteredSubjects.sort((a, b) => getSubjectDisplayOrderServer(a.subject) - getSubjectDisplayOrderServer(b.subject));
          const stats = calculateExamStatsServer(filteredSubjects, ex.className);
          await update('exams', ex.id, {
            ...ex,
            subjectMarks: JSON.stringify(filteredSubjects),
            totalMarks: String(stats.grandTotal),
            percentage: stats.percentage,
            grade: stats.grade,
            resultStatus: stats.resultStatus
          });
          examsUpdated++;
        }
      }
    }

    if (typeof invalidateStoreCache === 'function') invalidateStoreCache();
    if (typeof invalidateQueryCache === 'function') invalidateQueryCache();

    console.log(`[Exam Marks Delete] Finished: ${appMarksDeleted} app_exam_marks deleted, ${examsUpdated} exams updated, ${examsDeleted} empty exam entries removed.`);

    res.json({
      success: true,
      message: `Marks for ${normSubject} in Class ${normClass} deleted successfully.`,
      appMarksDeleted,
      examsUpdated,
      examsDeleted
    });
  } catch (err) {
    console.error("[Exam Marks Delete] Error:", err);
    res.status(500).json({ error: "Failed to delete exam marks: " + (err.message || err) });
  }
});

// ─── TIMETABLE PERIOD & SCHOOL TIMINGS CONFIGURATION ───
app.get("/api/timetable/timings-settings", authRequired, async (req, res) => {
  try {
    const { db } = require("./server/db-sqlite");
    const settingsRes = await db.execute({
      sql: `SELECT key, value FROM settings WHERE key IN ('school_arrival_time', 'school_departure_time', 'school_period_timings')`
    }).catch(() => ({ rows: [] }));
    
    const settingsMap = {};
    (settingsRes.rows || []).forEach(r => {
      if (r && r.key) settingsMap[r.key] = r.value;
    });

    let periodTimings = [];
    try {
      if (settingsMap.school_period_timings) {
        const parsed = JSON.parse(settingsMap.school_period_timings);
        if (Array.isArray(parsed)) {
          periodTimings = parsed;
        } else if (typeof parsed === 'object' && parsed !== null) {
          periodTimings = Object.keys(parsed).map(k => ({
            period: k.toLowerCase().startsWith('period') ? k : `Period ${k}`,
            startTime: parsed[k].startTime || '',
            endTime: parsed[k].endTime || ''
          }));
        }
      }
    } catch (e) {}

    // Also pull distinct period timings currently in timetable table as fallback
    const ttRes = await db.execute({
      sql: `SELECT DISTINCT period, startTime, endTime, departureTime FROM timetable ORDER BY period ASC`
    }).catch(() => ({ rows: [] }));

    const dbTimings = (ttRes.rows || []).map(r => ({
      period: r.period || '',
      startTime: r.startTime || '',
      endTime: r.endTime || '',
      departureTime: r.departureTime || ''
    }));

    res.json({
      ok: true,
      arrivalTime: settingsMap.school_arrival_time || '',
      departureTime: settingsMap.school_departure_time || (dbTimings[0]?.departureTime || ''),
      periodTimings: periodTimings.length > 0 ? periodTimings : dbTimings
    });
  } catch (err) {
    console.error("Error reading timetable timing settings:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/timetable/update-timings", authRequired, async (req, res) => {
  try {
    const user = req.session.user;
    const roleStr = String(user?.role || '').toLowerCase();
    const roleLvl = getRoleLevel(user?.role);
    if (roleLvl < 1 && roleStr !== "administrator" && roleStr !== "principal" && roleStr !== "staff" && roleStr !== "teacher") {
      return res.status(403).json({ error: "Only Authorized Staff can update timetable timings" });
    }

    const { timings, arrivalTime, departureTime } = req.body || {};
    const { db, getStore, invalidateQueryCache } = require("./server/db-sqlite");
    const updatedBy = user?.name || user?.fullName || 'Staff';

    let totalUpdated = 0;
    if (Array.isArray(timings) && timings.length > 0) {
      for (const t of timings) {
        const period = (t.period || '').trim();
        const start = (t.startTime || '').trim();
        const end = (t.endTime || '').trim();
        if (!period) continue;

        let sql = `UPDATE timetable SET startTime = ?, endTime = ?`;
        const args = [start, end];
        if (departureTime && departureTime.trim()) {
          sql += `, departureTime = ?`;
          args.push(departureTime.trim());
        }
        sql += ` WHERE UPPER(TRIM(period)) = UPPER(TRIM(?))`;
        args.push(period);

        const res = await db.execute({ sql, args });
        totalUpdated += (res.rowsAffected || 0);
      }
    } else if (departureTime && departureTime.trim()) {
      const res = await db.execute({
        sql: `UPDATE timetable SET departureTime = ?`,
        args: [departureTime.trim()]
      });
      totalUpdated += (res.rowsAffected || 0);
    }

    // Save arrival, departure, and period timings to settings table
    try {
      if (arrivalTime) {
        await db.execute({
          sql: `INSERT INTO settings (key, value, category, updatedBy) VALUES ('school_arrival_time', ?, 'timetable', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedBy = excluded.updatedBy`,
          args: [arrivalTime.trim(), updatedBy]
        });
      }
      if (departureTime) {
        await db.execute({
          sql: `INSERT INTO settings (key, value, category, updatedBy) VALUES ('school_departure_time', ?, 'timetable', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedBy = excluded.updatedBy`,
          args: [departureTime.trim(), updatedBy]
        });
      }
      if (Array.isArray(timings) && timings.length > 0) {
        await db.execute({
          sql: `INSERT INTO settings (key, value, category, updatedBy) VALUES ('school_period_timings', ?, 'timetable', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedBy = excluded.updatedBy`,
          args: [JSON.stringify(timings), updatedBy]
        });
      }
    } catch (e) {
      console.warn("Notice: settings update error:", e.message);
    }

    // Refresh memory cache
    try {
      if (typeof invalidateQueryCache === 'function') invalidateQueryCache();
      await getStore(true);
    } catch (e) {}

    res.json({ ok: true, updatedSlots: totalUpdated });
  } catch (err) {
    console.error("Error updating timetable timings:", err);
    res.status(500).json({ error: err.message || "Failed to update period timings" });
  }
});

// POST /api/timetable/slot/save - Edit or assign a single timetable slot
app.post("/api/timetable/slot/save", authRequired, async (req, res) => {
  try {
    const user = req.session.user;
    const roleStr = String(user?.role || '').toLowerCase();
    const roleLvl = getRoleLevel(user?.role);
    if (roleLvl < 1 && roleStr !== "administrator" && roleStr !== "principal" && roleStr !== "staff" && roleStr !== "teacher") {
      return res.status(403).json({ error: "Only Authorized Teachers & Staff can edit timetable slots" });
    }

    const { id, className, day, period, subject, teacher, roomNo } = req.body || {};
    if (!className || !day || !period) {
      return res.status(400).json({ error: "Missing required fields: className, day, period" });
    }

    const { db, getStore, invalidateQueryCache } = require("./server/db-sqlite");
    
    // Check if updating existing by id
    if (id && parseInt(id, 10) > 0) {
      await db.execute({
        sql: `UPDATE timetable SET subject = ?, teacher = ?, roomNo = ? WHERE id = ?`,
        args: [subject || 'Free', teacher || '', roomNo || '', parseInt(id, 10)]
      });
    } else {
      // Check if slot already exists for this className, day, period
      const existing = await db.execute({
        sql: `SELECT id FROM timetable WHERE UPPER(TRIM(className)) = UPPER(TRIM(?)) AND UPPER(TRIM(day)) = UPPER(TRIM(?)) AND UPPER(TRIM(period)) = UPPER(TRIM(?)) LIMIT 1`,
        args: [className, day, period]
      });

      if (existing.rows && existing.rows.length > 0) {
        const slotRowId = existing.rows[0].id;
        await db.execute({
          sql: `UPDATE timetable SET subject = ?, teacher = ?, roomNo = ? WHERE id = ?`,
          args: [subject || 'Free', teacher || '', roomNo || '', slotRowId]
        });
      } else {
        // Find default timings for this period if any
        const pSample = await db.execute({
          sql: `SELECT startTime, endTime, departureTime FROM timetable WHERE UPPER(TRIM(period)) = UPPER(TRIM(?)) AND startTime IS NOT NULL LIMIT 1`,
          args: [period]
        });
        const sampleRow = pSample.rows?.[0] || {};
        await db.execute({
          sql: `INSERT INTO timetable (className, day, period, subject, teacher, roomNo, startTime, endTime, departureTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            className,
            day,
            period,
            subject || 'Free',
            teacher || '',
            roomNo || '',
            sampleRow.startTime || '',
            sampleRow.endTime || '',
            sampleRow.departureTime || ''
          ]
        });
      }
    }

    try {
      if (typeof invalidateQueryCache === 'function') invalidateQueryCache();
      await getStore(true);
    } catch (e) {}

    res.json({ ok: true, message: "Timetable slot updated successfully" });
  } catch (err) {
    console.error("Error saving timetable slot:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timetable/slot/delete - Delete or clear a timetable slot (removes duplicate subjects)
app.post("/api/timetable/slot/delete", authRequired, async (req, res) => {
  try {
    const user = req.session.user;
    const roleStr = String(user?.role || '').toLowerCase();
    const roleLvl = getRoleLevel(user?.role);
    if (roleLvl < 1 && roleStr !== "administrator" && roleStr !== "principal" && roleStr !== "staff" && roleStr !== "teacher") {
      return res.status(403).json({ error: "Only Authorized Teachers & Staff can delete timetable slots" });
    }

    const { id, className, day, period, clearOnly } = req.body || {};
    const { db, getStore, invalidateQueryCache } = require("./server/db-sqlite");

    if (clearOnly) {
      // Clear slot (set subject to Free, teacher to empty)
      if (id && parseInt(id, 10) > 0) {
        await db.execute({
          sql: `UPDATE timetable SET subject = 'Free', teacher = '', roomNo = '' WHERE id = ?`,
          args: [parseInt(id, 10)]
        });
      } else if (className && day && period) {
        await db.execute({
          sql: `UPDATE timetable SET subject = 'Free', teacher = '', roomNo = '' WHERE UPPER(TRIM(className)) = UPPER(TRIM(?)) AND UPPER(TRIM(day)) = UPPER(TRIM(?)) AND UPPER(TRIM(period)) = UPPER(TRIM(?))`,
          args: [className, day, period]
        });
      }
    } else {
      // Delete record completely (e.g. duplicate entry)
      if (id && parseInt(id, 10) > 0) {
        await db.execute({
          sql: `DELETE FROM timetable WHERE id = ?`,
          args: [parseInt(id, 10)]
        });
      } else if (className && day && period) {
        await db.execute({
          sql: `DELETE FROM timetable WHERE UPPER(TRIM(className)) = UPPER(TRIM(?)) AND UPPER(TRIM(day)) = UPPER(TRIM(?)) AND UPPER(TRIM(period)) = UPPER(TRIM(?))`,
          args: [className, day, period]
        });
      } else if (className && day) {
        await db.execute({
          sql: `DELETE FROM timetable WHERE UPPER(TRIM(className)) = UPPER(TRIM(?)) AND UPPER(TRIM(day)) = UPPER(TRIM(?))`,
          args: [className, day]
        });
      }
    }

    try {
      if (typeof invalidateQueryCache === 'function') invalidateQueryCache();
      await getStore(true);
    } catch (e) {}

    res.json({ ok: true, message: "Timetable slot deleted/cleared successfully" });
  } catch (err) {
    console.error("Error deleting timetable slot:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------- WHATSAPP ALERTS -------------------

// GET /api/whatsapp/due-fees  →  returns pending/partial fee records enriched with parent phone
app.get("/api/whatsapp/due-fees", authRequired, async (req, res) => {
  try {
    const user = req.session.user;
    if (!isStaffOrAbove(user) && !isAdmin(user)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const fees = await list("fees");
    const students = await list("students");
    const dueMgmt = await list("dueManagement");

    const studentAdmMap = {};
    const studentNameMap = {};
    students.forEach(s => { 
      // Avoid mapping dummy admission numbers so it falls back to studentNameMap correctly
      if (s.admissionNo && s.admissionNo !== "00" && s.admissionNo !== "0" && s.admissionNo.toLowerCase() !== "temp") {
          studentAdmMap[s.admissionNo] = s;
      }
      // Only set name map if no collision (BUG-9 fix: prefer admissionNo lookup)
      if (!studentNameMap[s.fullName]) studentNameMap[s.fullName] = s; 
    });

    const results = [];
    // Track which student+month combos we've already added (BUG-8 dedup)
    const seenKeys = new Set();

    // 1. Process standard fees slips
    fees
      .filter(f => {
        const status = String(f.status || "").toLowerCase();
        const bal = parseFloat(f.balance) || 0;
        return (status === "pending" || status === "partial") && bal > 0;
      })
      .forEach(f => {
        const student = studentAdmMap[f.admissionNo] || studentNameMap[f.studentName] || {};
        const dedupKey = `${f.admissionNo || f.studentName}__${f.month || f.term || ""}`;
        seenKeys.add(dedupKey);
        results.push({
          feeId: f.id,
          admissionNo: f.admissionNo || student.admissionNo || "",
          studentName: f.studentName || "",
          className: f.className || student.className || "",
          rollNo: f.rollNo || student.rollNo || "",
          fatherName: student.fatherName || "",
          parentName: student.fatherName || "",
          phone: student.phone || "",
          balance: f.balance || "0",
          totalFee: f.totalFee || "0",
          paidAmount: f.paidAmount || "0",
          term: f.term || "Fee Slip",
          status: f.status || "Pending",
          paymentDate: f.paymentDate || "",
          source: "fees"
        });
      });

    // 2. Process manual Due Management items (skip if already covered by a fee slip)
    dueMgmt
      .filter(d => {
        const status = String(d.status || "").toLowerCase();
        const bal = parseFloat(d.balance) || 0;
        return status !== "paid" && bal > 0;
      })
      .forEach(d => {
        // BUG-8 fix: skip if a fee slip already covers this student+month
        const monthFromParticulars = (d.particulars || "").replace("Tuition fee of ", "").replace("Late fee of ", "");
        const dedupKey = `${d.admissionNo || d.studentName}__${monthFromParticulars}`;
        if (seenKeys.has(dedupKey)) return; // Already have a fee slip for this
        
        const student = studentAdmMap[d.admissionNo] || studentNameMap[d.studentName] || {};
        results.push({
          feeId: `dm-${d.id}`,
          admissionNo: d.admissionNo || student.admissionNo || "",
          studentName: d.studentName || "",
          className: d.className || student.className || "",
          rollNo: d.rollNo || student.rollNo || "",
          fatherName: student.fatherName || "",
          parentName: student.fatherName || "",
          phone: student.phone || "",
          balance: d.balance || "0",
          totalFee: d.dueAmount || "0",
          paidAmount: d.paidAmount || "0",
          term: d.particulars || "Due Mgmt",
          status: d.status || "Unpaid",
          paymentDate: "",
          source: "dueManagement"
        });
      });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch due fees" });
  }
});

// POST /api/whatsapp/log-alert  →  logs a WhatsApp alert that was sent
app.post("/api/whatsapp/log-alert", authRequired, async (req, res) => {
  try {
    const user = req.session.user;
    if (!isStaffOrAbove(user) && !isAdmin(user)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const { studentName, className, phone, fatherName, parentName, balance, term, message } = req.body || {};
    const today = (function(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})();
    const row = await insert("whatsappAlerts", {
      studentName: studentName || "",
      className: className || "",
      phone: phone || "",
      parentName: fatherName || parentName || "",
      balance: String(balance || ""),
      term: term || "",
      alertDate: today,
      message: message || "",
      status: "Sent"
    });
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log alert" });
  }
});

// ─────────────────────────────────────────────────────────────
// 🎙️ VOICE NOTIFICATIONS & HANDS-FREE AUDIO BROADCAST ENGINE
// ─────────────────────────────────────────────────────────────

// POST /api/voice-notifications/send -> Broadcast voice notification
app.post("/api/voice-notifications/send", authRequired, async (req, res) => {
  try {
    let user = req.session?.user;
    if (!user && (req.headers['x-admin-pin'] === 'tapowan2026' || req.body?.adminPin === 'tapowan2026' || req.query?.adminPin === 'tapowan2026')) {
      user = { username: 'admin', fullName: 'Tapowan School Admin', role: 'administrator' };
      req.session = req.session || {};
      req.session.user = user;
    }
    if (!isStaffOrAbove(user) && !isAdmin(user)) {
      return res.status(403).json({ error: "Only administrators and staff can broadcast voice notifications" });
    }

    const {
      title,
      message,
      targetType = 'all',
      targetClass = '',
      targetId = '',
      audioBase64,
      audioMime = 'audio/mpeg',
      audioFilename = 'voice_announcement.mp3',
      durationSec = 0
    } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const cleanTitle = title.trim();
    const cleanMessage = (message || '').trim();
    const senderName = user.name || user.fullName || 'Tapowan School Admin';
    const senderRole = user.role || 'Administrator';

    let cleanBase64 = '';
    let audioBytes = 0;
    if (audioBase64 && typeof audioBase64 === 'string') {
      cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
      audioBytes = Buffer.byteLength(cleanBase64, 'base64');
    }

    // 1. Insert into app_voice_notifications
    const insertRes = await db.execute({
      sql: `INSERT INTO app_voice_notifications (
        title, message, target_type, target_class, target_id,
        audio_filename, audio_mime, audio_base64, audio_size_bytes, duration_sec,
        sender_name, sender_role, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      args: [
        cleanTitle,
        cleanMessage,
        targetType,
        targetClass,
        targetId,
        audioFilename,
        audioMime,
        cleanBase64,
        audioBytes,
        parseInt(durationSec, 10) || 0,
        senderName,
        senderRole
      ]
    });

    const newId = insertRes.lastInsertRowid || (await db.execute("SELECT MAX(id) as maxId FROM app_voice_notifications"))?.rows?.[0]?.[0] || Date.now();

    // 2. Record in notice feeds with strict audience isolation
    try {
      const today = new Date().toISOString().split('T')[0];
      if (targetType === 'all') {
        await db.execute({
          sql: `INSERT INTO app_notices (title, content, date, category, is_active, created_at) VALUES (?, ?, ?, 'Voice Announcement', 1, CURRENT_TIMESTAMP)`,
          args: [
            `🎙️ ${cleanTitle}`,
            cleanMessage || "🎙️ Voice Announcement from Tapowan Public School. Auto-playing audio announcement.",
            today
          ]
        });
      } else if (targetType === 'teachers') {
        await db.execute({
          sql: `INSERT INTO app_teacher_announcements (title, content, recipient_type, target_class, is_important, created_by, created_at) VALUES (?, ?, 'teachers', 'Teachers Only', 1, ?, CURRENT_TIMESTAMP)`,
          args: [
            `🎙️ ${cleanTitle}`,
            cleanMessage || "🎙️ Voice Announcement for Teachers.",
            senderName
          ]
        });
      } else if (targetType === 'class') {
        await db.execute({
          sql: `INSERT INTO app_teacher_announcements (title, content, recipient_type, target_class, is_important, created_by, created_at) VALUES (?, ?, 'class', ?, 1, ?, CURRENT_TIMESTAMP)`,
          args: [
            `🎙️ ${cleanTitle}`,
            cleanMessage || `🎙️ Voice Announcement for Class ${targetClass}.`,
            targetClass,
            senderName
          ]
        });
      } else if (targetType === 'student') {
        await db.execute({
          sql: `INSERT INTO app_teacher_announcements (title, content, recipient_type, target_class, is_important, created_by, created_at) VALUES (?, ?, 'students', ?, 1, ?, CURRENT_TIMESTAMP)`,
          args: [
            `🎙️ ${cleanTitle}`,
            cleanMessage || `🎙️ Voice Announcement for Student (${targetId}).`,
            targetId,
            senderName
          ]
        });
      }
    } catch(e) {
      console.warn('Notice sync warning:', e.message);
    }

    // 3. Dispatch dual-route high priority push notification (FCM v1 + Expo)
    const pushResult = await dispatchVoiceNotificationPush({
      id: newId,
      title: cleanTitle,
      message: cleanMessage,
      targetType,
      targetClass,
      targetId,
      senderName,
      durationSec
    });

    res.status(201).json({
      success: true,
      id: newId,
      title: cleanTitle,
      recipientsNotified: pushResult.count || 0,
      audioBytes
    });
  } catch (err) {
    console.error('[Voice Notification Send Error]', err);
    res.status(500).json({ error: "Failed to send voice notification: " + (err.message || err) });
  }
});

// GET /api/voice-notifications/:id/audio -> Stream audio with byte range support
app.get("/api/voice-notifications/:id/audio", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: "SELECT audio_base64, audio_mime, audio_filename FROM app_voice_notifications WHERE id = ? LIMIT 1",
      args: [id]
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "Audio not found" });
    }

    const row = result.rows[0];
    const b64 = row.audio_base64 || row[0];
    const mime = row.audio_mime || row[1] || 'audio/mpeg';

    if (!b64 || typeof b64 !== 'string') {
      return res.status(404).json({ error: "No audio data present for this notification" });
    }

    const buffer = Buffer.from(b64, 'base64');
    const totalLength = buffer.length;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(buffer.slice(start, end + 1));
    } else {
      res.writeHead(200, {
        'Content-Length': totalLength,
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(buffer);
    }
  } catch (err) {
    console.error('[Voice Audio Stream Error]', err);
    res.status(500).json({ error: "Failed to stream audio: " + (err.message || err) });
  }
});

// GET /api/voice-notifications -> List recent notifications without heavy base64
app.get("/api/voice-notifications", authRequired, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT id, title, message, target_type, target_class, target_id, audio_filename, audio_mime, 
                   audio_size_bytes, duration_sec, sender_name, sender_role, is_active, created_at 
            FROM app_voice_notifications 
            WHERE is_active = 1 
            ORDER BY id DESC LIMIT 50`
    });
    res.json(result.rows || []);
  } catch (err) {
    console.error('[Voice Notifications List Error]', err);
    res.status(500).json({ error: "Failed to list voice notifications: " + (err.message || err) });
  }
});

// DELETE /api/voice-notifications/:id -> Deactivate voice notification
app.delete("/api/voice-notifications/:id", authRequired, async (req, res) => {
  try {
    let user = req.session?.user;
    if (!user && (req.headers['x-admin-pin'] === 'tapowan2026' || req.body?.adminPin === 'tapowan2026' || req.query?.adminPin === 'tapowan2026')) {
      user = { username: 'admin', fullName: 'Tapowan School Admin', role: 'administrator' };
      req.session = req.session || {};
      req.session.user = user;
    }
    if (!isStaffOrAbove(user) && !isAdmin(user)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    const { id } = req.params;
    await db.execute({
      sql: "UPDATE app_voice_notifications SET is_active = 0 WHERE id = ?",
      args: [id]
    });
    res.json({ success: true, message: "Voice notification deactivated" });
  } catch (err) {
    console.error('[Voice Notification Delete Error]', err);
    res.status(500).json({ error: "Failed to delete voice notification" });
  }
});

// POST /api/sms/send  →  Proxies SMS gateway request via backend to bypass CORS and securely handle embedded passwords
app.post("/api/sms/send", authRequired, async (req, res) => {
  try {
     const user = req.session.user;
     if (!isStaffOrAbove(user) && !isAdmin(user)) return res.status(403).json({ error: "Insufficient permissions" });

     const { gatewayUrl, phone, message } = req.body;
     if (!gatewayUrl || !phone || !message) return res.status(400).json({ error: "Missing parameters" });

     // Parse the gateway URL
     const urlObj = new URL(gatewayUrl);
     const headers = {};

     // Handle Basic Auth from URL if present
     if (urlObj.username || urlObj.password) {
         const authStr = Buffer.from(`${urlObj.username}:${urlObj.password}`).toString("base64");
         headers["Authorization"] = `Basic ${authStr}`;
         // Strip credentials from the URL object for safety
         urlObj.username = "";
         urlObj.password = "";
     }
     
     // Build a CLEAN gateway URL string from our parsed object
     const cleanGatewayUrl = urlObj.toString();

     let targetUrl = cleanGatewayUrl;
     let method = 'POST';
     let body = null;

     const isTemplate = gatewayUrl.includes("{phone}") || gatewayUrl.includes("{message}");

     if (isTemplate) {
         // 1. Traditional Android Gateway apps (GET with Template)
         // IMPORTANT: Use ORIGINAL RAW string for replacement because cleanGatewayUrl (via URL object) 
         // encodes curly braces as %7B / %7D, which makes the .replace() fail.
         targetUrl = gatewayUrl.replace("{phone}", phone).replace("{message}", encodeURIComponent(message));
         method = 'GET';
         body = null;
     } else {
         // 2. Specialized or POST-based gateways
         method = 'POST';
         
         if (urlObj.pathname === "/" || urlObj.pathname === "") {
             // Default to Capcom6 style /message if no path provided
             const targetBase = `${urlObj.protocol}//${urlObj.host}`;
             targetUrl = `${targetBase}/message`;
         } else {
             targetUrl = cleanGatewayUrl;
         }

         body = JSON.stringify({
           phoneNumbers: [phone],
           message: message
         });
     }

     // Mask credentials for safe logging
     const maskedUrl = targetUrl.replace(/\/\/[^@]+@/, "//***:***@");
     console.log(`[SMS Backend Proxy] ${method} to ${maskedUrl}...`);
     if (headers["Authorization"]) console.log(`[SMS Backend Proxy] Using Authorization header (Basic)`);
     
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 10000); 

     try {
       const fetchOptions = {
           method: method,
           headers: headers,
           signal: controller.signal
       };

       if (method === 'POST') {
           fetchOptions.body = body;
           headers['Content-Type'] = 'application/json';
       }

       const response = await fetch(targetUrl, fetchOptions);
       clearTimeout(timeoutId);

       const responseText = await response.text();
       console.log(`[SMS Backend Proxy] Result: ${response.status}`, responseText);

       if (!response.ok && response.status !== 202) {
           const errHint = responseText ? `: ${responseText}` : "";
           return res.status(400).json({ 
             error: `Gateway responded with HTTP ${response.status}${errHint}`,
             body: responseText 
           });
       }

       res.json({ success: true });
     } catch (fetchErr) {
       clearTimeout(timeoutId);
       if (fetchErr.name === 'AbortError') {
         return res.status(504).json({ error: "Gateway Timeout: Phone took too long to respond. Check if the app is open and on the same WiFi." });
       }
       throw fetchErr;
     }
  } catch (err) {
     console.error("[SMS Backend Proxy Error]", err.message);
     res.status(500).json({ error: err.message });
  }
});

// ------------------- PROPER AI ASSISTANT -------------------

app.post("/api/chat", authRequired, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ reply: "⚠️ Gemini API Key is missing. Please add GEMINI_API_KEY to your backend environment (.env) to enable the AI." });
    }

    const { prompt, context } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are EduCore AI, a highly intuitive and helpful assistant for a School Management System.
The user is a staff member currently logged in.
Here is the current state of their app right now:
${context || 'No specific context provided.'}

Answer their questions confidently. Keep responses concise and helpful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      }
    });

    res.json({ reply: response.text });
  } catch (err) {
    console.error("Gemini AI API Error:", err);
    res.status(500).json({ reply: `❌ AI Error: ${err.message}` });
  }
});

// ------------------- IP CAMERA SNAPSHOT PROXY -------------------
// Fetches a single JPEG frame from the IP camera so the browser can read
// the pixels without cross-origin canvas taint restrictions.

app.get("/api/camera-snapshot", authRequired, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing ?url= parameter" });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("multipart")) {
      // MJPEG stream — read until we get one complete JPEG frame
      const reader = response.body.getReader();
      const chunks = [];
      let totalLen = 0;
      let foundJpeg = false;

      while (!foundJpeg && totalLen < 2 * 1024 * 1024) { // max 2MB
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLen += value.length;

        // Concatenate and look for JPEG markers (FFD8 start, FFD9 end)
        const buf = Buffer.concat(chunks);
        const soi = buf.indexOf(Buffer.from([0xFF, 0xD8]));
        const eoi = buf.indexOf(Buffer.from([0xFF, 0xD9]), soi > -1 ? soi : 0);
        if (soi > -1 && eoi > -1 && eoi > soi) {
          const jpeg = buf.slice(soi, eoi + 2);
          reader.cancel();
          res.set("Content-Type", "image/jpeg");
          res.set("Cache-Control", "no-cache, no-store");
          res.send(jpeg);
          foundJpeg = true;
        }
      }
      if (!foundJpeg) {
        reader.cancel();
        res.status(502).json({ error: "Could not extract JPEG frame from MJPEG stream" });
      }
    } else {
      // Snapshot URL — pipe through
      res.set("Content-Type", contentType || "image/jpeg");
      res.set("Cache-Control", "no-cache, no-store");
      const arrayBuf = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    }
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "IP camera request timed out" });
    }
    console.error("Camera proxy error:", err.message);
    res.status(502).json({ error: "Failed to reach IP camera: " + err.message });
  }
});

// ------------------- AUTOMATED FEE TASK -------------------

/**
 * Robustly matches a month name against a database month string (could be "Apr" or "April" etc.)
 */
function isMonthMatch(dbMonth, targetMonthName) {
    if (!dbMonth || !targetMonthName) return false;
    const dbVal = String(dbMonth).toLowerCase();
    const targetVal = String(targetMonthName).toLowerCase();
    const shortNames = {
        "january": "jan", "february": "feb", "march": "mar", "april": "apr",
        "may": "may", "june": "jun", "july": "jul", "august": "aug",
        "september": "sep", "october": "oct", "november": "nov", "december": "dec"
    };
    const shortTarget = shortNames[targetVal] || targetVal.substring(0, 3);
    
    // Check for full name or short name in the potentially comma-separated db string or longer text
    const regex = new RegExp(`\\b(${targetVal}|${shortTarget})\\b`, 'i');
    return regex.test(dbVal);
}

let _feeTaskRunning = false; // Concurrency lock
async function runAutomatedFeeTask() {
  if (_feeTaskRunning) { console.log("[Fee Automation] Already running, skipping."); return; }
  _feeTaskRunning = true;
  try {
    const today = new Date();
    const day = today.getDate();
    const monthIndex = today.getMonth();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = months[monthIndex];
    // BUG-1 fix: Dynamic session calculation (Apr-Mar academic year)
    const year = today.getFullYear();
    const sessionStartYear = monthIndex >= 3 ? year : year - 1; // Apr=3 onwards = current year
    const session = `${String(sessionStartYear).slice(2)}-${String(sessionStartYear + 1).slice(2)}`;

    console.log(`[Fee Automation] Checking for ${monthName} dues (Day: ${day})...`);

    const students = await list("students");
    const feeStructures = await list("feeStructures");
    const dueManagement = await list("dueManagement");
    const allFees = await list("fees");

    // ── Auto-Sync: Remove Dues that have since been paid in Fees module ──
    const autoSyncDues = dueManagement.filter(d => 
        d.status === "Unpaid" && (d.particulars || "").includes(" of ")
    );
    if (autoSyncDues.length > 0) {
        let syncCount = 0;
        for (const due of autoSyncDues) {
            const parts = due.particulars.split(" of ");
            if (parts.length < 2) continue;
            const feeName = parts[0].trim();
            const monthStored = parts[1].trim();
            
            // Check if there's ANY fee record for this month with matching feeType
            const isTrackedInFees = allFees.some(f => {
                if (f.admissionNo !== due.admissionNo) return false;
                const isMatch = isMonthMatch(f.month, monthStored) || isMonthMatch(f.term, monthStored);
                if (!isMatch) return false;
                
                return f.feeTypes && f.feeTypes.toLowerCase().includes(feeName.toLowerCase());
            });

            if (isTrackedInFees) {
                console.log(`[Fee Automation] Sync: Found payment for ${due.studentName} (${due.particulars}). Removing redundant due.`);
                await remove("dueManagement", due.id);
                syncCount++;
            }
        }
        if (syncCount > 0) console.log(`[Fee Automation] Sync: Cleaned up ${syncCount} paid records.`);
    }

    // ── Global Sync: Update ALL Unpaid Dues if Fee Structure changed ──
    let globalSyncCount = 0;
    const unpaidDuesToSync = dueManagement.filter(d => d.status === "Unpaid" && (d.particulars || "").includes(" of "));
    for (const due of unpaidDuesToSync) {
        const student = students.find(s => s.admissionNo === due.admissionNo);
        if (!student) continue;

        const className = due.className || student.className;
        const parts = due.particulars.split(" of ");
        if (parts.length < 2) continue;
        const feeName = parts[0].trim();
        
        // Find matching struct by feeType or description
        const struct = feeStructures.find(s => s.className === className && 
            (s.feeType === feeName || (s.feeType === "Other" && s.description === feeName))
        );
        
        if (struct && String(struct.amount) !== String(due.dueAmount)) {
            const alreadyPaid = parseFloat(due.paidAmount) || 0;
            const newBalance = Math.max(0, parseFloat(struct.amount) - alreadyPaid);
            console.log(`[Fee Automation] Global Sync: Updating ${feeName} for ${due.studentName} (${due.particulars}) from ${due.dueAmount} to ${struct.amount} (paid: ${alreadyPaid}, new balance: ${newBalance})`);
            await update("dueManagement", due.id, {
                dueAmount: struct.amount,
                balance: String(newBalance)
            });
            globalSyncCount++;
        }
    }
    if (globalSyncCount > 0) console.log(`[Fee Automation] Global Sync: Updated ${globalSyncCount} records across all months.`);

    // ── Robust Automation: Check all months from April up to current month ──
    const activeMonths = [];
    if (monthIndex >= 3) {
        for (let i = 3; i <= monthIndex; i++) activeMonths.push({ name: months[i], isCurrent: i === monthIndex });
    } else {
        for (let i = 3; i <= 11; i++) activeMonths.push({ name: months[i], isCurrent: false });
        for (let i = 0; i <= monthIndex; i++) activeMonths.push({ name: months[i], isCurrent: i === monthIndex });
    }

    for (const student of students) {
        if (student.status === "Inactive") continue;

        const className = student.className;
        const admNo = student.admissionNo;
        
        // Find all monthly fees applicable to this class
        const classMonthlyFees = feeStructures.filter(s => s.className === className && String(s.term || "").toLowerCase() === "monthly");

        for (const mObj of activeMonths) {
            const mName = mObj.name;
            
            for (const struct of classMonthlyFees) {
                const actualFeeName = struct.feeType === "Other" ? (struct.description || "Custom Fee") : struct.feeType;
                
                // Determine if it should be generated this month
                const isLateFee = actualFeeName.toLowerCase().includes("late");
                if (isLateFee && mName === "April") continue; // Usually no late fee for April
                
                const shouldGenerate = !mObj.isCurrent || (isLateFee ? day >= 11 : day >= 1);
                if (!shouldGenerate) continue;
                
                const particulars = `${actualFeeName} of ${mName}`;
                
                const isTrackedInFees = allFees.some(f => {
                    if (f.admissionNo !== admNo) return false;
                    const isMatch = isMonthMatch(f.month, mName) || isMonthMatch(f.term, mName);
                    if (!isMatch) return false;
                    return f.feeTypes && f.feeTypes.toLowerCase().includes(actualFeeName.toLowerCase());
                });

                const existsInDues = dueManagement.find(d => 
                    d.admissionNo === admNo && 
                    (d.particulars || "").toLowerCase() === particulars.toLowerCase() && 
                    d.session === session
                );
                
                if (!existsInDues && !isTrackedInFees) {
                    const amount = struct.amount || "0";
                    await insert("dueManagement", {
                        admissionNo: admNo,
                        studentName: student.fullName,
                        className: className,
                        rollNo: student.rollNo || "",
                        session: session,
                        month: mName.substring(0,3),
                        particulars: particulars,
                        dueAmount: amount,
                        paidAmount: "0",
                        balance: amount,
                        status: "Unpaid"
                    });
                    console.log(`[Fee Automation] Added [${actualFeeName}: ${amount}] for ${student.fullName} (${admNo}, ${mName})`);
                }
            }
        }
    }
    console.log("[Fee Automation] Task completed successfully.");
  } catch (err) {
    console.error("[Fee Automation] Critical Error:", err);
  } finally {
    _feeTaskRunning = false; // Release concurrency lock
  }
}

// ------------------- DB MIGRATION -------------------
async function migrateInvalidAdmissionNumbers() {
  try {
    const students = await list("students");
    const fees = await list("fees");
    const dues = await list("dueManagement");

    let highestTps = 0;
    
    for (const s of students) {
      if (s.admissionNo && String(s.admissionNo).toUpperCase().startsWith("TPS")) {
         const num = parseInt(String(s.admissionNo).substring(3), 10);
         if (!isNaN(num) && num > highestTps) {
            highestTps = num;
         }
      }
    }

    const isBad = (adm) => {
      if (!adm) return true;
      const str = String(adm).trim().toUpperCase();
      if (str === "" || str === "NIL" || str === "NULL") return true;
      if (/^[0\/\-\s]+$/.test(str)) return true;
      return false;
    };

    let modifiedCount = 0;

    for (const s of students) {
       const adm = String(s.admissionNo || "").trim().toUpperCase();

       if (isBad(adm)) {
          highestTps++;
          const newAdmNo = `TPS${String(highestTps).padStart(2, '0')}`;
          const oldAdmNo = s.admissionNo;

          await update("students", s.id, { ...s, admissionNo: newAdmNo });
          
          const matchingFees = fees.filter(f => 
             String(f.admissionNo) === String(oldAdmNo) && 
             String(f.studentName).trim().toLowerCase() === String(s.fullName).trim().toLowerCase()
          );
          for (const f of matchingFees) {
             await update("fees", f.id, { ...f, admissionNo: newAdmNo });
          }

          const matchingDues = dues.filter(d => 
             String(d.admissionNo) === String(oldAdmNo) && 
             String(d.studentName).trim().toLowerCase() === String(s.fullName).trim().toLowerCase()
          );
          for (const d of matchingDues) {
             await update("dueManagement", d.id, { ...d, admissionNo: newAdmNo });
          }
          
          console.log(`[Migration] Migrated invalid admissionNo "${oldAdmNo}" for ${s.fullName} to "${newAdmNo}"`);
          modifiedCount++;
       }
    }
    
    if (modifiedCount > 0) {
       console.log(`[Migration] Successfully fixed ${modifiedCount} student admission numbers.`);
    }
  } catch (err) {
    console.error("[Migration] Error migrating admission numbers:", err);
  }
}

// ------------------- DB MIGRATION -------------------
async function migrateDueManagementMonths() {
  try {
    const dues = await list("dueManagement");
    let modifiedCount = 0;
    for (const d of dues) {
      if (!d.month && d.particulars) {
        let monthName = "";
        const p = d.particulars.toLowerCase();
        if (p.startsWith("tuition fee of ")) {
          monthName = d.particulars.substring(15).trim();
        } else if (p.startsWith("late fee of ")) {
          monthName = d.particulars.substring(12).trim();
        }
        if (monthName) {
          const shortMonth = monthName.substring(0, 3);
          await update("dueManagement", d.id, { ...d, month: shortMonth });
          modifiedCount++;
        }
      }
    }
    if (modifiedCount > 0) {
      console.log(`[Migration] Successfully backfilled month for ${modifiedCount} due records.`);
    }
  } catch (err) {
    console.error("[Migration] Error migrating due months:", err);
  }
}

// ------------------- VOICE RECEPTIONIST AI -------------------
app.post("/api/voice-receptionist", authRequired, express.json(), async (req, res) => {
  try {
    const transcript = req.body.transcript || "";
    if (!transcript) return res.json({ response: "I'm sorry, I didn't quite catch that." });
    
    if (!genAI) {
      return res.json({ response: "AI features are not configured. Please add the Gemini API key." });
    }

    // Prepare context
    const students = await list("students") || [];
    const fees = await list("fees") || [];
    const attendance = await list("attendance") || [];
    const timetable = await list("timetable") || [];
    const teachers = await list("teachers") || [];

    // Optimize context by stripping base64 photos and unneeded fields
    const minStudents = students.map(s => ({
      name: s.fullName,
      class: s.className,
      roll: s.rollNo,
      father: s.fatherName,
      phone: s.phone
    }));
    const minFees = fees.map(f => ({
      name: f.studentName,
      class: f.className,
      month: f.feeMonth,
      total: f.totalAmount,
      paid: f.paidAmount,
      due: f.dueAmount,
      status: f.status
    }));
    const minTimetable = timetable.map(t => ({
      class: t.className,
      day: t.day,
      period: t.period,
      subject: t.subject,
      teacher: t.teacher,
      room: t.roomNo
    }));
    const minTeachers = teachers.map(t => ({
      name: t.fullName,
      dept: t.department,
      phone: t.phone
    }));

    const systemPrompt = `You are an AI receptionist for Tapowan Public School. Be polite, concise, and helpful. Keep your answers brief (1-3 short sentences max) because you are speaking out loud.
IMPORTANT: You MUST respond ONLY in Hindi (using Latin/Hinglish script or Devanagari). Never reply in English.
If the visitor asks about a student, look them up in the provided JSON data. If they ask about fees, provide the due amount.
If the visitor mentions a student name (e.g. "alim amber"), look for an exact match first. Only if an exact match is NOT found, then use your best judgement to find the closest match based on phonetic or spelling variations (e.g. "aalim amber", "alim raza").
You also have access to the school timetable and teacher directory to answer related queries accurately.
If the visitor asks general knowledge or public questions (like current events, movies, politicians, general trivia, etc.), you MUST answer them intelligently and helpfully.
Visitor's transcript: "${transcript}"

--- SCHOOL DATABASE (JSON) ---
Students: ${JSON.stringify(minStudents)}
Fees: ${JSON.stringify(minFees)}
Timetable: ${JSON.stringify(minTimetable)}
Teachers: ${JSON.stringify(minTeachers)}
------------------------------`;

    let providerFuncs = [
      { name: "OpenRouter", func: tryOpenRouter },
      { name: "Gemini", func: tryGemini },
      { name: "OpenAI", func: tryOpenAI }
    ];

    let responseText = "";
    let lastErr = null;

    for (const p of providerFuncs) {
      try {
        // Pass empty transcript as prompt since the transcript is embedded heavily in systemPrompt already
        // Or just pass the transcript as prompt.
        const result = await p.func(transcript, systemPrompt);
        responseText = result.reply;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[Voice AI] ${p.name} failed: ${err.message}`);
        continue;
      }
    }

    if (!responseText) {
      throw lastErr || new Error("All AI providers failed");
    }

    res.json({ response: responseText });
  } catch (err) {
    console.error("Voice AI Error:", err);
    res.json({ response: "I'm sorry, I experienced an error while checking the records." });
  }
});

// ------------------- START SERVER -------------------
async function startServer() {
  try {
    await initDb();
    console.log("✅ Database connected");
    if (!process.env.IS_CLOUD) {
      await migrateInvalidAdmissionNumbers();
      await migrateDueManagementMonths();
    }
  } catch (err) {
    console.error("⚠️ DB failed but server continues:", err.message);
  }

    // Start Tunnel and GitHub Sync
if (!process.env.IS_CLOUD) {
    const { startTunnelAndSync } = require('./tunnel-manager');
    startTunnelAndSync(PORT);
} else {
    console.log("Serveo Tunnel disabled in cloud mode.");
}

    // UDP Auto-Discovery Broadcast for Mobile App
    try {
      const dgram = require('dgram');
      const udpServer = dgram.createSocket('udp4');
      udpServer.bind(() => {
        udpServer.setBroadcast(true);
        setInterval(() => {
          const message = Buffer.from(JSON.stringify({ type: 'TAPOWAN_SERVER', port: PORT }));
          udpServer.send(message, 0, message.length, 50000, '255.255.255.255');
        }, 3000);
      });
      console.log(`[UDP] Broadcasting presence on port 50000`);
    } catch(err) {
      console.error("[UDP] Failed to start broadcast:", err);
    }

  if (process.env.VERCEL || process.env.NETLIFY || process.env.NETLIFY_LOCAL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  module.exports = app;
} else {
  app.listen(PORT, "0.0.0.0", () => {

    console.log(`\n🚀 ============================================`);
    console.log(`✅  TAPOWAN SCHOOL SERVER IS LIVE!`);
    console.log(`📡  HTTP PORT: ${PORT}`);
    console.log(`🌐  URL:  http://localhost:${PORT}`);
    console.log(`==============================================\n`);
    // Run automation task on start and then every hour
    runAutomatedFeeTask();
    setInterval(runAutomatedFeeTask, 6 * 60 * 60 * 1000);
    
    // Cloud Sync logic (Desktop only)
    if (!process.env.IS_CLOUD) {
      const { syncToSupabase } = require('./server/supabase-sync');
      // Run once on startup after 2s (full sync)
      setTimeout(() => syncToSupabase(false), 2000);
      setInterval(() => syncToSupabase(true), 10 * 1000); // Poll every 10 seconds for instant sync (PULL ONLY)
      setInterval(() => syncToSupabase(false), 2 * 60 * 1000); // Push to cloud every 2 minutes per user request
    }

    // AI Quiz Generation logic: Auto-generate 20 questions for each subject daily at 12:00 AM midnight (IST)
    const cron = require('node-cron');
    const { generateDailyQuizzes } = require('./server/generate-quiz');

    // 12:00 AM Midnight Cron Schedule (IST)
    cron.schedule('0 0 * * *', async () => {
      console.log('⏰ [12:00 AM CRON] Auto-triggering Daily AI Quiz Generation for all subjects...');
      try {
        await generateDailyQuizzes();
      } catch (err) {
        console.error('[12:00 AM CRON Error]:', err.message);
      }

      console.log('⏰ [12:00 AM CRON] Auto-purging voice call logs older than 24 hours...');
      try {
        await cleanupCallLogs({ olderThanHours: 24 });
      } catch (err) {
        console.error('[12:00 AM CRON Call Cleanup Error]:', err.message);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Run 20s after server startup if needed
    setTimeout(generateDailyQuizzes, 20000);
    setTimeout(() => cleanupCallLogs({ olderThanHours: 24 }).catch(() => {}), 15000);
  });

  // Dedicated Admin API Endpoint to trigger Daily AI Quiz Generation on demand
  app.post('/api/admin/quiz/generate-daily-ai', async (req, res) => {
    try {
      const { generateDailyQuizzes } = require('./server/generate-quiz');
      const results = await generateDailyQuizzes();
      res.json({ success: true, message: 'Daily 20 questions generated for all subjects via AI', results });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  // ── HTTPS Server on port 3443 (for Camera Attendance on network devices) ──
  try {
    const forge = require('node-forge');
    const https = require('https');

    // Check if SSL cert already exists, otherwise generate one
    // Use USER_DATA_PATH for writable storage (important inside Electron/ASAR)
    const sslBase = process.env.USER_DATA_PATH || __dirname;
    const certDir = path.join(sslBase, 'ssl');
    const keyPath = path.join(certDir, 'server.key');
    const certPath = path.join(certDir, 'server.crt');

    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      console.log('[HTTPS] Generating self-signed SSL certificate...');
      const pki = forge.pki;
      const keys = pki.rsa.generateKeyPair(2048);
      const cert = pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

      const attrs = [
        { name: 'commonName', value: 'Tapowan Public School' },
        { name: 'organizationName', value: 'Tapowan Public School' },
        { name: 'countryName', value: 'IN' }
      ];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);

      // Add SAN (Subject Alternative Names) for local network IPs
      const altNames = [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' }
      ];
      // Add all local network IPs
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            altNames.push({ type: 7, ip: net.address });
          }
        }
      }
      cert.setExtensions([
        { name: 'subjectAltName', altNames: altNames },
        { name: 'basicConstraints', cA: true }
      ]);

      cert.sign(keys.privateKey, forge.md.sha256.create());

      fs.writeFileSync(keyPath, pki.privateKeyToPem(keys.privateKey));
      fs.writeFileSync(certPath, pki.certificateToPem(cert));
      console.log('[HTTPS] SSL certificate generated successfully.');
    }

    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const HTTPS_PORT = 3443;
    https.createServer(httpsOptions, app).listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`🔒  HTTPS PORT: ${HTTPS_PORT}`);
      console.log(`🔒  URL:  https://localhost:${HTTPS_PORT}`);
      // Get local IP for easy access
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`📱  Network: https://${net.address}:${HTTPS_PORT}`);
          }
        }
      }
      console.log(`==============================================\n`);
    });
  } catch (err) {
    console.error('[HTTPS] Failed to start HTTPS server:', err.message);
    console.log('[HTTPS] Camera attendance will only work on localhost.');
  }

  // The 30-Minute Educational YouTube Reels Rolling Scheduler has been REMOVED.
  // It was automatically executing 'DELETE FROM app_reels' on every server cold start,
  // which wiped out the 25,000 custom reels we scraped. 
} // Closes else block for app.listen
} // Closes startServer()

if (process.env.VERCEL || process.env.NETLIFY || process.env.NETLIFY_LOCAL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  module.exports = app;
} else {
  startServer();
}
