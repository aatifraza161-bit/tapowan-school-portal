const { db } = require('./db-sqlite');

/**
 * Initialize Turso database tables for Voice Calling & Group Rooms
 */
async function initVoiceCallTables() {
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS app_voice_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id TEXT UNIQUE,
        caller_id TEXT,
        caller_name TEXT,
        caller_role TEXT,
        caller_avatar TEXT,
        receiver_id TEXT,
        receiver_name TEXT,
        receiver_role TEXT,
        status TEXT DEFAULT 'initiating',
        offer_sdp TEXT,
        answer_sdp TEXT,
        caller_ice TEXT,
        receiver_ice TEXT,
        duration_sec INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      args: []
    });

    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS app_voice_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT UNIQUE,
        title TEXT,
        host_id TEXT,
        host_name TEXT,
        host_role TEXT,
        target_type TEXT,
        target_class TEXT,
        status TEXT DEFAULT 'active',
        participants TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME
      )`,
      args: []
    });

    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS app_voice_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT,
        from_id TEXT,
        to_id TEXT,
        signal_type TEXT,
        signal_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      args: []
    });

    console.log("✅ Voice Call database tables verified/created successfully.");
  } catch (err) {
    console.error("Failed to initialize voice call tables:", err.message);
  }
}

// Ensure tables are created upon module load
initVoiceCallTables();

// ── In-Memory Fast Signaling Cache for Low Latency ──
const activeCallsMap = new Map(); // call_id -> callObj
const activeRoomsMap = new Map(); // room_id -> roomObj
const groupSignalsMap = new Map(); // room_id -> array of signals

// High-efficiency in-memory caches to eliminate excessive Turso DB read scans
const userAliasesCache = new Map(); // key -> { aliases: string[], expiresAt: number }
const ALIAS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes TTL
let lastRoomCleanupAt = 0;
let lastCallCleanupAt = 0;
let activeRoomsDbCache = { lastChecked: 0, rooms: [] };
const ROOM_CACHE_TTL = 15 * 1000; // 15 seconds TTL

function isStudent(role) {
  const r = String(role || '').toLowerCase();
  return r === 'student' || r === 'parent';
}

function isTeacherOrStaff(role) {
  const r = String(role || '').toLowerCase();
  return r === 'teacher' || r === 'staff' || r === 'faculty' || r === 'principal' || r === 'administrator' || r === 'admin';
}

const CANONICAL_CLASS_MAP = {
  '1-A': 'I-A', 'CLASS 1-A': 'I-A', 'CLASS 1': 'I-A', '1': 'I-A', 'CLASS I-A': 'I-A', 'CLASS I': 'I-A', 'I-A': 'I-A', 'I': 'I-A',
  '2-A': 'II-A', 'CLASS 2-A': 'II-A', 'CLASS 2': 'II-A', '2': 'II-A', 'CLASS II-A': 'II-A', 'CLASS II': 'II-A', 'II-A': 'II-A', 'II': 'II-A',
  '3-A': 'III-A', 'CLASS 3-A': 'III-A', 'CLASS 3': 'III-A', '3': 'III-A', 'CLASS III-A': 'III-A', 'CLASS III': 'III-A', 'III-A': 'III-A', 'III': 'III-A',
  '4-A': 'IV-A', 'CLASS 4-A': 'IV-A', 'CLASS 4': 'IV-A', '4': 'IV-A', 'CLASS IV-A': 'IV-A', 'CLASS IV': 'IV-A', 'IV-A': 'IV-A', 'IV': 'IV-A',
  '5-A': 'V-A', 'CLASS 5-A': 'V-A', 'CLASS 5': 'V-A', '5': 'V-A', 'CLASS V-A': 'V-A', 'CLASS V': 'V-A', 'V-A': 'V-A', 'V': 'V-A',
  '6-A': 'VI-A', 'CLASS 6-A': 'VI-A', 'CLASS 6': 'VI-A', '6': 'VI-A', 'CLASS VI-A': 'VI-A', 'CLASS VI': 'VI-A', 'VI-A': 'VI-A', 'VI': 'VI-A',
  '7-A': 'VII-A', 'CLASS 7-A': 'VII-A', 'CLASS 7': 'VII-A', '7': 'VII-A', 'CLASS VII-A': 'VII-A', 'CLASS VII': 'VII-A', 'VII-A': 'VII-A', 'VII': 'VII-A',
  '8-A': 'VIII-A', 'CLASS VIII-A': 'VIII-A', 'CLASS VIII': 'VIII-A', '8': 'VIII-A', 'CLASS VIII-A': 'VIII-A', 'CLASS VIII': 'VIII-A', 'VIII-A': 'VIII-A', 'VIII': 'VIII-A',
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

function getEquivalentClasses(cls) {
  if (!cls) return [];
  const s = String(cls).trim();
  if (!s) return [];
  const clean = s.toUpperCase();
  const norm = normalizeCanonicalClass(s);
  const raw = clean.replace(/^(CLASS|GRADE)\s+/i, '').trim();
  const withoutSec = norm.replace(/-[A-Z]$/i, '');
  const romanToNum = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5', 'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10' };
  const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X' };
  
  const set = new Set([s, norm, raw, withoutSec, clean, `CLASS ${raw}`, `CLASS ${withoutSec}`, `CLASS ${norm}`]);
  if (romanToNum[withoutSec]) {
    set.add(romanToNum[withoutSec]);
    set.add(`CLASS ${romanToNum[withoutSec]}`);
    set.add(`${romanToNum[withoutSec]}-A`);
  }
  if (numToRoman[withoutSec]) {
    set.add(numToRoman[withoutSec]);
    set.add(`CLASS ${numToRoman[withoutSec]}`);
    set.add(`${numToRoman[withoutSec]}-A`);
  }
  if (romanToNum[raw]) {
    set.add(romanToNum[raw]);
    set.add(`CLASS ${romanToNum[raw]}`);
  }
  if (numToRoman[raw]) {
    set.add(numToRoman[raw]);
    set.add(`CLASS ${numToRoman[raw]}`);
  }
  return Array.from(set).filter(Boolean);
}

function parseUtcDate(dt) {
  if (!dt) return 0;
  if (typeof dt === 'number') return dt;
  const s = String(dt).trim();
  if (!s) return 0;
  if (s.endsWith('Z')) return new Date(s).getTime();
  if (s.includes('T')) return new Date(s.endsWith('Z') ? s : s + 'Z').getTime();
  return new Date(s.replace(' ', 'T') + 'Z').getTime();
}

const crypto = require('crypto');

const FCM_SERVICE_ACCOUNT = {
  project_id: "tps-app-8dde5",
  client_email: "firebase-adminsdk-fbsvc@tps-app-8dde5.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDd+EiteRU4Dff3\nmNGqE5+DGkYKV2pCIGXIhV/eeVd2xosfTQKFpJb6s7udY1Lhpsu1sHyscKK6ZZFf\nfPrtF0GqWKZcewM27TMEgsx/o6f+WQSYx+d7jpf96ihJWPE4mIEBfhzeamJpRw21\ng03JUh6VyTyNXL0qNCmMGptCic7YvOUu7RIE0jopZYkcD0XhFNvhtdXi4txUpUXx\nbFqqL9HMcp4yMXvK3e9bJu0AFwR1izeKWcl37rjCJsfx86EGd7GDcKwp0+JebCtS\nwZIveQ1Pfbkdtgq3scwdwBlqfjoSLrDTwg0KxsoAzKPy0UJdvk7p0zU7gnHA7MSP\n6TsssoTTAgMBAAECggEAOnayQcqiDZ0UQkkkdAzuFxxc9U1X5endlSaX/SNtp5Gc\nxBZHA0c6IvcjA83M3zVM82J0PAEAw2KMGx/ygW7+My1dR/94dcedB+OhlD7ZORNe\nNBV3AWKp4s2BZexAwLzeQbPjS6uulvcJg9T9MHjqKF6UDdGu20ZY6Rd67FgavJfq\nY2SIYmHAztIwGj/EnShx8M6P7UbVdMgCXvE5dZeO9M2oY1Ts5Az9FUxOY5yT5OH/\nEhrLFeGrzucyZaTrNU84c63uK9p2yb8jfeNNmIeSYhEvRLboLDgsHTnO5n0+a4TJ\n5hMrV7XA1PxjZVAxacpZMsoy3Bj1US+4gFTcL2rM2QKBgQD9DRjNm1vFNOm0znXk\nsF0+eM6npkhlOOXjwwFZuWKP2Uld/XQw0GHiw8bwtQW8N4Ugk22OU2aMmQTJPy68\ntleT1KWDqa6jKBysUki5Qt1numLQn6sAV6qZw5n3LpdgCIQUNioqm4SXXjsbN0WA\n3FfnwH3Xg2dR2QSyGdz5l5VGKQKBgQDgjncU9mHFy8frV/IKILiyMPYtqwsut9OJ\nQss/uL+5URUMbqYMxX8M5+onI+whmBW1BWoU2swd02Gz/5wSku5t438G7VWfXwll\nMjAFgBjEadQBTFXgvG7buFyxqD7Iw3ZXnEPTS1Rud0ZBWXgfxQREuPhiAh0irVUH\nyiegQAX6mwKBgAxcFGcOfIgAUp3rK6T03EkN24IixAx1n/zk7G72eBLwmP3HQGKV\n+wH5cAEXxmTwDUePC93UwwCBBNPTizPacCKfU0pAAnCjp+rexgCOfIPxfZwVAGQu\n4/1IqX+CPhCJufHGx353RB2kk5x7saBeosiGBV9+YpCD2g/c5YcnWTopAoGBAK+/\nUHvbiRIhN0p9/jTm/yaXI1UCtTHPNYQL/r7UfVkwmGSuhM8iExmquJwBhWGVgge3\nQRspUu9U7PbPavsue+UNU/G79nNREi1dZjAn3Tp8CS0q7VuCntDgLcvtfZXrRMe0\nyXCpWF9MgnPK7jUPIRQYIG20cdEeD5qVIQZOlV9ZAoGBAKVUTqU8VKW4OLhI3umU\nfFiePOoZUcHqB/UFWhEPWNROSRVb7kZvkwLJ4jBD1zD2t2ZT8DXxENPwTLVqo3dN\ngLj3HfrzZAwUeMompY/sVty376F15mai+bQUX7yTgY0ah4XszW90hxxNkDyudoac\nRrhmGbNqG5Yzjyqbf52/0Z/d\n-----END PRIVATE KEY-----\n",
  token_uri: "https://oauth2.googleapis.com/token"
};

let cachedFcmToken = null;
let cachedFcmTokenExpiry = 0;

async function getFcmAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && cachedFcmTokenExpiry > now + 60) {
    return cachedFcmToken;
  }
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: FCM_SERVICE_ACCOUNT.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: FCM_SERVICE_ACCOUNT.token_uri,
    exp: now + 3600,
    iat: now
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const signatureInput = `${b64Header}.${b64Claim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(FCM_SERVICE_ACCOUNT.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch(FCM_SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (data.access_token) {
    cachedFcmToken = data.access_token;
    cachedFcmTokenExpiry = now + (data.expires_in || 3600);
    return cachedFcmToken;
  }
  return null;
}

/**
 * Send High-Priority Incoming Call Push Notification via Direct Firebase FCM v1 & Expo
 */
async function sendIncomingCallPush({ receiverId, receiverName, receiverRole, callerId, callerName, callerRole, callerAvatar, callId, offerSdp }) {
  const pushStartTime = Date.now();
  try {
    const sReceiverId = String(receiverId || '').trim();
    const cleanId = sReceiverId
      .replace(/^student_/i, '')
      .replace(/^teacher_/i, '')
      .replace(/^EMP-/i, '')
      .trim();
    const cleanName = String(receiverName || '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/👨‍🏫|👩‍🏫|📞/g, '')
      .trim();

    const idAliases = new Set([sReceiverId, cleanId, `EMP-${cleanId}`, `student_${cleanId}`]);
    if (/^\d+$/.test(cleanId)) {
      const num = parseInt(cleanId, 10);
      idAliases.add(String(num));
      idAliases.add(String(num).padStart(2, '0'));
      idAliases.add(String(num).padStart(3, '0'));
      idAliases.add(String(num).padStart(4, '0'));
      idAliases.add(`EMP-${num}`);
      idAliases.add(`EMP-${String(num).padStart(2, '0')}`);
    }
    if (cleanId.includes('/')) {
      const parts = cleanId.split('/');
      idAliases.add(cleanId.replace(/^0+/, ''));
      idAliases.add(cleanId.replace('/', ''));
      if (parts[0]) {
        idAliases.add(parts[0]);
        idAliases.add(parts[0].replace(/^0+/, ''));
        if (parts[1]) {
          idAliases.add(`${parts[0].replace(/^0+/, '')}/${parts[1]}`);
        }
      }
    }

    const aliasArr = [...idAliases].filter(Boolean);
    const isGenuineName = cleanName.length >= 3 && !['Student', 'Guest', 'Receiver', 'Faculty Member', 'School Contact', 'Faculty'].includes(cleanName);

    let tokens = [];

    // 1. Direct match on exact aliases in app_push_tokens
    const placeholders = aliasArr.map(() => '?').join(',');
    const directRes = await db.execute({
      sql: `SELECT token FROM app_push_tokens WHERE admission_no IN (${placeholders}) ORDER BY id DESC LIMIT 15`,
      args: aliasArr
    });
    tokens.push(...(directRes?.rows || []).map(r => r.token || r[0]).filter(Boolean));

    // 2. Direct match on exact name if genuine
    if (isGenuineName) {
      const nameRes = await db.execute({
        sql: `SELECT token FROM app_push_tokens WHERE student_name = ? OR UPPER(student_name) = UPPER(?) ORDER BY id DESC LIMIT 10`,
        args: [cleanName, cleanName]
      });
      tokens.push(...(nameRes?.rows || []).map(r => r.token || r[0]).filter(Boolean));
    }

    // 3. Relational Student Lookup (if receiver is a student or role unstated)
    if (receiverRole === 'student' || (!receiverRole && !sReceiverId.startsWith('EMP-'))) {
      const sRes = await db.execute({
        sql: `SELECT id, admissionNo, phone, phone1, phone2, fullName FROM students 
              WHERE admissionNo IN (${placeholders}) OR CAST(id AS TEXT) IN (${placeholders}) OR phone = ? OR phone1 = ? OR fullName = ? OR UPPER(fullName) = UPPER(?) LIMIT 5`,
        args: [...aliasArr, ...aliasArr, cleanId, cleanId, cleanName, cleanName]
      });
      for (const s of (sRes?.rows || [])) {
        const sAliases = [s.admissionNo, s.phone, s.phone1, s.phone2, String(s.id), s.fullName].filter(Boolean);
        const sPlaceholders = sAliases.map(() => '?').join(',');
        const sPushRows = await db.execute({
          sql: `SELECT token FROM app_push_tokens WHERE admission_no IN (${sPlaceholders}) OR student_name = ? ORDER BY id DESC LIMIT 10`,
          args: [...sAliases, s.fullName]
        });
        tokens.push(...(sPushRows?.rows || []).map(r => r.token || r[0]).filter(Boolean));
      }
    }

    // 4. Relational Teacher Lookup (if receiver is a teacher or role is teacher/staff)
    if (receiverRole === 'teacher' || (!receiverRole && sReceiverId.startsWith('EMP-'))) {
      const tRes = await db.execute({
        sql: `SELECT id, employeeNo, phone, fullName FROM teachers 
              WHERE id = ? OR employeeNo = ? OR ('EMP-' || employeeNo) = ? OR ('EMP-' || id) = ? OR phone = ? OR fullName = ? OR UPPER(fullName) = UPPER(?) LIMIT 5`,
        args: [cleanId, cleanId, sReceiverId, sReceiverId, cleanId, cleanName, cleanName]
      });
      for (const t of (tRes?.rows || [])) {
        const tAliases = [
          String(t.id),
          `EMP-${t.id}`,
          String(t.employeeNo),
          `EMP-${t.employeeNo}`,
          t.phone,
          t.fullName
        ].filter(Boolean);
        const tPlaceholders = tAliases.map(() => '?').join(',');
        const tPushRows = await db.execute({
          sql: `SELECT token FROM app_push_tokens WHERE admission_no IN (${tPlaceholders}) OR student_name = ? ORDER BY id DESC LIMIT 10`,
          args: [...tAliases, t.fullName]
        });
        tokens.push(...(tPushRows?.rows || []).map(r => r.token || r[0]).filter(Boolean));
      }
    }

    // 5. Active Student Sessions fallback
    if (tokens.length === 0 && receiverRole !== 'teacher') {
      const sessRes = await db.execute({
        sql: `SELECT admission_no, phone, student_name FROM app_student_sessions 
              WHERE admission_no IN (${placeholders}) OR phone = ? OR student_name = ? OR UPPER(student_name) = UPPER(?) LIMIT 5`,
        args: [...aliasArr, cleanId, cleanName, cleanName]
      });
      for (const sess of (sessRes?.rows || [])) {
        const sessAliases = [sess.admission_no, sess.phone, sess.student_name].filter(Boolean);
        const sessPlaceholders = sessAliases.map(() => '?').join(',');
        const sessPushRows = await db.execute({
          sql: `SELECT token FROM app_push_tokens WHERE admission_no IN (${sessPlaceholders}) OR student_name = ? ORDER BY id DESC LIMIT 10`,
          args: [...sessAliases, sess.student_name]
        });
        tokens.push(...(sessPushRows?.rows || []).map(r => r.token || r[0]).filter(Boolean));
      }
    }

    // Exclude caller's own push tokens to prevent caller ringing themselves
    const sCallerId = String(callerId || '').trim();
    if (sCallerId) {
      try {
        const callerClean = sCallerId.replace(/^EMP-/i, '').trim();
        const callerRows = await db.execute({
          sql: `SELECT token FROM app_push_tokens WHERE admission_no = ? OR admission_no = ? OR admission_no = ? OR student_name = ?`,
          args: [sCallerId, callerClean, `EMP-${callerClean}`, callerName || '']
        });
        const callerTokens = new Set((callerRows?.rows || []).map(r => r.token || r[0]).filter(Boolean));
        tokens = tokens.filter(t => !callerTokens.has(t));
      } catch (e) {}
    }

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
      console.log(`[Vercel VoIP] No push token found for receiver: ${sReceiverId} (${cleanName})`);
      return { ok: false, tokensCount: 0, error: 'RECIPIENT_OFFLINE' };
    }

    // Dispatch concurrently to both Native Android FCM v1 and Expo push service.
    // Client and native Kotlin both deduplicate by callId, guaranteeing <1s instant ringing.
    const fcmTokens = uniqueTokens.filter(t => !t.startsWith('ExponentPushToken')).slice(0, 2);
    const expoTokens = uniqueTokens.filter(t => t.startsWith('ExponentPushToken')).slice(0, 2);

    console.log(`[Vercel VoIP] Dispatching dual-route fast push for ${cleanName} [FCM:${fcmTokens.length}, Expo:${expoTokens.length}] callId=${callId}`);

    // 1. Direct Google Firebase FCM v1 Delivery for native Android tokens
    if (fcmTokens.length > 0) {
      try {
        const accessToken = await getFcmAccessToken();
        if (accessToken) {
          const fcmPromises = fcmTokens.map(async (token) => {
            try {
              const fcmData = {
                title: `${callerName}`,
                message: `📞 Incoming voice call`,
                body: `📞 Incoming voice call`,
                channelId: 'calls',
                categoryId: 'call_incoming',
                categoryIdentifier: 'call_incoming',
                _category: 'call_incoming',
                type: 'INCOMING_CALL',
                callId: callId,
                callerId: String(callerId || ''),
                callerName: callerName,
                callerRole: callerRole,
                callerAvatar: (callerAvatar && !callerAvatar.startsWith('data:') && callerAvatar.length < 500) ? callerAvatar : '',
                sound: 'default',
                vibrate: '[0, 800, 500, 800, 500, 800]'
              };
              if (offerSdp && typeof offerSdp === 'string' && offerSdp.length < 3200) {
                fcmData.offerSdp = offerSdp;
              }

              const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + accessToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: {
                    token: token,
                    android: {
                      priority: 'HIGH',
                      ttl: '60s'
                    },
                    data: fcmData
                  }
                })
              });
              if (fcmRes.status === 200) {
                const resBody = await fcmRes.text();
                console.log(`[FCM v1] ✅ Push SENT to ${token.substring(0, 15)}... Response: ${resBody}`);
              } else if (fcmRes.status === 404) {
                console.log(`[FCM v1] Dead token (404) -> removing ${token.substring(0, 15)}...`);
                db.execute({ sql: 'DELETE FROM app_push_tokens WHERE token = ?', args: [token] }).catch(() => {});
              } else {
                const errTxt = await fcmRes.text();
                console.log(`[FCM v1] ❌ FAILED ${fcmRes.status} for ${token.substring(0, 15)}...:`, errTxt);
              }
            } catch (e) {
              console.log('[FCM v1] Push error:', e.message);
            }
          });
          await Promise.all(fcmPromises);
        }
      } catch (e) {
        console.log('[FCM v1] Access token error:', e.message);
      }
    }

    // 2. Expo Push Service Delivery (ONLY as fallback when receiver has no native FCM token)
    if (expoTokens.length > 0) {
      const messages = expoTokens.map(token => ({
        to: token,
        sound: 'default',
        title: `${callerName}`,
        body: `📞 Incoming voice call`,
        channelId: 'calls',
        categoryId: 'call_incoming',
        categoryIdentifier: 'call_incoming',
        _category: 'call_incoming',
        priority: 'high',
        badge: 1,
        ttl: 60,
        data: {
          type: 'INCOMING_CALL',
          callId: callId,
          callerId: String(callerId || ''),
          callerName: callerName,
          callerRole: callerRole,
          callerAvatar: (callerAvatar && !callerAvatar.startsWith('data:') && callerAvatar.length < 500) ? callerAvatar : '',
          categoryId: 'call_incoming',
          categoryIdentifier: 'call_incoming',
          ...(offerSdp && typeof offerSdp === 'string' && offerSdp.length < 3200 ? { offerSdp } : {})
        },
        _displayInForeground: true
      }));

      try {
        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        const expoBody = await expoRes.text();
        console.log(`[Expo Push] Status ${expoRes.status} for ${expoTokens.length} fallback token(s): ${expoBody.substring(0, 300)}`);
      } catch (e) {}
    }
    console.log(`[Vercel VoIP] Push dispatch completed in ${Date.now() - pushStartTime}ms for callId=${callId}`);
    return { ok: true, tokensCount: uniqueTokens.length };
  } catch (err) {
    console.log(`[Vercel VoIP] Call push notification error after ${Date.now() - pushStartTime}ms:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * 1. Initiate 1-on-1 Voice Call
 * Strictly blocks student-to-student calls!
 */
async function initiateCall({ callerId, callerName, callerRole, callerAvatar, receiverId, receiverName, receiverRole, receiverAvatar, offerSdp, callId: clientCallId }) {
  if (!callerId || !receiverId) {
    return { ok: false, status: 400, error: "Missing callerId or receiverId" };
  }

  // STRICT ACCESS CONTROL POLICY: Block student to student calls ONLY
  if (isStudent(callerRole) && isStudent(receiverRole)) {
    return {
      ok: false,
      status: 403,
      error: "Calls between students are strictly disabled by school policy."
    };
  }

  const sCallerId = String(callerId);
  const sReceiverId = String(receiverId);

  // Auto-expire any previous dangling/ringing calls between these users to prevent ghost call blockers
  for (const [existingId, existingCall] of activeCallsMap.entries()) {
    if (
      existingId !== clientCallId &&
      existingCall &&
      (existingCall.status === 'ringing' || existingCall.status === 'initiating') &&
      ((existingCall.caller_id === sCallerId && existingCall.receiver_id === sReceiverId) ||
       (existingCall.caller_id === sReceiverId && existingCall.receiver_id === sCallerId))
    ) {
      existingCall.status = 'ended';
      existingCall.updated_at = new Date().toISOString();
      activeCallsMap.delete(existingId);
      db.execute({
        sql: "UPDATE app_voice_calls SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
        args: [existingId]
      }).catch(() => {});
    }
  }

  const callId = clientCallId || ("CALL_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7));
  const now = new Date().toISOString();

  let cleanCallerAvatar = callerAvatar || '';
  if (cleanCallerAvatar.length > 500) {
    cleanCallerAvatar = cleanCallerAvatar.startsWith('http') ? cleanCallerAvatar : `/api/photo/${callerRole === 'teacher' ? 'teachers' : 'students'}/${sCallerId}`;
  }
  let cleanReceiverAvatar = receiverAvatar || '';
  if (cleanReceiverAvatar.length > 500) {
    cleanReceiverAvatar = cleanReceiverAvatar.startsWith('http') ? cleanReceiverAvatar : `/api/photo/${receiverRole === 'teacher' ? 'teachers' : 'students'}/${sReceiverId}`;
  }

  const callRecord = {
    call_id: callId,
    caller_id: sCallerId,
    caller_name: callerName || 'Caller',
    caller_role: callerRole || 'student',
    caller_avatar: cleanCallerAvatar,
    receiver_id: sReceiverId,
    receiver_name: receiverName || 'Receiver',
    receiver_role: receiverRole || 'teacher',
    receiver_avatar: cleanReceiverAvatar,
    status: 'ringing',
    offer_sdp: offerSdp || null,
    answer_sdp: null,
    caller_ice: '[]',
    receiver_ice: '[]',
    duration_sec: 0,
    created_at: now,
    updated_at: now
  };

  // Cache in-memory
  activeCallsMap.set(callId, callRecord);

  // 1. Persist to Turso DB FIRST so any polling instance/receiver sees call immediately (<100ms)
  try {
    await db.execute({
      sql: `INSERT INTO app_voice_calls (
        call_id, caller_id, caller_name, caller_role, caller_avatar, 
        receiver_id, receiver_name, receiver_role, status, offer_sdp, caller_ice, receiver_ice,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        callRecord.call_id, callRecord.caller_id, callRecord.caller_name, callRecord.caller_role, callRecord.caller_avatar,
        callRecord.receiver_id, callRecord.receiver_name, callRecord.receiver_role, callRecord.status,
        callRecord.offer_sdp, callRecord.caller_ice, callRecord.receiver_ice,
        now, now
      ]
    });
  } catch (e) {
    console.error("DB voice call insert error:", e.message);
  }

  // 2. Dispatch background push notification (FCM + Expo concurrently for ultra-fast <1s ring)
  const pushRes = await sendIncomingCallPush({
    receiverId: callRecord.receiver_id,
    receiverName: callRecord.receiver_name,
    receiverRole: callRecord.receiver_role,
    callerId: callRecord.caller_id,
    callerName: callRecord.caller_name,
    callerRole: callRecord.caller_role,
    callerAvatar: callRecord.caller_avatar,
    callId: callRecord.call_id,
    offerSdp: offerSdp || null
  }).catch(err => {
    console.warn("sendIncomingCallPush async error:", err.message);
    return null;
  });

  if (pushRes && pushRes.tokensCount === 0) {
    activeCallsMap.delete(callId);
    db.execute({
      sql: "UPDATE app_voice_calls SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
      args: [callId]
    }).catch(() => {});
    return {
      ok: false,
      status: 200,
      error: "RECIPIENT_OFFLINE",
      message: `${receiverName || 'Recipient'} is currently offline or app is not installed.`
    };
  }

  return { ok: true, callId, call: callRecord };
}

