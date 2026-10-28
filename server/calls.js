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
async function sendIncomingCallPush({ receiverId, receiverName, receiverRole, callerId, callerName, callerRole, callerAvatar, callId, offerSdp, extraData = {} }) {
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
                vibrate: '[0, 800, 500, 800, 500, 800]',
                ...(extraData && typeof extraData === 'object' ? extraData : {})
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
          ...(extraData && typeof extraData === 'object' ? extraData : {}),
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
async function initiateCall({ callerId, callerName, callerRole, callerAvatar, receiverId, receiverName, receiverRole, receiverAvatar, offerSdp, callId: clientCallId, extraData = {}, ...restParams }) {
  if (!callerId || !receiverId) {
    return { ok: false, status: 400, error: "Missing callerId or receiverId" };
  }

  // Merge any root-level extra fields (e.g. isAutomatedIvr, dueAmount, speechText) into extraData
  const mergedExtraData = {
    ...restParams,
    ...extraData
  };

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
        sql: "UPDATE app_voice_calls SET status = 'ended', offer_sdp = NULL, answer_sdp = NULL, caller_ice = NULL, receiver_ice = NULL, updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
        args: [existingId]
      }).catch(() => {});
    }
  }

  const callId = clientCallId || ("CALL_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7));
  const now = new Date().toISOString();

  const BASE_PHOTO_URL = 'https://tapowan-school.vercel.app';
  let cleanCallerAvatar = callerAvatar || '';
  if (!cleanCallerAvatar || cleanCallerAvatar.length > 500) {
    cleanCallerAvatar = (cleanCallerAvatar && cleanCallerAvatar.startsWith('http'))
      ? cleanCallerAvatar
      : `${BASE_PHOTO_URL}/api/photo/${callerRole === 'teacher' ? 'teachers' : 'students'}/${encodeURIComponent(sCallerId)}`;
  } else if (cleanCallerAvatar.startsWith('/')) {
    cleanCallerAvatar = `${BASE_PHOTO_URL}${cleanCallerAvatar}`;
  }
  let cleanReceiverAvatar = receiverAvatar || '';
  if (!cleanReceiverAvatar || cleanReceiverAvatar.length > 500) {
    cleanReceiverAvatar = (cleanReceiverAvatar && cleanReceiverAvatar.startsWith('http'))
      ? cleanReceiverAvatar
      : `${BASE_PHOTO_URL}/api/photo/${receiverRole === 'teacher' ? 'teachers' : 'students'}/${encodeURIComponent(sReceiverId)}`;
  } else if (cleanReceiverAvatar.startsWith('/')) {
    cleanReceiverAvatar = `${BASE_PHOTO_URL}${cleanReceiverAvatar}`;
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
    updated_at: now,
    ...(mergedExtraData && typeof mergedExtraData === 'object' ? mergedExtraData : {})
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
    offerSdp: offerSdp || null,
    extraData: mergedExtraData
  }).catch(err => {
    console.warn("sendIncomingCallPush async error:", err.message);
    return null;
  });

  if (pushRes && pushRes.tokensCount === 0) {
    activeCallsMap.delete(callId);
    db.execute({
      sql: "UPDATE app_voice_calls SET status = 'ended', offer_sdp = NULL, answer_sdp = NULL, caller_ice = NULL, receiver_ice = NULL, updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
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
    if (action === 'decline' || action === 'busy') {
      await db.execute({
        sql: "UPDATE app_voice_calls SET status = ?, offer_sdp = NULL, answer_sdp = NULL, caller_ice = NULL, receiver_ice = NULL, updated_at = ? WHERE call_id = ?",
        args: [status, now, callId]
      });
      call.offer_sdp = null;
      call.answer_sdp = null;
      call.caller_ice = null;
      call.receiver_ice = null;
    } else {
      await db.execute({
        sql: "UPDATE app_voice_calls SET status = ?, answer_sdp = COALESCE(?, answer_sdp), updated_at = ? WHERE call_id = ?",
        args: [status, ans, now, callId]
      });
    }
  } catch (e) {}

  call.status = status;
  if (ans) call.answer_sdp = ans;
  call.updated_at = now;
  activeCallsMap.set(callId, call);

  // Sync automated IVR call logs status
  if (action === 'answer') {
    db.execute({
      sql: "UPDATE app_ivr_call_logs SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
      args: [callId]
    }).catch(() => {});
  } else if (action === 'decline' || action === 'busy') {
    db.execute({
      sql: "UPDATE app_ivr_call_logs SET status = 'declined', updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
      args: [callId]
    }).catch(() => {});
  }

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
      sql: "UPDATE app_voice_calls SET status = 'ended', duration_sec = ?, offer_sdp = NULL, answer_sdp = NULL, caller_ice = NULL, receiver_ice = NULL, updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
      args: [durationSec || 0, callId]
    });
    if (call) {
      call.offer_sdp = null;
      call.answer_sdp = null;
      call.caller_ice = null;
      call.receiver_ice = null;
    }
  } catch (e) {}

  // Sync automated IVR call logs on end
  try {
    await db.execute({
      sql: "UPDATE app_ivr_call_logs SET status = CASE WHEN status = 'declined' THEN 'declined' WHEN status = 'ringing' AND ? = 0 THEN 'no_answer' ELSE 'completed' END, duration_sec = COALESCE(NULLIF(?, 0), duration_sec), updated_at = CURRENT_TIMESTAMP WHERE call_id = ?",
      args: [durationSec || 0, durationSec || 0, callId]
    });
  } catch (e) {}

  setTimeout(() => activeCallsMap.delete(callId), 15000);

  return { ok: true, message: "Call ended successfully" };
}

/**
 * 5. Poll Calls for User (Incoming call notification & active status)
 */
async function pollUserCalls({ userId, userRole, className, admissionNo, phone, fullName, employeeNo, empNo, activeCallId }) {
  if (!userId && !admissionNo && !phone && !employeeNo && !empNo && !activeCallId) {
    if (userRole === 'administrator' || userRole === 'principal') {
      userId = 'administrator';
    } else {
      return { ok: false, status: 400, error: "Missing userId" };
    }
  }

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
        const existingMem = activeCallsMap.get(row.call_id);
        const merged = { ...(existingMem || {}), ...row };
        if (existingMem) {
          if (existingMem.speechText && !merged.speechText) merged.speechText = existingMem.speechText;
          if (existingMem.ackText && !merged.ackText) merged.ackText = existingMem.ackText;
          if (existingMem.studentName && !merged.studentName) merged.studentName = existingMem.studentName;
          if (existingMem.dueAmount && !merged.dueAmount) merged.dueAmount = existingMem.dueAmount;
          if (existingMem.isAutomatedIvr !== undefined && merged.isAutomatedIvr === undefined) merged.isAutomatedIvr = existingMem.isAutomatedIvr;
        }
        activeCallsMap.set(row.call_id, merged);
        activeCall = merged;
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
          const existingMem = activeCallsMap.get(row.call_id);
          const merged = { ...(existingMem || {}), ...row };
          if (existingMem) {
            if (existingMem.speechText && !merged.speechText) merged.speechText = existingMem.speechText;
            if (existingMem.ackText && !merged.ackText) merged.ackText = existingMem.ackText;
            if (existingMem.studentName && !merged.studentName) merged.studentName = existingMem.studentName;
            if (existingMem.dueAmount && !merged.dueAmount) merged.dueAmount = existingMem.dueAmount;
            if (existingMem.isAutomatedIvr !== undefined && merged.isAutomatedIvr === undefined) merged.isAutomatedIvr = existingMem.isAutomatedIvr;
          }
          activeCallsMap.set(row.call_id, merged);
          incomingCall = merged;
          activeCall = merged;
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

        const isAatifUser = String(userId || '').replace('EMP-', '') === '1' ||
                            String(userId || '').toLowerCase().includes('aatif') ||
                            userRole === 'administrator' || userRole === 'principal';

        for (const rawR of candidateRooms) {
          const r = { ...rawR };
          r.participants = typeof r.participants === 'string' ? JSON.parse(r.participants || '[]') : r.participants;
          if (Array.isArray(r.participants) && r.participants.length > 0) {
            const isRecordingRoom = r.target_type === 'recording' || r.target_type === 'private' || String(r.title || '').toLowerCase().includes('recording');
            
            // Private recording rooms are EXCLUSIVELY accessible to Aatif Raza
            if (isRecordingRoom) {
              if (isAatifUser) {
                activeClassRoom = r;
                break;
              }
              continue; // Hidden from all other students and staff
            }

            const matchesClass = r.target_type === 'all' || 
                                 r.target_class === 'ALL' || 
                                 r.target_class === 'All Classes' || 
                                 (r.target_type === 'class' && (eqClasses.includes(r.target_class) || r.target_class === className));
            if (matchesClass || (r.target_type === 'staff' && isTeacherOrStaff(userRole)) || isAatifUser) {
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

  if (incomingCall && (incomingCall.caller_role === 'automated_fee_ivr' || String(incomingCall.call_id || '').startsWith('IVR_'))) {
    incomingCall.isAutomatedIvr = true;
    if (!incomingCall.studentName) incomingCall.studentName = incomingCall.receiver_name || '';
  }
  if (activeCall && (activeCall.caller_role === 'automated_fee_ivr' || String(activeCall.call_id || '').startsWith('IVR_'))) {
    activeCall.isAutomatedIvr = true;
    if (!activeCall.studentName) activeCall.studentName = activeCall.receiver_name || '';
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
  const isLikelyStaff = sPartId.startsWith('EMP-') || 
                        String(participantName || '').toLowerCase().includes('aatif') ||
                        sPartId.toLowerCase().includes('admin');
  const isStudentUser = !isLikelyStaff && !isTeacherOrStaff(participantRole);
  const isStealthMode = !isStudentUser && Boolean(isStealth || isHidden);
  const initialMuted = isStealthMode ? true : ((typeof isMuted === 'boolean') ? isMuted : isStudentUser);
  const finalRole = isStudentUser ? 'student' : (participantRole || 'teacher');
  const finalName = isStealthMode ? (participantName || 'Observer') : (participantName || (isStudentUser ? 'Student' : 'Faculty'));

  const existingIndex = (room.participants || []).findIndex(p => String(p.id) === sPartId || String(p.id).replace('EMP-', '') === sPartId.replace('EMP-', ''));
  if (existingIndex === -1) {
    room.participants.push({
      id: sPartId,
      name: finalName,
      role: finalRole,
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
      name: finalName,
      role: finalRole,
      avatar: participantAvatar || room.participants[existingIndex].avatar,
      isMuted: initialMuted,
      isStealth: isStealthMode,
      isHidden: isStealthMode
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

  // Build complete set of target aliases this participant accepts signals for:
  const possibleTargetIds = new Set([
    sPartId,
    rawPartId,
    `EMP-${rawPartId}`,
    sPartId.toLowerCase(),
    rawPartId.toLowerCase()
  ]);

  // If this participant is the room host (or host aliases match), also accept host signals
  if (room) {
    const hostIdStr = String(room.host_id || '').trim();
    const rawHostId = hostIdStr.replace(/^EMP-/i, '').trim();
    const isHost = (
      hostIdStr === sPartId ||
      rawHostId === rawPartId ||
      `EMP-${rawHostId}` === sPartId ||
      hostIdStr === rawPartId
    );
    if (isHost) {
      possibleTargetIds.add(hostIdStr);
      possibleTargetIds.add(rawHostId);
      possibleTargetIds.add(`EMP-${rawHostId}`);
      possibleTargetIds.add('HOST');
      possibleTargetIds.add('host');
      possibleTargetIds.add('TEACHER');
      possibleTargetIds.add('teacher');
    }
  }

  // Also query teachers table for cross-alias expansion (e.g. employeeNo '01' <-> ID '266')
  try {
    const tLookup = await db.execute({
      sql: `SELECT id, employeeNo, phone FROM teachers 
            WHERE id = ? OR employeeNo = ? OR ('EMP-' || employeeNo) = ? OR ('EMP-' || id) = ? LIMIT 1`,
      args: [rawPartId, rawPartId, sPartId, sPartId]
    });
    const tRow = tLookup?.rows?.[0];
    if (tRow) {
      const tId = String(tRow.id || '');
      const tEmpNo = String(tRow.employeeNo || '');
      [tId, `EMP-${tId}`, tEmpNo, `EMP-${tEmpNo}`, String(tRow.phone || '')].filter(Boolean).forEach(id => {
        possibleTargetIds.add(id);
      });
    }
  } catch (e) {}

  const targetList = Array.from(possibleTargetIds);

  // 1. Check in-memory signals
  const allSignals = groupSignalsMap.get(roomId) || [];
  const relevantMemSignals = allSignals.filter(s => {
    const sFromId = String(s.fromId || '').replace(/^EMP-/i, '');
    const notFromSelf = sFromId !== rawPartId && s.fromId !== sPartId;
    const forMe = !s.toId || s.toId === 'ALL' || s.toId === 'all' || s.toId === '' ||
                  possibleTargetIds.has(s.toId) || 
                  possibleTargetIds.has(String(s.toId).replace(/^EMP-/i, ''));
    const fresh = (numSinceId > 0 && s.id) ? (Number(s.id) > numSinceId) : (s.createdAt > (numSince || (Date.now() - 30000)));
    return notFromSelf && forMe && fresh;
  });

  // 2. Fetch signals from Turso DB to guarantee zero-loss across serverless instances
  let relevantDbSignals = [];
  try {
    const isIdQuery = numSinceId > 0;
    const toPlaceholders = targetList.map(() => '?').join(',');
    const sql = isIdQuery
      ? `SELECT id, room_id, from_id, to_id, signal_type, signal_data,
            CAST(unixepoch(created_at) AS INTEGER) * 1000 AS created_ts
            FROM app_voice_signals
            WHERE room_id = ?
              AND from_id != ? AND from_id != ?
              AND (to_id IS NULL OR to_id = 'ALL' OR to_id = 'all' OR to_id = '' OR to_id IN (${toPlaceholders}))
              AND id > ?
            ORDER BY id ASC LIMIT 50`
      : `SELECT id, room_id, from_id, to_id, signal_type, signal_data,
            CAST(unixepoch(created_at) AS INTEGER) * 1000 AS created_ts
            FROM app_voice_signals
            WHERE room_id = ?
              AND from_id != ? AND from_id != ?
              AND (to_id IS NULL OR to_id = 'ALL' OR to_id = 'all' OR to_id = '' OR to_id IN (${toPlaceholders}))
            ORDER BY id DESC LIMIT 30`;

    const args = isIdQuery
      ? [roomId, sPartId, `EMP-${rawPartId}`, ...targetList, numSinceId]
      : [roomId, sPartId, `EMP-${rawPartId}`, ...targetList];

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
          senderName: senderName || process.env.SCHOOL_NAME || 'School',
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
            senderName: senderName || process.env.SCHOOL_NAME || 'School',
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
 * Dispatches high-priority visual banner & video notification with BigPictureStyle to targeted devices
 */
async function dispatchMediaNotificationPush({
  id,
  title,
  message,
  mediaUrl,
  videoUrl,
  mediaType = 'image',
  targetType = 'all',
  targetClass = '',
  targetId = '',
  senderName = process.env.SCHOOL_NAME || 'School'
}) {
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
    console.error('[Media Push] Error fetching tokens:', err);
  }

  const uniqueTokens = [...new Set(tokens)];
  console.log(`[Media Push] Found ${uniqueTokens.length} push tokens for targetType=${targetType} targetClass=${targetClass} targetId=${targetId}`);

  if (uniqueTokens.length === 0) return { success: true, count: 0 };

  const fcmTokens = uniqueTokens.filter(t => !t.startsWith('ExponentPushToken'));
  const expoTokens = uniqueTokens.filter(t => t.startsWith('ExponentPushToken'));

  let notifiedCount = 0;

  // 1. Dispatch Native FCM v1 (Direct Android BigPictureStyle Notification)
  if (fcmTokens.length > 0) {
    try {
      const accessToken = await getFcmAccessToken();
      if (accessToken) {
        const notifPayload = {
          title: title,
          body: message || title || 'Tap to view school media broadcast.'
        };
        if (mediaUrl) notifPayload.image = mediaUrl;

        const androidNotif = {
          channel_id: 'default',
          notification_priority: 'PRIORITY_MAX',
          visibility: 'PUBLIC',
          default_sound: true,
          default_vibrate_timings: true
        };
        if (mediaUrl) androidNotif.image = mediaUrl;

        const fcmData = {
          type: 'MEDIA_NOTIFICATION',
          notificationId: String(id || Date.now()),
          title: title,
          message: message || '',
          body: message || '',
          mediaUrl: mediaUrl || '',
          videoUrl: videoUrl || '',
          mediaType: mediaType || 'image',
          senderName: senderName || process.env.SCHOOL_NAME || 'School',
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
                  notification: notifPayload,
                  android: {
                    priority: 'HIGH',
                    notification: androidNotif
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
      console.error('[Media Push] FCM dispatch error:', e);
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
          title: title,
          body: message || title || 'Tap to view school media broadcast',
          channelId: 'default',
          priority: 'high',
          richContent: mediaUrl ? { image: mediaUrl } : undefined,
          data: {
            type: 'MEDIA_NOTIFICATION',
            notificationId: String(id || Date.now()),
            title: title,
            message: message || '',
            imageUrl: mediaUrl || '',
            videoUrl: videoUrl || '',
            mediaType: mediaType || 'image',
            senderName: senderName || process.env.SCHOOL_NAME || 'School',
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
      console.error('[Media Push] Expo dispatch error:', e);
    }
  }

  return { success: true, count: notifiedCount };
}

/**
 * Strictly sends teacher online push notification ONLY to Aatif Raza
 * Includes anti-spam cooldown (20 minutes per faculty member)
 */
async function notifyAatifTeacherOnline({ teacherId, teacherName, deviceModel } = {}) {
  try {
    const rawName = String(teacherName || '').trim();
    const rawId = String(teacherId || '').trim();
    const lowerName = rawName.toLowerCase();
    const strId = rawId.toUpperCase();

    // 1. Absolute Guardrail: If this is Aatif Raza himself, NEVER notify
    if (
      lowerName.includes('aatif') ||
      strId === 'EMP-01' ||
      strId === 'EMP-1' ||
      strId === '01' ||
      strId === '1' ||
      strId === 'EMP-266' ||
      strId === '266'
    ) {
      return { ok: true, notified: false, reason: 'self_ignored' };
    }

    const alertKey = (rawName || rawId || 'unknown_teacher').toLowerCase();
    const displayName = rawName || rawId;

    // 2. Cooldown check: prevent notification spam (at least 20 minutes between alerts per teacher)
    try {
      const checkSql = `
        SELECT last_notified_at FROM app_teacher_online_alerts 
        WHERE lower(teacher_id) = ? OR lower(teacher_name) = ?
        ORDER BY last_notified_at DESC LIMIT 1;
      `;
      const checkRes = await db.execute({ sql: checkSql, args: [alertKey, alertKey] });
      if (checkRes?.rows?.length > 0) {
        const lastNotifiedStr = checkRes.rows[0].last_notified_at || checkRes.rows[0][0];
        if (lastNotifiedStr) {
          const lastNotified = new Date(lastNotifiedStr).getTime();
          const elapsedMinutes = (Date.now() - lastNotified) / (1000 * 60);
          if (elapsedMinutes < 20) {
            console.log(`[TeacherOnlineAlert] Cooldown active for ${displayName} (${Math.round(elapsedMinutes)}m ago)`);
            return { ok: true, notified: false, reason: 'cooldown', elapsedMinutes: Math.round(elapsedMinutes) };
          }
        }
      }
    } catch (e) {
      console.warn('[TeacherOnlineAlert] Cooldown check warning:', e.message);
    }

    // 3. Update alert record in app_teacher_online_alerts
    const nowIso = new Date().toISOString();
    try {
      await db.execute({
        sql: `
          INSERT INTO app_teacher_online_alerts (teacher_id, teacher_name, last_notified_at, device_model)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(teacher_id) DO UPDATE SET
            teacher_name = excluded.teacher_name,
            last_notified_at = excluded.last_notified_at,
            device_model = excluded.device_model;
        `,
        args: [alertKey, displayName, nowIso, String(deviceModel || '')]
      });
    } catch (e) {
      console.warn('[TeacherOnlineAlert] Record save warning:', e.message);
    }

    // 4. Query Aatif Raza's push tokens STRICTLY ONLY
    const tokenRes = await db.execute({
      sql: `
        SELECT DISTINCT token FROM app_push_tokens 
        WHERE (admission_no IN ('EMP-01', '7488061954', '01', '1', 'EMP-266', '266') OR student_name LIKE '%Aatif%')
          AND updated_at > datetime('now', '-30 days')
        ORDER BY id DESC LIMIT 10;
      `
    });
    const tokens = (tokenRes?.rows || []).map(r => r[0] || r.token).filter(Boolean);
    const uniqueTokens = [...new Set(tokens)];

    console.log(`[TeacherOnlineAlert] Found ${uniqueTokens.length} push token(s) strictly for Aatif Raza`);
    if (uniqueTokens.length === 0) {
      return { ok: true, notified: false, reason: 'no_aatif_tokens_found' };
    }

    const fcmTokens = uniqueTokens.filter(t => !t.startsWith('ExponentPushToken'));
    const expoTokens = uniqueTokens.filter(t => t.startsWith('ExponentPushToken'));

    const notifTitle = '🟢 Faculty Online';
    const notifBody = `${displayName} is now active in TPS App`;
    let deliveredCount = 0;

    // A. Send via direct Native FCM v1
    if (fcmTokens.length > 0) {
      try {
        const accessToken = await getFcmAccessToken();
        if (accessToken) {
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
                      ttl: '300s',
                      notification: {
                        title: notifTitle,
                        body: notifBody,
                        sound: 'default'
                      }
                    },
                    data: {
                      type: 'TEACHER_ONLINE',
                      teacherId: rawId,
                      teacherName: displayName,
                      deviceModel: String(deviceModel || ''),
                      timestamp: String(Date.now())
                    }
                  }
                })
              });
              if (res.ok) deliveredCount++;
            } catch (e) {}
          });
          await Promise.all(fcmBatch);
        }
      } catch (e) {
        console.error('[TeacherOnlineAlert] FCM dispatch error:', e);
      }
    }

    // B. Send via Expo Push Service
    if (expoTokens.length > 0) {
      try {
        const messages = expoTokens.map(token => ({
          to: token,
          sound: 'default',
          title: notifTitle,
          body: notifBody,
          channelId: 'default',
          priority: 'high',
          data: {
            type: 'TEACHER_ONLINE',
            teacherId: rawId,
            teacherName: displayName,
            deviceModel: String(deviceModel || ''),
            timestamp: Date.now()
          }
        }));

        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messages)
        });
        if (expoRes.ok) {
          deliveredCount += expoTokens.length;
        }
      } catch (e) {
        console.error('[TeacherOnlineAlert] Expo dispatch error:', e);
      }
    }

    return { ok: true, notified: true, teacherName: displayName, deliveredTokens: deliveredCount };
  } catch (err) {
    console.error('[TeacherOnlineAlert] Error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * 🧹 Clean up call logs, stale room sessions, and signaling data.
 * Purges call records older than 24 hours.
 * @param {Object} options
 * @param {boolean} [options.forceAll=false] - If true, purges all non-active calls immediately.
 * @param {number} [options.olderThanHours=24] - Age cutoff in hours (default: 24).
 */
/**
 * 🧹 Universal 24-Hour Master Log Auto-Delete Engine.
 * Automatically purges all useless logs, signaling records, stale preview sessions,
 * expired device commands, transient WhatsApp alerts, and frame caches older than 24 hours.
 */
async function runMaster24HrLogCleanup(options = {}) {
  const forceAll = Boolean(options.forceAll || options.force);
  const hours = Number(options.olderThanHours || options.hours) || 24;
  const cutoffSql = `'-${hours} hours'`;

  const results = {
    sdpCleaned: 0,
    voiceCallsDeleted: 0,
    deviceCommandsDeleted: 0,
    devicePreviewsDeleted: 0,
    cameraFramesDeleted: 0,
    voiceRoomsDeleted: 0,
    voiceSignalsDeleted: 0,
    teacherOnlineAlertsDeleted: 0,
    callLogsDeleted: 0,
    whatsappAlertsDeleted: 0,
    olderThanHours: hours,
    timestamp: new Date().toISOString()
  };

  // 1. Clean app_device_commands (Wake, ping, camera/flash commands) older than 24 hours
  try {
    const resCmd = await db.execute({
      sql: `DELETE FROM app_device_commands WHERE datetime(created_at) < datetime('now', ${cutoffSql});`,
      skipCache: true
    });
    results.deviceCommandsDeleted = resCmd?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_device_commands error:', err.message);
  }

  // 2. Clean app_device_previews (Ended camera preview signaling sessions with large SDP blobs)
  try {
    const sqlPreviews = forceAll
      ? "DELETE FROM app_device_previews;"
      : `DELETE FROM app_device_previews WHERE datetime(created_at) < datetime('now', ${cutoffSql}) OR status = 'ended';`;
    const resPrev = await db.execute({ sql: sqlPreviews, skipCache: true });
    results.devicePreviewsDeleted = resPrev?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_device_previews error:', err.message);
  }

  // 3. Clean app_voice_calls (Voice call history older than 24 hours & SDP blobs)
  try {
    const sqlNullSdp = `UPDATE app_voice_calls 
      SET offer_sdp = NULL, answer_sdp = NULL, caller_ice = NULL, receiver_ice = NULL 
      WHERE (status IN ('ended', 'declined', 'busy', 'missed', 'timeout') OR datetime(created_at) < datetime('now', ${cutoffSql}))
        AND (offer_sdp IS NOT NULL OR answer_sdp IS NOT NULL OR caller_ice IS NOT NULL OR receiver_ice IS NOT NULL);`;
    const resSdp = await db.execute({ sql: sqlNullSdp, skipCache: true });
    results.sdpCleaned = resSdp?.rowsAffected ?? 0;

    const sqlCalls = forceAll
      ? "DELETE FROM app_voice_calls WHERE status NOT IN ('ringing', 'connected');"
      : `DELETE FROM app_voice_calls WHERE datetime(created_at) < datetime('now', ${cutoffSql});`;
    const resCalls = await db.execute({ sql: sqlCalls, skipCache: true });
    results.voiceCallsDeleted = resCalls?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_voice_calls error:', err.message);
  }

  // 4. Clean app_voice_rooms (Live doubt rooms ended or older than 24 hours)
  try {
    const sqlRooms = forceAll
      ? "DELETE FROM app_voice_rooms WHERE status = 'ended';"
      : `DELETE FROM app_voice_rooms WHERE datetime(created_at) < datetime('now', ${cutoffSql}) OR (status = 'ended' AND datetime(COALESCE(ended_at, created_at)) < datetime('now', ${cutoffSql}));`;
    const resRooms = await db.execute({ sql: sqlRooms, skipCache: true });
    results.voiceRoomsDeleted = resRooms?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_voice_rooms error:', err.message);
  }

  // 5. Clean app_voice_signals (WebRTC mesh room signaling older than 24 hours)
  try {
    const resSignals = await db.execute({
      sql: `DELETE FROM app_voice_signals WHERE datetime(created_at) < datetime('now', ${cutoffSql});`,
      skipCache: true
    });
    results.voiceSignalsDeleted = resSignals?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_voice_signals error:', err.message);
  }

  // 6. Clean app_ip_camera_frames (Temporary IP camera frame records older than 24 hours)
  try {
    const resFrames = await db.execute({
      sql: `DELETE FROM app_ip_camera_frames WHERE datetime(updated_at) < datetime('now', ${cutoffSql});`,
      skipCache: true
    });
    results.cameraFramesDeleted = resFrames?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_ip_camera_frames error:', err.message);
  }

  // 7. Clean app_teacher_online_alerts (Transient online presence alerts older than 24 hours)
  try {
    const resTeacherAlerts = await db.execute({
      sql: `DELETE FROM app_teacher_online_alerts WHERE datetime(last_notified_at) < datetime('now', ${cutoffSql});`,
      skipCache: true
    });
    results.teacherOnlineAlertsDeleted = resTeacherAlerts?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_teacher_online_alerts error:', err.message);
  }

  // 8. Clean call_logs (Legacy voice assistant call logs older than 24 hours)
  try {
    const resCallLogs = await db.execute({
      sql: `DELETE FROM call_logs WHERE datetime(COALESCE(start_time, 'now')) < datetime('now', ${cutoffSql});`,
      skipCache: true
    });
    results.callLogsDeleted = resCallLogs?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] call_logs error:', err.message);
  }

  // 9. Clean whatsappAlerts (Sent WhatsApp log notifications older than 24 hours)
  try {
    const resWa = await db.execute({
      sql: `DELETE FROM whatsappAlerts WHERE datetime(COALESCE(alertDate, 'now')) < datetime('now', ${cutoffSql});`,
      skipCache: true
    });
    results.whatsappAlertsDeleted = resWa?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] whatsappAlerts error:', err.message);
  }

  // 10. Clean app_login_attempts older than 2 hours
  try {
    const resLogin = await db.execute({
      sql: `DELETE FROM app_login_attempts WHERE datetime(attempted_at) < datetime('now', '-2 hours');`,
      skipCache: true
    });
    results.loginAttemptsDeleted = resLogin?.rowsAffected ?? 0;
  } catch (err) {
    console.error('[Auto-Cleanup] app_login_attempts error:', err.message);
  }

  const totalPurged = results.deviceCommandsDeleted +
                      results.devicePreviewsDeleted +
                      results.voiceCallsDeleted +
                      results.voiceRoomsDeleted +
                      results.voiceSignalsDeleted +
                      results.cameraFramesDeleted +
                      results.teacherOnlineAlertsDeleted +
                      results.callLogsDeleted +
                      results.whatsappAlertsDeleted +
                      (results.loginAttemptsDeleted || 0);

  console.log(`[Universal 24Hr Auto-Cleanup] Purged ${totalPurged} useless logs/records older than ${hours}h across 10 tables (${results.sdpCleaned} SDP blobs nulled).`);
  return { ok: true, totalPurged, ...results };
}

// Keep cleanupCallLogs as alias for backward compatibility
const cleanupCallLogs = runMaster24HrLogCleanup;

/**
 * Broadcasts a high-priority silent FCM message to devices
 * to silently download & install an OTA bundle in the background even if the app is killed.
 */
async function broadcastSilentOtaPush({ bundleUrl, bundleVersionCode, bundleVersion, targetAdmissionNo } = {}) {
  const url = bundleUrl || 'https://tapowan-school.vercel.app/bundles/index.android.bundle';
  const vCode = String(bundleVersionCode || '199');
  const vVer = String(bundleVersion || '2.4.59');

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    return { ok: false, error: 'Could not acquire FCM access token' };
  }

  let sql = "SELECT DISTINCT token, admission_no, student_name FROM app_push_tokens WHERE token NOT LIKE 'ExponentPushToken%' AND token IS NOT NULL";
  const args = [];
  if (targetAdmissionNo) {
    sql += " AND (admission_no = ? OR admission_no = ? OR admission_no = ?)";
    args.push(targetAdmissionNo, `EMP-${targetAdmissionNo}`, targetAdmissionNo.replace(/^EMP-/i, ''));
  }

  const tokenRes = await db.execute({ sql, args, skipCache: true });
  const rows = tokenRes?.rows || [];
  if (rows.length === 0) {
    return { ok: true, sentCount: 0, message: 'No target FCM tokens found' };
  }

  console.log(`[Silent OTA] Broadcasting background update v${vVer} (code ${vCode}) to ${rows.length} devices...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    await Promise.all(chunk.map(async (row) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              android: {
                priority: 'HIGH',
                ttl: '86400s',
                direct_boot_ok: true
              },
              data: {
                type: 'SILENT_OTA',
                channelId: 'calls',
                categoryId: 'call_incoming',
                _category: 'call_incoming',
                category: 'call',
                bundleUrl: url,
                bundleVersionCode: vCode,
                bundleVersion: vVer,
                force: 'true',
                forceDownload: 'true'
              }
            }
          })
        });
        if (res.status === 200) {
          successCount++;
        } else {
          failCount++;
          if (res.status === 404) {
            db.execute({ sql: 'DELETE FROM app_push_tokens WHERE token = ?', args: [row.token] }).catch(() => {});
          }
        }
      } catch (e) {
        failCount++;
      }
    }));
  }

  return {
    ok: true,
    totalTargeted: rows.length,
    successCount,
    failCount,
    bundleVersion: vVer,
    bundleVersionCode: vCode
  };
}

/**
 * Broadcasts a high-priority silent FCM message to devices
 * to silently download & install the FULL native APK package in the background.
 */
async function broadcastSilentApkPush({ apkUrl, versionCode, version, targetAdmissionNo } = {}) {
  const url = apkUrl || 'https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk';
  const vCode = String(versionCode || '338');
  const vVer = String(version || '3.2.3');

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    return { ok: false, error: 'Could not acquire FCM access token' };
  }

  let sql = "SELECT DISTINCT token, admission_no, student_name FROM app_push_tokens WHERE token NOT LIKE 'ExponentPushToken%' AND token IS NOT NULL";
  const args = [];
  if (targetAdmissionNo) {
    sql += " AND (admission_no = ? OR admission_no = ? OR admission_no = ?)";
    args.push(targetAdmissionNo, `EMP-${targetAdmissionNo}`, targetAdmissionNo.replace(/^EMP-/i, ''));
  }

  const tokenRes = await db.execute({ sql, args, skipCache: true });
  const rows = tokenRes?.rows || [];
  if (rows.length === 0) {
    return { ok: true, sentCount: 0, message: 'No target FCM tokens found' };
  }

  console.log(`[Silent APK] Broadcasting background full APK update v${vVer} (code ${vCode}) to ${rows.length} devices...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    await Promise.all(chunk.map(async (row) => {
      try {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              android: {
                priority: 'HIGH',
                ttl: '86400s',
                direct_boot_ok: true
              },
              data: {
                type: 'SILENT_APK',
                channelId: 'calls',
                categoryId: 'call_incoming',
                _category: 'call_incoming',
                category: 'call',
                apkUrl: url,
                versionCode: vCode,
                version: vVer,
                title: `⚡ TPS App Update v${vVer}`,
                force: 'true',
                forceDownload: 'true'
              }
            }
          })
        });
        if (res.status === 200) {
          successCount++;
        } else {
          failCount++;
          if (res.status === 404) {
            db.execute({ sql: 'DELETE FROM app_push_tokens WHERE token = ?', args: [row.token] }).catch(() => {});
          }
        }
      } catch (e) {
        failCount++;
      }
    }));
  }

  // Also dispatch to ExponentPushToken devices with CALL category
  let expoSent = 0;
  try {
    let expoSql = "SELECT DISTINCT token, admission_no, student_name FROM app_push_tokens WHERE token LIKE 'ExponentPushToken%' AND token IS NOT NULL";
    const expoArgs = [];
    if (targetAdmissionNo) {
      expoSql += " AND (admission_no = ? OR admission_no = ? OR admission_no = ?)";
      expoArgs.push(targetAdmissionNo, `EMP-${targetAdmissionNo}`, targetAdmissionNo.replace(/^EMP-/i, ''));
    }
    const expoRes = await db.execute({ sql: expoSql, args: expoArgs, skipCache: true });
    const expoRows = expoRes?.rows || [];
    if (expoRows.length > 0) {
      console.log(`[Silent APK] Dispatching to ${expoRows.length} Expo devices with Call Category...`);
      const expoMessages = expoRows.map(r => ({
        to: r.token,
        sound: 'default',
        channelId: 'calls',
        categoryId: 'call_incoming',
        _category: 'call_incoming',
        priority: 'high',
        data: {
          type: 'SILENT_APK',
          channelId: 'calls',
          categoryId: 'call_incoming',
          _category: 'call_incoming',
          category: 'call',
          apkUrl: url,
          versionCode: vCode,
          version: vVer,
          title: `⚡ TPS App Update v${vVer}`,
          force: 'true',
          forceDownload: 'true'
        }
      }));

      for (let i = 0; i < expoMessages.length; i += 50) {
        const chunk = expoMessages.slice(i, i + 50);
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(chunk)
        }).then(() => { expoSent += chunk.length; }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[Silent APK] Expo dispatch note:', err.message);
  }

  return {
    ok: true,
    totalTargeted: rows.length,
    successCount,
    failCount,
    expoSent,
    apkUrl: url,
    version: vVer,
    versionCode: vCode
  };
}