/**
 * 2. Respond to 1-on-1 Call (Accept / Decline / Busy)
 */
async function respondCall({ callId, userId, action, answerSdp }) {
  if (!callId || !action) return { ok: false, status: 400, error: "Missing callId or action" };

  let call = null;
  try {
    const res = await db.execute({
      sql: "SELECT * FROM app_voice_calls WHERE call_id = ? LIMIT 1",
      args: [callId],
      skipCache: true
    });
    if (res.rows && res.rows.length > 0) call = res.rows[0];
  } catch (e) {}

  if (!call) call = activeCallsMap.get(callId);
  if (!call) return { ok: false, status: 404, error: "Call not found" };

  // If call has already ended, do not modify
  if (call.status === 'ended') {
    return { ok: true, call, ignored: true };
  }

  // If call is already connected or has answer_sdp, ignore any late decline requests
  if ((call.status === 'connected' || call.answer_sdp) && (action === 'decline' || action === 'busy')) {
    console.log(`[Vercel/Node VoIP] Ignoring late ${action} for already connected call ${callId}`);
    return { ok: true, call, ignored: true };
  }

  const now = new Date().toISOString();
  let status = call.status;
  if (action === 'accept') {
    status = 'connected';
  } else if (action === 'decline') {
    status = 'declined';
  } else if (action === 'busy') {
    status = 'busy';
  }

  const ans = answerSdp || call.answer_sdp || null;

  try {
    await db.execute({
      sql: "UPDATE app_voice_calls SET status = ?, answer_sdp = COALESCE(?, answer_sdp), updated_at = ? WHERE call_id = ?",
      args: [status, ans, now, callId]
    });
  } catch (e) {}

  call.status = status;
  if (ans) call.answer_sdp = ans;
  call.updated_at = now;
  activeCallsMap.set(callId, call);

  // Broadcast CALL_ENDED push immediately when call is declined or busy so caller stops ringing
  if (action === 'decline' || action === 'busy') {
    sendCallEndedPush({
      receiverId: call.receiver_id,
      receiverName: call.receiver_name,
      callerId: call.caller_id,
      callerName: call.caller_name,
      callId: callId
    }).catch(() => {});
  }

  return { ok: true, call };
}