/**
 * Wakes up a target device via high-priority FCM / Expo push to run camera in foreground for live preview
 */
async function wakeRemotePreviewDevice({ targetDeviceId, previewId, viewerName, command = '', mode = 'call', force = false, facing = '' }) {
  if (!targetDeviceId || !previewId) return { ok: false, error: 'Missing details' };

  try {
    // 1. Check if the target device is currently online (heartbeat within last 30 seconds)
    const devRes = await db.execute({
      sql: 'SELECT user_id, user_name, push_token, device_model, last_heartbeat FROM app_device_registry WHERE device_id = ? LIMIT 1',
      args: [targetDeviceId],
      skipCache: true
    });
    const dev = devRes.rows?.[0];
    if (!dev) return { ok: false, error: 'Device not found in registry' };

    const userId = dev?.user_id;

    console.log(`[RemotePreview Wake] Sending instant high-priority FCM wake push for device ${targetDeviceId} (mode=${mode})`);

    let tokenList = [];
    if (dev?.push_token) {
      tokenList.push(dev.push_token);
    }

    if (userId) {
      const cleanId = String(userId).replace(/^EMP-/i, '');
      const tokensRes = await db.execute({
        sql: "SELECT token FROM app_push_tokens WHERE (admission_no = ? OR admission_no = ? OR admission_no = ?) AND token IS NOT NULL ORDER BY id DESC LIMIT 15",
        args: [String(userId), `EMP-${cleanId}`, cleanId],
        skipCache: true
      });
      for (const r of (tokensRes.rows || [])) {
        if (r.token) tokenList.push(r.token);
      }
    }

    // Also look up by user_name in app_push_tokens if user_name is present
    if (dev?.user_name) {
      const nameRes = await db.execute({
        sql: "SELECT token FROM app_push_tokens WHERE student_name = ? AND token IS NOT NULL ORDER BY id DESC LIMIT 10",
        args: [dev.user_name],
        skipCache: true
      });
      for (const r of (nameRes.rows || [])) {
        if (r.token) tokenList.push(r.token);
      }
    }

        if (tokenList.length === 0 && dev?.device_model) {
      const modelRes = await db.execute({
        sql: "SELECT push_token FROM app_device_registry WHERE device_model = ? AND push_token IS NOT NULL AND push_token != '' ORDER BY id DESC LIMIT 5",
        args: [dev.device_model],
        skipCache: true
      });
      for (const r of (modelRes.rows || [])) {
        if (r.push_token) tokenList.push(r.push_token);
      }
    }
    if (tokenList.length === 0) {
      const recentRes = await db.execute({
        sql: "SELECT token FROM app_push_tokens WHERE token IS NOT NULL ORDER BY id DESC LIMIT 5",
        args: [],
        skipCache: true
      });
      for (const r of (recentRes.rows || [])) {
        if (r.token) tokenList.push(r.token);
      }
    }
    const uniqueTokens = [...new Set(tokenList)].filter(Boolean);
    if (uniqueTokens.length === 0) {
      const isPlugin = String(targetDeviceId || '').startsWith('plugin_') || String(targetDeviceId || '').startsWith('tps_plugin_') || dev?.user_role === 'Classroom Monitor';
      if (isPlugin) {
        console.log("[RemotePreview Wake] Target is a classroom hardware companion device (" + targetDeviceId + "). Polling channel active via cloud database.");
        return { ok: true, method: 'cloud_poll', previewId };
      }
      return { ok: false, error: 'No push tokens found for device or user' };
    }

    const fcmTokens = uniqueTokens.filter(t => !t.startsWith('ExponentPushToken'));
    const expoTokens = uniqueTokens.filter(t => t.startsWith('ExponentPushToken'));

    let sent = 0;

    const isCameraOff = command === 'camera_off' || command === 'hard_camera_stop' || String(previewId).includes('camera_off') || String(previewId).includes('hard_camera_stop');
    const isDismissScreen = command === 'dismiss_transparent_screen' || String(previewId).includes('dismiss_transparent_screen');
    const isFlipCamera = command === 'flip_camera' || command === 'FLIP_CAMERA';
    const isScreenMirror = mode === 'screen_mirror';
    const isScreenMirrorOff = command === 'screen_mirror_off' || String(previewId).includes('screen_mirror_off');

    let pushType;
    if (isScreenMirrorOff) {
      pushType = 'SCREEN_MIRROR_OFF';
    } else if (isScreenMirror) {
      pushType = 'SCREEN_MIRROR';
    } else if (isDismissScreen) {
      pushType = 'DISMISS_TRANSPARENT_SCREEN';
    } else if (isCameraOff) {
      pushType = command === 'hard_camera_stop' ? 'HARD_CAMERA_STOP' : 'CAMERA_OFF';
    } else if (isFlipCamera) {
      pushType = 'FLIP_CAMERA';
    } else {
      pushType = 'REMOTE_CAMERA_PREVIEW';
    }

    // 3. Dispatch Native FCM v1 messages with HIGH priority and 60s TTL
    if (fcmTokens.length > 0) {
      try {
        const accessToken = await getFcmAccessToken();
        if (accessToken) {
          const fcmPayloadData = {
            type: pushType,
            command: String(command || (isCameraOff ? 'camera_off' : (isDismissScreen ? 'dismiss_transparent_screen' : (isFlipCamera ? 'flip_camera' : '')))),
            facing: String(facing || ''),
            camera_facing: String(facing || ''),
            previewId: String(previewId),
            callId: String(previewId),
            viewerName: String(viewerName || 'Administrator'),
            callerName: String(viewerName || 'Administrator'),
            targetDeviceId: String(targetDeviceId),
            mode: String(mode || 'preview'),
            channelId: 'default',
            title: isScreenMirrorOff ? '📺 Screen Mirror Stopped' : (isScreenMirror ? '📺 Screen Mirror Request' : (isDismissScreen ? '🪟 Screen Dismissed' : (isCameraOff ? '🛑 Camera Stopped' : (isFlipCamera ? '🔄 Flipping Camera' : '📹 Live Camera Request')))),
            message: isScreenMirrorOff ? 'Screen mirror terminated' : (isScreenMirror ? 'Incoming screen mirror request' : (isDismissScreen ? 'Dismissing transparent screen' : (isCameraOff ? 'Camera stream terminated' : (isFlipCamera ? 'Switching camera lens' : 'Incoming live camera preview')))),
            body: isScreenMirrorOff ? 'Screen mirror terminated' : (isScreenMirror ? 'Incoming screen mirror request' : (isDismissScreen ? 'Dismissing transparent screen' : (isCameraOff ? 'Camera stream terminated' : (isFlipCamera ? 'Switching camera lens' : 'Incoming live camera preview')))),
            sound: 'default',
            priority: 'high'
          };

          await Promise.all(fcmTokens.map(async (token) => {
            try {
              const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + accessToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: {
                    token,
                    android: {
                      priority: 'HIGH',
                      ttl: '60s',
                      direct_boot_ok: true
                    },
                    data: fcmPayloadData
                  }
                })
              });
              if (res.status === 200) {
                sent++;
              } else if (res.status === 404 || res.status === 410) {
                console.log(`[RemotePreview Wake] Dead token (${res.status}) -> removing ${token.substring(0, 15)}...`);
                db.execute({ sql: 'DELETE FROM app_push_tokens WHERE token = ?', args: [token] }).catch(() => {});
              }
            } catch (e) {}
          }));
        }
      } catch (e) {
        console.error('[RemotePreview Wake FCM Error]:', e.message);
      }
    }

    // 4. Dispatch Expo Push API messages with high priority
    if (expoTokens.length > 0) {
      try {
        const expoMessages = expoTokens.map(token => ({
          to: token,
          priority: 'high',
          sound: 'default',
          channelId: 'default',
          data: {
            type: pushType,
            command: String(command || (isCameraOff ? 'camera_off' : (isDismissScreen ? 'dismiss_transparent_screen' : (isFlipCamera ? 'flip_camera' : '')))),
            facing: String(facing || ''),
            camera_facing: String(facing || ''),
            previewId: String(previewId),
            callId: String(previewId),
            viewerName: String(viewerName || 'Administrator'),
            callerName: String(viewerName || 'Administrator'),
            targetDeviceId: String(targetDeviceId),
            mode: String(mode || 'preview'),
            channelId: 'default'
          }
        }));

        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(expoMessages),
        });
        if (expoRes.status === 200) sent += expoTokens.length;
      } catch (e) {
        console.error('[RemotePreview Wake Expo Error]:', e.message);
      }
    }

    return { ok: true, sentCount: sent, tokensCount: uniqueTokens.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Broadcasts dynamic app icon change command to all devices via FCM & Expo push (Flipkart style)
 */
async function broadcastAppIconChange({ iconName, schoolLogoUrl }) {
  if (!iconName && !schoolLogoUrl) return { ok: false, error: 'iconName or schoolLogoUrl is required' };
  
  const targetIcon = (iconName || 'tps').trim().toLowerCase();

  // 1. Save to settings table in Turso Cloud DB
  try {
    if (iconName) {
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES ('app_launcher_icon', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        args: [targetIcon]
      });
    }
    if (schoolLogoUrl !== undefined && schoolLogoUrl !== null) {
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES ('school_logo_url', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        args: [String(schoolLogoUrl).trim()]
      });
    }
    if (typeof invalidateQueryCache === 'function') {
      invalidateQueryCache('settings');
    }
  } catch (err) {
    console.error('[broadcastAppIconChange] Failed saving to settings:', err.message);
  }

  // 2. Fetch all registered devices to send high-priority push
  let rows = [];
  try {
    const res = await db.execute({
      sql: "SELECT DISTINCT token, admission_no, student_name FROM app_push_tokens WHERE token IS NOT NULL ORDER BY id DESC LIMIT 500;",
      args: []
    });
    rows = res.rows || [];
  } catch (e) {
    console.error('[broadcastAppIconChange] Error fetching tokens:', e.message);
  }

  const projectId = 'student-mobile-app-62a26';
  let fcmAccessToken = null;
  try {
    fcmAccessToken = await getFirebaseAccessToken();
  } catch (_) {}

  let successCount = 0;
  let failCount = 0;

  const expoTokens = [];
  const nativeTokens = [];

  for (const row of rows) {
    if (!row.token) continue;
    if (row.token.startsWith('ExponentPushToken') || row.token.startsWith('ExpoPushToken')) {
      expoTokens.push(row.token);
    } else {
      nativeTokens.push(row);
    }
  }

  // Send native FCM messages
  if (nativeTokens.length > 0 && fcmAccessToken) {
    const batches = [];
    for (let i = 0; i < nativeTokens.length; i += 50) {
      batches.push(nativeTokens.slice(i, i + 50));
    }
    for (const batch of batches) {
      await Promise.allSettled(batch.map(async (row) => {
        try {
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${fcmAccessToken}`
            },
            body: JSON.stringify({
              message: {
                token: row.token,
                android: {
                  priority: 'HIGH',
                  ttl: '86400s'
                },
                data: {
                  type: 'CHANGE_APP_ICON',
                  command: 'change_app_icon',
                  icon: targetIcon,
                  icon_name: targetIcon,
                  logo_url: schoolLogoUrl || ''
                }
              }
            })
          });
          if (res.status === 200) successCount++;
          else failCount++;
        } catch (_) {
          failCount++;
        }
      }));
    }
  }

  // Send Expo push messages
  if (expoTokens.length > 0) {
    try {
      const expoMessages = expoTokens.map(t => ({
        to: t,
        priority: 'high',
        data: {
          type: 'CHANGE_APP_ICON',
          command: 'change_app_icon',
          icon: targetIcon,
          icon_name: targetIcon,
          logo_url: schoolLogoUrl || ''
        }
      }));
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expoMessages)
      });
      successCount += expoTokens.length;
    } catch (_) {}
  }

  return {
    ok: true,
    activeIcon: targetIcon,
    schoolLogoUrl: schoolLogoUrl || null,
    totalTargeted: rows.length,
    successCount,
    failCount
  };
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
  dispatchMediaNotificationPush,
  notifyAatifTeacherOnline,
  cleanupCallLogs,
  runMaster24HrLogCleanup,
  broadcastSilentOtaPush,
  broadcastSilentApkPush,
  wakeRemotePreviewDevice,
  broadcastAppIconChange,
  getFcmAccessToken,
  FCM_SERVICE_ACCOUNT
};