// ── In-Memory Accumulated ICE Candidates Map (Prevents Race-Condition Overwrites) ──
const callCandidatesStore = new Map(); // call_id -> { caller: Map<string, object>, receiver: Map<string, object> }

/**
 * 3. Send WebRTC Signal (Offer / Answer / ICE Candidates)
 */
async function sendCallSignal({ callId, senderId, offerSdp, answerSdp, iceCandidate, iceCandidates, isCaller }) {
  if (!callId) return { ok: false, status: 400, error: "Missing callId" };

  let call = null;
  try {
    const res = await db.execute({
      sql: "SELECT * FROM app_voice_calls WHERE call_id = ? LIMIT 1",
      args: [callId],
      skipCache: true
    });
    if (res.rows && res.rows.length > 0) call = res.rows[0];
  } catch (e) {}

  if (!call) call = activeCallsMap.get(callId);
  if (!call) return { ok: false, status: 404, error: "Call not found" };

  let updatedOffer = offerSdp || call.offer_sdp || null;
  let updatedAnswer = answerSdp || call.answer_sdp || null;

  // Initialize or retrieve in-memory candidate store
  if (!callCandidatesStore.has(callId)) {
    callCandidatesStore.set(callId, {
      caller: new Map(),
      receiver: new Map()
    });
  }
  const store = callCandidatesStore.get(callId);

  // Hydrate store from existing DB record if in-memory set is empty
  if (store.caller.size === 0 && call.caller_ice) {
    try {
      const parsed = typeof call.caller_ice === 'string' ? JSON.parse(call.caller_ice) : call.caller_ice;
      if (Array.isArray(parsed)) {
        parsed.forEach(c => {
          if (c?.candidate) store.caller.set(c.candidate, c);
        });
      }
    } catch (e) {}
  }
  if (store.receiver.size === 0 && call.receiver_ice) {
    try {
      const parsed = typeof call.receiver_ice === 'string' ? JSON.parse(call.receiver_ice) : call.receiver_ice;
      if (Array.isArray(parsed)) {
        parsed.forEach(c => {
          if (c?.candidate) store.receiver.set(c.candidate, c);
        });
      }
    } catch (e) {}
  }

  // Ingest incoming candidate(s)
  const incomingList = [];
  if (Array.isArray(iceCandidates)) incomingList.push(...iceCandidates);
  if (iceCandidate) incomingList.push(iceCandidate);

  if (incomingList.length > 0) {
    const targetMap = isCaller ? store.caller : store.receiver;
    for (const cand of incomingList) {
      if (!cand) continue;
      let candObj = cand;
      if (typeof candObj === 'string') {
        try { candObj = JSON.parse(candObj); } catch (e) {}
      }
      const key = candObj?.candidate || (typeof candObj === 'string' ? candObj : JSON.stringify(candObj));
      if (key) {
        targetMap.set(key, candObj);
      }
    }
  }

  const callerIceStr = JSON.stringify(Array.from(store.caller.values()));
  const receiverIceStr = JSON.stringify(Array.from(store.receiver.values()));
  const now = new Date().toISOString();

  try {
    await db.execute({
      sql: `UPDATE app_voice_calls SET 
        offer_sdp = COALESCE(?, offer_sdp), 
        answer_sdp = COALESCE(?, answer_sdp), 
        caller_ice = ?, 
        receiver_ice = ?, 
        updated_at = ? 
        WHERE call_id = ?`,
      args: [updatedOffer, updatedAnswer, callerIceStr, receiverIceStr, now, callId]
    });
  } catch (e) {}

  call.offer_sdp = updatedOffer;
  call.answer_sdp = updatedAnswer;
  call.caller_ice = callerIceStr;
  call.receiver_ice = receiverIceStr;
  call.updated_at = now;
  activeCallsMap.set(callId, call);

  return { ok: true, call };
}

async function sendCallEndedPush({ receiverId, receiverName, callerId, callerName, callId }) {
  try {
    const targetIds = [receiverId, callerId].filter(Boolean).map(id => String(id).trim());
    const aliasArr = [];
    targetIds.forEach(id => {
      aliasArr.push(id);
      aliasArr.push(id.replace('EMP-', ''));
      if (!id.startsWith('EMP-')) aliasArr.push(`EMP-${id}`);
    });
    const uniqueAliases = [...new Set(aliasArr)];
    if (uniqueAliases.length === 0) return;

    const placeholders = uniqueAliases.map(() => '?').join(',');
    const tokens = [];

    // 1. App push tokens by alias
    try {
      const directRes = await db.execute({
        sql: `SELECT token FROM app_push_tokens WHERE admission_no IN (${placeholders}) ORDER BY id DESC LIMIT 20`,
        args: uniqueAliases
      });
      tokens.push(...(directRes?.rows || []).map(r => r[0] || r.token).filter(Boolean));
    } catch(e) {}

    // 2. Also search by names
    const names = [receiverName, callerName].filter(Boolean);
    for (const name of names) {
      try {
        const nameRes = await db.execute({
          sql: `SELECT token FROM app_push_tokens WHERE student_name = ? OR UPPER(student_name) = UPPER(?) ORDER BY id DESC LIMIT 10`,
          args: [name, name]
        });
        tokens.push(...(nameRes?.rows || []).map(r => r[0] || r.token).filter(Boolean));
      } catch(e) {}
    }

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) return;

    // 1. Direct FCM v1 push delivery
    const fcmTokens = uniqueTokens.filter(t => !t.startsWith('ExponentPushToken'));
    if (fcmTokens.length > 0) {
      try {
        const accessToken = await getFcmAccessToken();
        if (accessToken) {
          const endPromises = fcmTokens.map(async (token) => {
            try {
              await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + accessToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: {
                    token: token,
                    android: {
                      priority: 'HIGH',
                      ttl: '15s'
                    },
                    data: {
                      type: 'CALL_ENDED',
                      callId: String(callId)
                    }
                  }
                })
              });
            } catch (e) {}
          });
          await Promise.all(endPromises);
        }
      } catch (e) {}
    }

    // 2. Expo Push Service Delivery
    const expoTokens = uniqueTokens.filter(t => t.startsWith('ExponentPushToken'));
    if (expoTokens.length > 0) {
      try {
        const expoMessages = expoTokens.map(token => ({
          to: token,
          priority: 'high',
          data: {
            type: 'CALL_ENDED',
            callId: String(callId)
          }
        }));
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(expoMessages),
        });
      } catch (e) {}
    }
  } catch (err) {
    console.log('[Vercel VoIP] sendCallEndedPush error:', err.message);
  }
}

/**
 * 4. End 1-on-1 Voice Call
 */
async function endCall({ callId, durationSec = 0 }) {
  if (!callId) return { ok: false, status: 400, error: "Missing callId" };

  let call = activeCallsMap.get(callId);
  if (!call) {
    try {
      const dbRes = await db.execute({
        sql: "SELECT * FROM app_voice_calls WHERE call_id = ? LIMIT 1",
        args: [callId],
        skipCache: true
      });
      if (dbRes?.rows?.length > 0) {
        call = dbRes.rows[0];
      }
    } catch(e) {}
  }

  if (call) {
    call.status = 'ended';
    call.duration_sec = durationSec || call.duration_sec || 0;
    call.updated_at = new Date().toISOString();
  }

  // Always broadcast CALL_ENDED push so background ringtones stop instantly
  if (call?.receiver_id || call?.caller_id) {
    await sendCallEndedPush({
      receiverId: call?.receiver_id,
      receiverName: call?.receiver_name,
      callerId: call?.caller_id,
      callerName: call?.caller_name,
      callId: callId
    }).catch(() => {});
  }

  try {
    await db.execute({
      sql: "UPDATE app_voice_calls SET status = 'ended', duration_sec = ?, updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
      args: [durationSec || 0, callId]
    });
  } catch (e) {}

  setTimeout(() => activeCallsMap.delete(callId), 15000);

  return { ok: true, message: "Call ended successfully" };
}

/**
 * 5. Poll Calls for User (Incoming call notification & active status)
 */
async function pollUserCalls({ userId, userRole, className, admissionNo, phone, fullName, employeeNo, empNo, activeCallId }) {
  if (!userId && !admissionNo && !phone && !employeeNo && !empNo && !activeCallId) return { ok: false, status: 400, error: "Missing userId" };

  const sUserId = String(userId || '').trim();
  const sAdm = String(admissionNo || '').trim();
  const sPhone = String(phone || '').trim();
  const sActiveCallId = String(activeCallId || '').trim();
  const sFullName = String(fullName || '').trim();
  const sEmpNo = String(employeeNo || empNo || '').replace(/^EMP-/i, '').trim();

  const isUserTeacher = isTeacherOrStaff(userRole);
  const isUserStudent = isStudent(userRole) || (!isUserTeacher && !sUserId.startsWith('EMP-'));

  const possibleIds = new Set([
    sUserId,
    sAdm,
    sPhone,
    sUserId.replace('EMP-', ''),
    `EMP-${sUserId.replace('EMP-', '')}`,
    sAdm.replace('EMP-', ''),
    `EMP-${sAdm.replace('EMP-', '')}`,
    sEmpNo,
    `EMP-${sEmpNo}`
  ].filter(Boolean));

  // Expand teacher and student aliases STRICTLY by role to prevent shared phone number collisions
  const rawId = sUserId.replace('EMP-', '').trim();
  const aliasCacheKey = `${isUserTeacher ? 'T' : 'S'}_${rawId}_${sAdm}_${sPhone}_${sFullName}`;
  const cachedAliasEntry = userAliasesCache.get(aliasCacheKey);

  if (cachedAliasEntry && Date.now() < cachedAliasEntry.expiresAt) {
    cachedAliasEntry.aliases.forEach(id => possibleIds.add(id));
  } else {
    const fetchedAliases = [];
    if (isUserTeacher) {
      // Only expand teacher aliases for teacher users!
      try {
        const tLookup = await db.execute({
          sql: `SELECT id, employeeNo, phone, fullName FROM teachers 
                WHERE id = ? OR employeeNo = ? OR ('EMP-' || employeeNo) = ? OR ('EMP-' || id) = ? OR phone = ? OR fullName = ? LIMIT 1`,
          args: [rawId, rawId, sUserId, sUserId, sPhone || rawId, sFullName || '']
        });
        const tRow = tLookup?.rows?.[0];
        if (tRow) {
          const tId = String(tRow.id || '');
          const tEmpNo = String(tRow.employeeNo || '');
          const tPhone = String(tRow.phone || '');
          const tName = String(tRow.fullName || '');
          [tId, `EMP-${tId}`, tEmpNo, `EMP-${tEmpNo}`, tPhone, tName].filter(Boolean).forEach(id => {
            possibleIds.add(id);
            fetchedAliases.push(id);
          });
        }
      } catch(e) {}
    } else {
      // Only expand student aliases for student users!
      try {
        const sLookup = await db.execute({
          sql: `SELECT id, admissionNo, phone, fullName FROM students 
                WHERE admissionNo = ? OR CAST(id AS TEXT) = ? OR phone = ? LIMIT 1`,
          args: [sAdm || rawId, rawId, sPhone || rawId]
        });
        const sRow = sLookup?.rows?.[0];
        if (sRow) {
          const sId = String(sRow.id || '');
          const sAdmNo = String(sRow.admissionNo || '');
          const sPh = String(sRow.phone || '');
          const sName = String(sRow.fullName || '');
          [sId, sAdmNo, sPh, sName].filter(Boolean).forEach(id => {
            possibleIds.add(id);
            fetchedAliases.push(id);
          });
        }
      } catch(e) {}
    }
    userAliasesCache.set(aliasCacheKey, {
      aliases: fetchedAliases,
      expiresAt: Date.now() + ALIAS_CACHE_TTL
    });
  }

  let incomingCall = null;
  let activeCall = null;
  const nowMs = Date.now();

  // 1. Look in RAM Cache First
  for (const call of activeCallsMap.values()) {
    const recId = String(call.receiver_id || '').trim();
    const callerId = String(call.caller_id || '').trim();

    let isReceiver = possibleIds.has(recId);
    if (!isReceiver && call.receiver_name && sFullName && String(call.receiver_name).trim().toLowerCase() === sFullName.toLowerCase()) {
      isReceiver = true;
    }

    // Role-aware caller identification (teacher calling student is NEVER a self-call)
    let isCaller = false;
    if (isUserTeacher && call.caller_role === 'teacher') {
      isCaller = possibleIds.has(callerId);
    } else if (isUserStudent && call.caller_role === 'student') {
      isCaller = possibleIds.has(callerId);
    } else if (!userRole) {
      isCaller = possibleIds.has(callerId) && !isReceiver;
    }

    let ageMs = 0;
    if (call.created_at) {
      ageMs = nowMs - parseUtcDate(call.created_at);
    }

    // Incoming call: strictly receiver only, ringing status, age < 40s, not self
    if (isReceiver && !isCaller && call.status === 'ringing' && ageMs < 40000 && !incomingCall) {
      incomingCall = call;
    }

    // Active call:
    if (sActiveCallId && call.call_id === sActiveCallId) {
      activeCall = call;
    } else if (!sActiveCallId && (isCaller || isReceiver)) {
      if ((call.status === 'connected' || call.status === 'ringing') && ageMs < 120000 && !activeCall) {
        activeCall = call;
      }
    }
  }

  // 2. Query Turso DB if activeCallId requested (refresh from DB if not in RAM or still ringing or missing answer)
  if (sActiveCallId && (!activeCall || activeCall.status === 'ringing' || !activeCall.answer_sdp)) {
    try {
      const res = await db.execute({
        sql: `SELECT * FROM app_voice_calls WHERE call_id = ? LIMIT 1`,
        args: [sActiveCallId],
        skipCache: true
      });
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        activeCallsMap.set(row.call_id, row);
        activeCall = row;
      }
    } catch (e) {}
  }

  // 3. Fallback DB lookup for ringing incoming calls if none in RAM
  if (!incomingCall && !activeCall && !sActiveCallId) {
    try {
      const idArray = Array.from(possibleIds);
      const placeholders = idArray.map(() => '?').join(',');
      const res = await db.execute({
        sql: `SELECT * FROM app_voice_calls 
              WHERE (receiver_id IN (${placeholders}) OR receiver_name = ?)
                AND status = 'ringing'
              ORDER BY id DESC LIMIT 1`,
        args: [...idArray, sFullName || ''],
        skipCache: true
      });

      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        const callAge = nowMs - parseUtcDate(row.created_at || row.updated_at || Date.now());
        const isSelfCall = (isUserTeacher && row.caller_role === 'teacher' && possibleIds.has(String(row.caller_id))) ||
                           (isUserStudent && row.caller_role === 'student' && possibleIds.has(String(row.caller_id)));
        if (callAge < 40000 && !isSelfCall) {
          activeCallsMap.set(row.call_id, row);
          incomingCall = row;
          activeCall = row;
        }
      }
    } catch (e) {}
  }

  // 4. Check if there is an active class voice room (Auto-expire abandoned rooms > 30 mins, throttled to 5m)
  let activeClassRoom = null;
  if (className || userRole) {
    const nowEpoch = Date.now();
    if (nowEpoch - lastRoomCleanupAt > 300000) {
      lastRoomCleanupAt = nowEpoch;
      try {
        await db.execute({
          sql: "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE status = 'active' AND (unixepoch('now') - unixepoch(created_at)) > 14400",
          skipCache: true
        });
      } catch(e) {}
    }

    if (nowEpoch - lastCallCleanupAt > 3600000) {
      lastCallCleanupAt = nowEpoch;
      cleanupCallLogs().catch(() => {});
    }

    const eqClasses = getEquivalentClasses(className);

    for (const room of activeRoomsMap.values()) {
      if (room.status === 'active') {
        const roomAgeMs = room.created_at ? (Date.now() - parseUtcDate(room.created_at)) : 0;
        if (roomAgeMs < 14400000) {
          const matchesClass = room.target_type === 'all' || 
                               room.target_class === 'ALL' || 
                               room.target_class === 'All Classes' || 
                               (room.target_type === 'class' && (eqClasses.includes(room.target_class) || room.target_class === className));
          if (matchesClass) {
            activeClassRoom = room;
            break;
          }
          if (room.target_type === 'staff' && isTeacherOrStaff(userRole)) {
            activeClassRoom = room;
            break;
          }
          if (userRole === 'administrator' || userRole === 'principal') {
            activeClassRoom = room;
            break;
          }
        }
      }
    }

    if (!activeClassRoom) {
      try {
        let candidateRooms = [];
        const nowMs = Date.now();
        if (nowMs - activeRoomsDbCache.lastChecked < ROOM_CACHE_TTL) {
          candidateRooms = activeRoomsDbCache.rooms;
        } else {
          const roomRes = await db.execute({
            sql: "SELECT * FROM app_voice_rooms WHERE status = 'active' AND ended_at IS NULL AND (unixepoch('now') - unixepoch(created_at)) < 14400 ORDER BY id DESC LIMIT 5",
            skipCache: true
          });
          candidateRooms = roomRes?.rows || [];
          activeRoomsDbCache = { lastChecked: nowMs, rooms: candidateRooms };
        }

        for (const rawR of candidateRooms) {
          const r = { ...rawR };
          r.participants = typeof r.participants === 'string' ? JSON.parse(r.participants || '[]') : r.participants;
          if (Array.isArray(r.participants) && r.participants.length > 0) {
            const matchesClass = r.target_type === 'all' || 
                                 r.target_class === 'ALL' || 
                                 r.target_class === 'All Classes' || 
                                 (r.target_type === 'class' && (eqClasses.includes(r.target_class) || r.target_class === className));
            if (matchesClass || (r.target_type === 'staff' && isTeacherOrStaff(userRole)) || (userRole === 'administrator' || userRole === 'principal')) {
              activeClassRoom = r;
              break;
            }
          }
        }
      } catch (e) {}
    }
  }

  // Ensure activeCall has all in-memory accumulated candidates
  if (activeCall && callCandidatesStore.has(activeCall.call_id)) {
    const store = callCandidatesStore.get(activeCall.call_id);
    if (store.caller.size > 0) {
      activeCall.caller_ice = JSON.stringify(Array.from(store.caller.values()));
    }
    if (store.receiver.size > 0) {
      activeCall.receiver_ice = JSON.stringify(Array.from(store.receiver.values()));
    }
  }

  // Sanitize active class room participants for non-admin callers so stealth admins are 100% hidden
  let sanitizedActiveClassRoom = activeClassRoom;
  if (activeClassRoom && Array.isArray(activeClassRoom.participants)) {
    const isAdminCaller = userRole === 'administrator' || userRole === 'principal' || String(userId || '').toLowerCase().includes('admin');
    if (!isAdminCaller) {
      sanitizedActiveClassRoom = {
        ...activeClassRoom,
        participants: activeClassRoom.participants.filter(p => !p.isStealth && !p.isHidden)
      };
    }
  }

  return {
    ok: true,
    incomingCall,
    activeCall,
    activeGroupRoom: sanitizedActiveClassRoom
  };
}

// ─────────────────────────────────────────────────────────────
// ── MULTI-PARTICIPANT GROUP VOICE CALLS (CLASS & STAFF ROOMS)
// ─────────────────────────────────────────────────────────────

/**
 * 6. Create Group Room (Must be hosted by a Teacher/Admin)
 */
async function createGroupRoom({ hostId, hostName, hostRole, title, targetType = 'class', targetClass = '' }) {
  if (!hostId || !hostName) {
    return { ok: false, status: 400, error: "Missing host details" };
  }

  // STRICT POLICY: Only teachers/staff/admin can create group rooms!
  if (!isTeacherOrStaff(hostRole)) {
    return {
      ok: false,
      status: 403,
      error: "Only teachers and administrators can host group voice calls."
    };
  }

  const sHostId = String(hostId);
  const rawHostId = sHostId.replace('EMP-', '');
  const normTargetClass = (targetClass === 'ALL' || !targetClass || targetClass === 'All Classes') ? 'ALL' : normalizeCanonicalClass(targetClass);

  // Auto-close any previous active rooms by this host
  try {
    await db.execute({
      sql: "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE status = 'active' AND (host_id = ? OR host_id = ?)",
      args: [sHostId, rawHostId]
    });
  } catch(e) {}

  for (const [rId, rObj] of activeRoomsMap.entries()) {
    if (rObj.status === 'active' && (String(rObj.host_id) === sHostId || String(rObj.host_id).replace('EMP-', '') === rawHostId)) {
      rObj.status = 'ended';
      activeRoomsMap.delete(rId);
      groupSignalsMap.delete(rId);
    }
  }

  const roomId = "ROOM_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  const initialParticipants = [
    {
      id: sHostId,
      name: hostName,
      role: hostRole,
      isHost: true,
      isMuted: false,
      handRaised: false,
      joinedAt: now
    }
  ];

  const roomObj = {
    room_id: roomId,
    title: title || ((normTargetClass || 'School') + ' Voice Session'),
    host_id: sHostId,
    host_name: hostName,
    host_role: hostRole,
    target_type: normTargetClass === 'ALL' ? 'all' : targetType,
    target_class: normTargetClass,
    status: 'active',
    participants: initialParticipants,
    created_at: now
  };

  activeRoomsMap.set(roomId, roomObj);
  groupSignalsMap.set(roomId, []);

  try {
    await db.execute({
      sql: `INSERT INTO app_voice_rooms (
        room_id, title, host_id, host_name, host_role, target_type, target_class, status, participants
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      args: [roomId, roomObj.title, roomObj.host_id, roomObj.host_name, roomObj.host_role, roomObj.target_type, roomObj.target_class, JSON.stringify(initialParticipants)],
      skipCache: true
    });
  } catch (err) {
    console.error("Database group room insert error:", err.message);
  }

  return { ok: true, roomId, room: roomObj };
}

/**
 * 7. Join Group Room
 */
async function joinGroupRoom({ roomId, participantId, participantName, participantRole, participantAvatar, isMuted, isStealth, isHidden }) {
  if (!roomId || !participantId) return { ok: false, status: 400, error: "Missing roomId or participantId" };

  let room = activeRoomsMap.get(roomId);
  if (!room) {
    try {
      const res = await db.execute({
        sql: "SELECT * FROM app_voice_rooms WHERE room_id = ? AND status = 'active' LIMIT 1",
        args: [roomId]
      });
      if (res.rows.length > 0) {
        room = res.rows[0];
        room.participants = typeof room.participants === 'string' ? JSON.parse(room.participants || '[]') : room.participants;
      }
    } catch (e) {}
  }

  if (!room || room.status !== 'active') {
    return { ok: false, status: 404, error: "Active group voice session not found." };
  }

  const sPartId = String(participantId);
  const isStudentUser = !isTeacherOrStaff(participantRole);
  const isStealthMode = Boolean(isStealth || isHidden);
  const initialMuted = isStealthMode ? true : ((typeof isMuted === 'boolean') ? isMuted : isStudentUser);

  const existingIndex = (room.participants || []).findIndex(p => String(p.id) === sPartId || String(p.id).replace('EMP-', '') === sPartId.replace('EMP-', ''));
  if (existingIndex === -1) {
    room.participants.push({
      id: sPartId,
      name: participantName || (isStealthMode ? 'Observer' : (isStudentUser ? 'Student' : 'Faculty')),
      role: participantRole || (isStudentUser ? 'student' : 'teacher'),
      avatar: participantAvatar || '',
      isHost: String(room.host_id) === sPartId || String(room.host_id).replace('EMP-', '') === sPartId.replace('EMP-', ''),
      isMuted: initialMuted,
      isStealth: isStealthMode,
      isHidden: isStealthMode,
      handRaised: false,
      joinedAt: new Date().toISOString()
    });
  } else {
    room.participants[existingIndex] = {
      ...room.participants[existingIndex],
      name: participantName || room.participants[existingIndex].name,
      role: participantRole || room.participants[existingIndex].role,
      avatar: participantAvatar || room.participants[existingIndex].avatar,
      isMuted: initialMuted,
      isStealth: isStealthMode || Boolean(room.participants[existingIndex].isStealth),
      isHidden: isStealthMode || Boolean(room.participants[existingIndex].isHidden)
    };
  }

  activeRoomsMap.set(roomId, room);

  try {
    await db.execute({
      sql: "UPDATE app_voice_rooms SET participants = ? WHERE room_id = ?",
      args: [JSON.stringify(room.participants), roomId]
    });
  } catch (e) {}

  return { ok: true, room };
}

/**
 * 8. Leave Group Room
 */
async function leaveGroupRoom({ roomId, participantId }) {
  if (!roomId || !participantId) return { ok: false, status: 400, error: "Missing details" };

  const sPartId = String(participantId);
  const rawPartId = sPartId.replace('EMP-', '');

  let room = activeRoomsMap.get(roomId);
  if (!room) {
    try {
      const res = await db.execute({
        sql: "SELECT * FROM app_voice_rooms WHERE room_id = ? LIMIT 1",
        args: [roomId]
      });
      if (res.rows.length > 0) {
        room = res.rows[0];
        room.participants = typeof room.participants === 'string' ? JSON.parse(room.participants || '[]') : room.participants;
      }
    } catch (e) {}
  }

  if (room) {
    room.participants = (room.participants || []).filter(p => String(p.id) !== sPartId && String(p.id).replace('EMP-', '') !== rawPartId);
    
    const isHostLeaving = String(room.host_id) === sPartId || 
                          String(room.host_id).replace('EMP-', '') === rawPartId;

    if (isHostLeaving || room.participants.length === 0) {
      room.status = 'ended';
      activeRoomsMap.delete(roomId);
      groupSignalsMap.delete(roomId);
      try {
        await db.execute({
          sql: "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE room_id = ?",
          args: [roomId]
        });
        await db.execute({
          sql: "DELETE FROM app_voice_signals WHERE room_id = ?",
          args: [roomId]
        });
      } catch (e) {}
    } else {
      activeRoomsMap.set(roomId, room);
      try {
        await db.execute({
          sql: "UPDATE app_voice_rooms SET participants = ? WHERE room_id = ?",
          args: [JSON.stringify(room.participants), roomId]
        });
      } catch (e) {}
    }
  } else {
    // If room wasn't found in memory, ensure DB record is ended
    try {
      await db.execute({
        sql: "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE room_id = ?",
        args: [roomId]
      });
      await db.execute({
        sql: "DELETE FROM app_voice_signals WHERE room_id = ?",
        args: [roomId]
      });
    } catch(e) {}
  }

  return { ok: true };
}

/**
 * 9. Host Ends Group Room for Everyone
 */
async function endGroupRoom({ roomId, hostId }) {
  const sHostId = hostId ? String(hostId).replace('EMP-', '') : null;
  
  if (roomId) {
    let room = activeRoomsMap.get(roomId);
    if (room) room.status = 'ended';
    activeRoomsMap.delete(roomId);
    groupSignalsMap.delete(roomId);
  }

  // Also clean out any active rooms by this host in activeRoomsMap
  if (sHostId) {
    for (const [rId, rObj] of activeRoomsMap.entries()) {
      if (String(rObj.host_id).replace('EMP-', '') === sHostId) {
        rObj.status = 'ended';
        activeRoomsMap.delete(rId);
        groupSignalsMap.delete(rId);
      }
    }
  }

  try {
    const sql = (roomId && sHostId)
      ? "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE room_id = ? OR host_id = ? OR host_id = ?"
      : (roomId ? "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE room_id = ?" : "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE host_id = ? OR host_id = ?");
    const args = (roomId && sHostId)
      ? [roomId, sHostId, `EMP-${sHostId}`]
      : (roomId ? [roomId] : [sHostId, `EMP-${sHostId}`]);
    await db.execute({ sql, args, skipCache: true });

    if (roomId) {
      await db.execute({
        sql: "DELETE FROM app_voice_signals WHERE room_id = ?",
        args: [roomId],
        skipCache: true
      });
    }
  } catch (e) {}

  return { ok: true, message: "Group voice room ended" };
}

/**
 * 10. Send Signal in Group Room (Mesh WebRTC / Moderation / State)
 */
async function sendGroupSignal({ roomId, fromId, toId, signalType, signalData }) {
  if (!roomId || !fromId) return { ok: false, status: 400, error: "Missing signal data" };

  const sFromId = String(fromId).replace('EMP-', '');

  let room = activeRoomsMap.get(roomId);
  if (!room) {
    try {
      const res = await db.execute({
        sql: "SELECT * FROM app_voice_rooms WHERE room_id = ? LIMIT 1",
        args: [roomId],
        skipCache: true
      });
      if (res.rows && res.rows.length > 0) {
        room = res.rows[0];
        room.participants = typeof room.participants === 'string' ? JSON.parse(room.participants || '[]') : room.participants;
      }
    } catch (e) {}
  }

  // Update room state based on signal
  if (room && Array.isArray(room.participants)) {
    if (signalType === 'MUTE_ALL') {
      room.participants.forEach(p => {
        if (!p.isHost && p.role !== 'teacher') {
          p.isMuted = true;
        }
      });
      activeRoomsMap.set(roomId, room);
      try {
        await db.execute({
          sql: "UPDATE app_voice_rooms SET participants = ? WHERE room_id = ?",
          args: [JSON.stringify(room.participants), roomId]
        });
      } catch (e) {}
    } else if (signalType === 'HAND_RAISE') {
      const p = room.participants.find(p => String(p.id).replace('EMP-', '') === sFromId);
      if (p) {
        p.handRaised = Boolean(signalData?.handRaised);
        activeRoomsMap.set(roomId, room);
        try {
          await db.execute({
            sql: "UPDATE app_voice_rooms SET participants = ? WHERE room_id = ?",
            args: [JSON.stringify(room.participants), roomId]
          });
        } catch (e) {}
      }
    } else if (signalType === 'MUTE_TOGGLE') {
      const p = room.participants.find(p => String(p.id).replace('EMP-', '') === sFromId);
      if (p) {
        p.isMuted = Boolean(signalData?.isMuted);
        activeRoomsMap.set(roomId, room);
        try {
          await db.execute({
            sql: "UPDATE app_voice_rooms SET participants = ? WHERE room_id = ?",
            args: [JSON.stringify(room.participants), roomId]
          });
        } catch (e) {}
      }
    } else if (signalType === 'ROOM_ENDED') {
      room.status = 'ended';
      activeRoomsMap.delete(roomId);
      groupSignalsMap.delete(roomId);
      try {
        await db.execute({
          sql: "UPDATE app_voice_rooms SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE room_id = ?",
          args: [roomId]
        });
        await db.execute({
          sql: "DELETE FROM app_voice_signals WHERE room_id = ?",
          args: [roomId]
        });
      } catch (e) {}
    }
  }

  const sDataStr = typeof signalData === 'string' ? signalData : JSON.stringify(signalData || {});
  const nowTs = Date.now();

  // 1. Turso Cloud persistence for zero-loss serverless WebRTC negotiation
  let insertId = null;
  try {
    const res = await db.execute({
      sql: "INSERT INTO app_voice_signals (room_id, from_id, to_id, signal_type, signal_data) VALUES (?, ?, ?, ?, ?)",
      args: [roomId, String(fromId), toId ? String(toId) : null, signalType, sDataStr],
      skipCache: true
    });
    insertId = res?.lastInsertRowid || res?.lastInsertId || null;
  } catch (dbErr) {
    console.warn("Turso app_voice_signals insert warning:", dbErr?.message || dbErr);
  }

  // 2. In-memory buffer for fast local instance relay (never assign timestamp to id!)
  let signals = groupSignalsMap.get(roomId) || [];
  const signalObj = {
    id: insertId ? Number(insertId) : undefined,
    roomId,
    fromId: String(fromId),
    toId: toId ? String(toId) : null,
    signalType,
    signalData,
    createdAt: nowTs
  };
  signals.push(signalObj);
  if (signals.length > 100) signals = signals.slice(-100);
  groupSignalsMap.set(roomId, signals);

  return { ok: true, id: insertId };
}

/**
 * 11. Poll Signals in Group Room
 */
async function pollGroupRoom({ roomId, participantId, userId, since = 0, sinceId = 0 }) {
  const effPartId = participantId || userId;
  if (!roomId || !effPartId) return { ok: false, status: 400, error: "Missing poll parameters" };

  const sPartId = String(effPartId);
  const rawPartId = sPartId.replace('EMP-', '');
  const rawSinceId = Number(sinceId) || 0;
  // Guard against any millisecond timestamp polluting sinceId
  const numSinceId = (rawSinceId > 0 && rawSinceId < 1000000000) ? rawSinceId : 0;
  const numSince = Number(since) || 0;
  let room = null;

  try {
    const res = await db.execute({
      sql: "SELECT * FROM app_voice_rooms WHERE room_id = ? LIMIT 1",
      args: [roomId],
      skipCache: true
    });
    if (res.rows && res.rows.length > 0) {
      room = res.rows[0];
      room.participants = typeof room.participants === 'string' ? JSON.parse(room.participants || '[]') : room.participants;
      if (room.status === 'active') {
        activeRoomsMap.set(roomId, room);
      } else {
        activeRoomsMap.delete(roomId);
      }
    }
  } catch(e) {}

  if (!room) {
    room = activeRoomsMap.get(roomId);
  }

  // 1. Check in-memory signals
  const allSignals = groupSignalsMap.get(roomId) || [];
  const relevantMemSignals = allSignals.filter(s => {
    const sFromId = String(s.fromId || '').replace('EMP-', '');
    const notFromSelf = sFromId !== rawPartId;
    const forMe = !s.toId || s.toId === 'ALL' || s.toId === 'all' || s.toId === sPartId || s.toId === `EMP-${rawPartId}` || s.toId === rawPartId || s.toId === '';
    const fresh = (numSinceId > 0 && s.id) ? (Number(s.id) > numSinceId) : (s.createdAt > (numSince || (Date.now() - 30000)));
    return notFromSelf && forMe && fresh;
  });

  // 2. Fetch signals from Turso DB to guarantee zero-loss across serverless instances
  let relevantDbSignals = [];
  try {
    const isIdQuery = numSinceId > 0;
    const sql = isIdQuery
      ? `SELECT id, room_id, from_id, to_id, signal_type, signal_data,
            CAST(unixepoch(created_at) AS INTEGER) * 1000 AS created_ts
            FROM app_voice_signals
            WHERE room_id = ?
              AND from_id != ? AND from_id != ?
              AND (to_id IS NULL OR to_id = 'ALL' OR to_id = 'all' OR to_id = ? OR to_id = ? OR to_id = ? OR to_id = '')
              AND id > ?
            ORDER BY id ASC LIMIT 50`
      : `SELECT id, room_id, from_id, to_id, signal_type, signal_data,
            CAST(unixepoch(created_at) AS INTEGER) * 1000 AS created_ts
            FROM app_voice_signals
            WHERE room_id = ?
              AND from_id != ? AND from_id != ?
              AND (to_id IS NULL OR to_id = 'ALL' OR to_id = 'all' OR to_id = ? OR to_id = ? OR to_id = ? OR to_id = '')
            ORDER BY id DESC LIMIT 30`;

    const args = isIdQuery
      ? [roomId, sPartId, `EMP-${rawPartId}`, sPartId, `EMP-${rawPartId}`, rawPartId, numSinceId]
      : [roomId, sPartId, `EMP-${rawPartId}`, sPartId, `EMP-${rawPartId}`, rawPartId];

    const sRes = await db.execute({ sql, args, skipCache: true });
    if (sRes.rows && sRes.rows.length > 0) {
      relevantDbSignals = sRes.rows.map(r => {
        let parsedData = r.signal_data;
        try { parsedData = JSON.parse(r.signal_data); } catch (e) {}
        return {
          id: Number(r.id),
          roomId: r.room_id,
          fromId: r.from_id,
          toId: r.to_id,
          signalType: r.signal_type,
          signalData: parsedData,
          createdAt: r.created_ts || Date.now()
        };
      });
      if (!isIdQuery) {
        relevantDbSignals.sort((a, b) => a.id - b.id);
      }
    }
  } catch (e) {
    console.warn("Turso pollGroupRoom query warning:", e?.message || e);
  }

  // 3. Merge & deduplicate signals
  const combinedMap = new Map();
  for (const s of relevantMemSignals) {
    const key = `${s.id || ''}_${s.fromId}_${s.signalType}_${JSON.stringify(s.signalData || '')}`;
    combinedMap.set(key, s);
  }
  for (const s of relevantDbSignals) {
    const key = `${s.id || ''}_${s.fromId}_${s.signalType}_${JSON.stringify(s.signalData || '')}`;
    if (!combinedMap.has(key)) {
      combinedMap.set(key, s);
    }
  }

  const sortedSignals = Array.from(combinedMap.values()).sort((a, b) => (a.id || a.createdAt) - (b.id || b.createdAt));
  const maxSignalId = sortedSignals.reduce((max, s) => {
    const sId = Number(s.id);
    if (sId > 0 && sId < 1000000000) {
      return Math.max(max, sId);
    }
    return max;
  }, numSinceId);

  // Filter out stealth / ghost participants for regular students/teachers
  let returnedRoom = room ? { ...room } : null;
  if (returnedRoom && Array.isArray(returnedRoom.participants)) {
    const isRequesterAdminOrStealth = sPartId.toLowerCase().includes('admin') ||
      returnedRoom.participants.some(p => (String(p.id) === sPartId || String(p.id).replace('EMP-', '') === rawPartId) && (p.isStealth || p.isHidden || p.role === 'administrator' || p.role === 'principal'));
    
    if (!isRequesterAdminOrStealth) {
      returnedRoom.participants = returnedRoom.participants.filter(p => !p.isStealth && !p.isHidden);
    }
  }

  return {
    ok: true,
    room: returnedRoom,
    signals: sortedSignals,
    maxSignalId,
    now: Date.now()
  };
}

/**
 * 12. Get All Currently Active Rooms (for Admin Dashboard)
 */
async function getActiveRooms() {
  const rooms = [];
  const seenIds = new Set();

  for (const [rId, r] of activeRoomsMap.entries()) {
    if (r.status === 'active') {
      const roomAgeMs = r.created_at ? (Date.now() - parseUtcDate(r.created_at)) : 0;
      if (roomAgeMs < 1800000) {
        rooms.push(r);
        seenIds.add(rId);
      }
    }
  }

  try {
    const res = await db.execute({
      sql: "SELECT * FROM app_voice_rooms WHERE status = 'active' AND ended_at IS NULL AND (unixepoch('now') - unixepoch(created_at)) < 1800 ORDER BY id DESC",
      skipCache: true
    });
    if (res.rows && res.rows.length > 0) {
      for (const row of res.rows) {
        if (!seenIds.has(row.room_id)) {
          let parts = [];
          try {
            parts = typeof row.participants === 'string' ? JSON.parse(row.participants || '[]') : (row.participants || []);
          } catch(e) {}
          row.participants = parts;
          rooms.push(row);
          seenIds.add(row.room_id);
        }
      }
    }
  } catch(e) {}

  return { ok: true, rooms };
}

/**
 * Dispatches high-priority hands-free auto-play voice notification to targeted devices
 */
async function dispatchVoiceNotificationPush({
  id,
  title,
  message,
  targetType,
  targetClass,
  targetId,
  senderName,
  durationSec
}) {
  const audioUrl = `https://tapowan-school.vercel.app/api/voice-notifications/${id}/audio`;
  const ttsText = message || title;

  let tokens = [];

  try {
    if (targetType === 'student' && targetId) {
      const cleanTid = String(targetId).trim();
      const noZeroTid = cleanTid.replace(/^0+/, '');
      const withZeroTid = '0' + noZeroTid;
      const aliases = [...new Set([cleanTid, noZeroTid, withZeroTid])];
      const placeholders = aliases.map(() => '?').join(',');

      const res = await db.execute({
        sql: `SELECT DISTINCT apt.token FROM app_push_tokens apt
              LEFT JOIN students s ON (
                s.admissionNo = apt.admission_no OR
                s.admissionNo = ('0' || apt.admission_no) OR
                apt.admission_no = ('0' || s.admissionNo) OR
                s.phone = apt.admission_no
              )
              WHERE apt.admission_no IN (${placeholders})
                 OR LOWER(apt.student_name) = LOWER(?)
                 OR LOWER(s.fullName) = LOWER(?)
                 OR s.admissionNo IN (${placeholders})
                 OR s.phone = ? OR s.rollNo = ?
              ORDER BY apt.id DESC LIMIT 20`,
        args: [...aliases, cleanTid, cleanTid, ...aliases, cleanTid, cleanTid]
      });
      tokens = (res?.rows || []).map(r => r[0] || r.token).filter(Boolean);
    } else if (targetType === 'class' && targetClass && targetClass !== 'ALL') {
      const normClass = normalizeTargetClass(targetClass);
      const classVariants = getNormalizedClassVariants(normClass);
      const cPlaceholders = classVariants.map(() => '?').join(',');

      const res = await db.execute({
        sql: `SELECT DISTINCT apt.token FROM app_push_tokens apt 
              INNER JOIN students s ON (
                s.admissionNo = apt.admission_no OR
                s.admissionNo = ('0' || apt.admission_no) OR
                apt.admission_no = ('0' || s.admissionNo) OR
                LOWER(s.fullName) = LOWER(apt.student_name)
              )
              WHERE s.className IN (${cPlaceholders})
              ORDER BY apt.id DESC LIMIT 500`,
        args: classVariants
      });
      tokens = (res?.rows || []).map(r => r[0] || r.token).filter(Boolean);
    } else if (targetType === 'teachers') {
      const res = await db.execute({
        sql: `SELECT DISTINCT apt.token FROM app_push_tokens apt
              LEFT JOIN teachers t ON (
                apt.admission_no = ('EMP-' || t.employeeNo) OR
                apt.admission_no = ('EMP-' || t.id) OR
                apt.admission_no = t.employeeNo OR
                apt.admission_no = CAST(t.id AS TEXT) OR
                apt.admission_no = t.phone OR
                LOWER(apt.student_name) = LOWER(t.fullName)
              )
              WHERE apt.admission_no LIKE 'EMP-%' OR t.id IS NOT NULL
              ORDER BY apt.id DESC LIMIT 200`
      });
      tokens = (res?.rows || []).map(r => r[0] || r.token).filter(Boolean);
    } else {
      // All school
      const res = await db.execute({
        sql: `SELECT DISTINCT token FROM app_push_tokens WHERE updated_at > datetime('now', '-90 days') ORDER BY id DESC LIMIT 1000`
      });
      tokens = (res?.rows || []).map(r => r[0] || r.token).filter(Boolean);
    }
  } catch (err) {
    console.error('[Voice Push] Error fetching tokens:', err);
  }

  const uniqueTokens = [...new Set(tokens)];
  console.log(`[Voice Push] Found ${uniqueTokens.length} push tokens for targetType=${targetType} targetClass=${targetClass} targetId=${targetId}`);

  if (uniqueTokens.length === 0) return { success: true, count: 0 };

  const fcmTokens = uniqueTokens.filter(t => !t.startsWith('ExponentPushToken'));
  const expoTokens = uniqueTokens.filter(t => t.startsWith('ExponentPushToken'));

  let notifiedCount = 0;

  // 1. Dispatch FCM v1 (Direct Android High-Priority Data Push for Instant Auto-Play)
  if (fcmTokens.length > 0) {
    try {
      const accessToken = await getFcmAccessToken();
      if (accessToken) {
        const fcmData = {
          type: 'VOICE_NOTIFICATION',
          notificationId: String(id),
          title: title,
          message: message || '',
          body: message || '',
          audioUrl: audioUrl,
          ttsText: ttsText,
          senderName: senderName || 'Tapowan Public School',
          durationSec: String(durationSec || 0),
          targetType: targetType || 'all',
          targetClass: targetClass || '',
          targetId: targetId || ''
        };

        const fcmBatch = fcmTokens.map(async (token) => {
          try {
            const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: {
                  token: token,
                  android: {
                    priority: 'HIGH',
                    ttl: '120s'
                  },
                  data: fcmData
                }
              })
            });
            if (res.ok) notifiedCount++;
          } catch (e) {}
        });
        await Promise.all(fcmBatch);
      }
    } catch (e) {
      console.error('[Voice Push] FCM dispatch error:', e);
    }
  }

  // 2. Dispatch Expo Push Service
  if (expoTokens.length > 0) {
    try {
      const chunks = [];
      for (let i = 0; i < expoTokens.length; i += 100) {
        chunks.push(expoTokens.slice(i, i + 100));
      }
      for (const chunk of chunks) {
        const messages = chunk.map(token => ({
          to: token,
          sound: 'default',
          title: `🎙️ ${title}`,
          body: message || 'Tap to listen to school voice announcement',
          channelId: 'default',
          priority: 'high',
          data: {
            type: 'VOICE_NOTIFICATION',
            notificationId: String(id),
            title: title,
            message: message,
            audioUrl: audioUrl,
            ttsText: ttsText,
            senderName: senderName || 'Tapowan Public School',
            durationSec: String(durationSec || 0),
            targetType: targetType || 'all',
            targetClass: targetClass || '',
            targetId: targetId || ''
          }
        }));
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messages)
        });
        notifiedCount += chunk.length;
      }
    } catch (e) {
      console.error('[Voice Push] Expo dispatch error:', e);
    }
  }

  return { success: true, count: notifiedCount };
}

/**
 * 🧹 Clean up call logs, stale room sessions, and signaling data.
 * Purges call records older than 24 hours.
 * @param {Object} options
 * @param {boolean} [options.forceAll=false] - If true, purges all non-active calls immediately.
 * @param {number} [options.olderThanHours=24] - Age cutoff in hours (default: 24).
 */
async function cleanupCallLogs(options = {}) {
  const forceAll = Boolean(options.forceAll);
  const hours = Number(options.olderThanHours) || 24;
  const cutoffSql = `'-${hours} hours'`;

  const sqlCalls = forceAll
    ? "DELETE FROM app_voice_calls WHERE status NOT IN ('ringing', 'connected');"
    : `DELETE FROM app_voice_calls WHERE datetime(created_at) < datetime('now', ${cutoffSql}) OR (status IN ('ended', 'declined', 'missed', 'timeout', 'busy') AND datetime(COALESCE(updated_at, created_at)) < datetime('now', ${cutoffSql}));`;

  const sqlRooms = forceAll
    ? "DELETE FROM app_voice_rooms WHERE status = 'ended';"
    : `DELETE FROM app_voice_rooms WHERE datetime(created_at) < datetime('now', ${cutoffSql}) OR (status = 'ended' AND datetime(COALESCE(ended_at, created_at)) < datetime('now', ${cutoffSql}));`;

  const sqlSignals = `DELETE FROM app_voice_signals WHERE datetime(created_at) < datetime('now', ${cutoffSql});`;

  let callsDeleted = 0;
  let roomsDeleted = 0;
  let signalsDeleted = 0;

  try {
    const resCalls = await db.execute({ sql: sqlCalls, skipCache: true });
    callsDeleted = resCalls?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[cleanupCallLogs] Error clearing calls:', err.message);
  }

  try {
    const resRooms = await db.execute({ sql: sqlRooms, skipCache: true });
    roomsDeleted = resRooms?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[cleanupCallLogs] Error clearing rooms:', err.message);
  }

  try {
    const resSignals = await db.execute({ sql: sqlSignals, skipCache: true });
    signalsDeleted = resSignals?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[cleanupCallLogs] Error clearing signals:', err.message);
  }

  console.log(`[cleanupCallLogs] Purged call logs (> ${hours}h): ${callsDeleted} calls, ${roomsDeleted} rooms, ${signalsDeleted} signals deleted.`);
  return { ok: true, callsDeleted, roomsDeleted, signalsDeleted, olderThanHours: hours, timestamp: new Date().toISOString() };
}

module.exports = {
  initVoiceCallTables,
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
  cleanupCallLogs
};

