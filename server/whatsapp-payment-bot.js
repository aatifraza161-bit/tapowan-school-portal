const { db } = require('./db-sqlite');

const DEFAULT_SETTINGS = {
  authorizedNumbers: [],
  approvalPassword: "",
  autoNotifyAdmin: true,
  autoNotifyStudent: true
};

const KNOWN_LID_TO_PHONE = {
  "211720798793831": "917488061954",
  "211720798793831@lid": "917488061954"
};

function resolveSenderPhone(sender) {
  if (!sender) return "";
  const s = String(sender).trim();
  const digits = s.replace(/\D/g, "");
  if (KNOWN_LID_TO_PHONE[s]) return KNOWN_LID_TO_PHONE[s];
  if (KNOWN_LID_TO_PHONE[digits]) return KNOWN_LID_TO_PHONE[digits];
  if (digits.length === 10) return "91" + digits;
  return digits || s;
}

/**
 * Normalize any phone number format into clean standard digits (e.g. "919876543210")
 */
function normalizePhoneNumber(phone) {
  if (!phone) return "";
  let str = String(phone).trim();
  if (str.includes('@lid') || str.includes('@s.whatsapp.net')) {
    str = resolveSenderPhone(str);
  }
  let digits = str.replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "91" + digits;
  }
  return digits;
}

/**
 * Check if a given phone number is in the authorized numbers list
 */
function isNumberAuthorized(phone, authorizedList) {
  const resolved = resolveSenderPhone(phone);
  const norm = normalizePhoneNumber(resolved);
  if (!norm || !Array.isArray(authorizedList) || authorizedList.length === 0) return false;
  return authorizedList.some(auth => {
    const normAuth = normalizePhoneNumber(auth);
    return norm === normAuth || norm.endsWith(normAuth) || normAuth.endsWith(norm);
  });
}

/**
 * Get Access Control Settings STRICTLY from settings table in database
 */
async function getAccessControlSettings() {
  try {
    const res = await db.execute({
      sql: "SELECT value FROM settings WHERE key = 'online_payments_access_control' LIMIT 1",
      args: []
    });
    if (res.rows.length > 0 && res.rows[0].value) {
      const parsed = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
      return {
        authorizedNumbers: Array.isArray(parsed.authorizedNumbers) ? parsed.authorizedNumbers : [],
        approvalPassword: parsed.approvalPassword || "",
        autoNotifyAdmin: parsed.autoNotifyAdmin !== false,
        autoNotifyStudent: parsed.autoNotifyStudent !== false
      };
    }
  } catch (err) {
    console.error("[WhatsAppBot] getAccessControlSettings error:", err.message);
  }
  return {
    authorizedNumbers: [],
    approvalPassword: "",
    autoNotifyAdmin: true,
    autoNotifyStudent: true
  };
}

/**
 * Save Access Control Settings to settings table
 */
async function saveAccessControlSettings(newSettings, updatedBy = 'admin') {
  try {
    const jsonStr = JSON.stringify({
      authorizedNumbers: Array.isArray(newSettings.authorizedNumbers) ? newSettings.authorizedNumbers : [],
      approvalPassword: String(newSettings.approvalPassword || 'admin').trim(),
      autoNotifyAdmin: newSettings.autoNotifyAdmin !== false,
      autoNotifyStudent: newSettings.autoNotifyStudent !== false
    });

    const existing = await db.execute({
      sql: "SELECT id FROM settings WHERE key = 'online_payments_access_control' LIMIT 1",
      args: []
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: "UPDATE settings SET value = ?, updatedBy = ? WHERE key = 'online_payments_access_control'",
        args: [jsonStr, updatedBy]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO settings (key, value, category, updatedBy) VALUES ('online_payments_access_control', ?, 'Finance', ?)",
        args: [jsonStr, updatedBy]
      });
    }
    return { ok: true };
  } catch (err) {
    console.error("[WhatsAppBot] saveAccessControlSettings error:", err.message);
    throw err;
  }
}

/**
 * Extract payment fields from an SQL INSERT statement
 */
function extractPaymentDataFromInsert(sql, args) {
  try {
    const colMatch = (sql || '').match(/INSERT\s+INTO\s+app_online_payments\s*\(([^)]+)\)/i);
    if (colMatch && Array.isArray(args) && args.length > 0) {
      const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase().replace(/[`"']/g, ''));
      const data = {};
      cols.forEach((col, idx) => {
        if (idx < args.length) {
          data[col] = args[idx];
        }
      });
      return {
        admission_no: data.admission_no || data.admissionno || data.admno || '',
        student_name: data.student_name || data.studentname || data.name || '',
        class_name: data.class_name || data.classname || data.class || '',
        roll_no: data.roll_no || data.rollno || '',
        amount: data.amount || '0',
        payment_method: data.payment_method || data.paymentmethod || 'UPI',
        utr_number: data.utr_number || data.utr || '',
        payId: data.payid || data.payId || ''
      };
    }
  } catch (e) {
    console.warn("[extractPaymentDataFromInsert error]", e.message);
  }
  return null;
}

/**
 * Send WhatsApp message using Baileys socket or Cloud Gateway
 */
async function sendWhatsAppMessage(toPhone, messageText, waSock = null) {
  const target = String(toPhone || '').trim();
  if (!target || !messageText) return false;
  const normPhone = normalizePhoneNumber(target);

  // 1. If local Baileys socket is available and connected
  if (waSock && typeof waSock.sendMessage === 'function') {
    try {
      let jid;
      if (target.includes('@lid') || target.includes('@s.whatsapp.net')) {
        jid = target;
      } else if (normPhone.length > 13) {
        jid = `${normPhone}@lid`;
      } else {
        jid = `${normPhone}@s.whatsapp.net`;
      }
      await waSock.sendMessage(jid, { text: messageText });
      console.log(`[WhatsAppBot] Sent via Baileys to ${jid}`);
      return true;
    } catch (err) {
      console.warn(`[WhatsAppBot] Baileys send failed:`, err.message);
    }
  }

  // 2. Fallback to Cloud Gateway with retry (handles free tier cold-start)
  const gatewayUrl = process.env.WHATSAPP_GATEWAY_URL || 'https://tapowan-whatsapp-gateway.onrender.com';
  if (gatewayUrl) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

        const gwRes = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.WHATSAPP_GATEWAY_KEY || 'tps_secret_gateway_key_2026',
            'x-admin-pin': process.env.WHATSAPP_GATEWAY_PIN || 'tapowan2026'
          },
          body: JSON.stringify({ to: target, message: messageText }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await gwRes.json();
        if (data && data.ok) {
          console.log(`[WhatsAppBot] Sent via Cloud Gateway to ${target} (attempt ${attempt})`);
          return true;
        } else {
          console.warn(`[WhatsAppBot] Cloud Gateway returned error on attempt ${attempt}:`, data);
        }
      } catch (e) {
        console.warn(`[WhatsAppBot] Cloud Gateway attempt ${attempt} failed:`, e.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }
  return false;
}

/**
 * Send WhatsApp Alert to All Authorized Admins upon New Payment Submission
 */
async function notifyAdminNewPayment(paymentData, waSock = null) {
  try {
    const settings = await getAccessControlSettings();
    if (!settings.autoNotifyAdmin || !settings.authorizedNumbers || settings.authorizedNumbers.length === 0) {
      return { ok: false, reason: "Admin notifications disabled or no numbers configured" };
    }

    const {
      id = null,
      admission_no = "N/A",
      student_name = "Student",
      class_name = "N/A",
      roll_no = "",
      amount = "0",
      payment_method = "UPI",
      utr_number = "",
      payId = ""
    } = paymentData || {};

    // Deduplication check: Do not send if alert was already sent for this exact UTR number
    if (utr_number && utr_number !== 'N/A') {
      const existing = await db.execute({
        sql: "SELECT id FROM app_online_payments WHERE utr_number = ? AND alert_sent = 1 LIMIT 1",
        args: [utr_number]
      });
      if (existing.rows && existing.rows.length > 0) {
        console.log(`[WhatsAppBot] Alert already sent previously for UTR: ${utr_number}. Skipping duplicate.`);
        return { ok: true, sentCount: 0, reason: "Alert already sent" };
      }
    }

    const utrStr = utr_number ? utr_number : (payId || 'N/A');
    const nowStr = new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const alertMessage = 
`🔔 *${(process.env.SCHOOL_NAME || 'School').toUpperCase()} — NEW PAYMENT ALERT*
───────────────────────────────
👤 *Student:* ${student_name}
🎓 *Class:* ${class_name}${roll_no ? ` | *Roll:* ${roll_no}` : ''}
🆔 *Admission No:* ${admission_no}
💰 *Amount:* ₹${Number(amount || 0).toLocaleString('en-IN')}
📱 *Mode:* ${payment_method || 'Online UPI'}
🔢 *UTR / Ref No:* \`${utrStr}\`
${payId ? `🧾 *Pay ID:* \`${payId}\`\n` : ''}📅 *Time:* ${nowStr}
───────────────────────────────
⚡ *Quick Auto-Approve Command:*
Reply to this message with:
\`APPROVE ${utrStr} ${settings.approvalPassword || '<PASSWORD>'}\`
_Or reply:_ \`${utrStr} ${settings.approvalPassword || '<PASSWORD>'}\`
───────────────────────────────
_${schoolName || 'School'} — Online Finance Gateway_`;

    let sentCount = 0;
    for (const adminPhone of settings.authorizedNumbers) {
      const ok = await sendWhatsAppMessage(adminPhone, alertMessage, waSock);
      if (ok) sentCount++;
    }

    // Mark alert_sent = 1 immediately for this specific payment record
    if (utr_number || id) {
      try {
        await db.execute({
          sql: "UPDATE app_online_payments SET alert_sent = 1 WHERE (id = ? OR utr_number = ?)",
          args: [id || -1, utr_number || '']
        });
      } catch (e) {}
    }

    return { ok: true, sentCount };
  } catch (err) {
    console.error("[WhatsAppBot] notifyAdminNewPayment error:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Execute official payment approval & reconciliation in DB
 */
async function executePaymentApproval(payment, verifiedBy = 'WhatsApp Auto-Approve') {
  const paymentId = payment.id;
  const admNo = String(payment.admission_no || '').trim();
  const studentName = String(payment.student_name || '').trim();
  const className = String(payment.class_name || '').trim();
  const utr = String(payment.utr_number || '').trim();
  const amountNum = parseFloat(payment.amount) || 0;
  const duePayId = payment.payId || payment.payid || '';
  const method = `Online UPI (${payment.payment_method || 'UPI'}${utr ? ' - UTR: ' + utr : ''})`;
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toLocaleString('en-US', { month: 'short' });

  // 1. Mark app_online_payments as Approved
  await db.execute({
    sql: "UPDATE app_online_payments SET status = 'Approved', verified_at = CURRENT_TIMESTAMP, verified_by = ? WHERE id = ?",
    args: [verifiedBy, paymentId]
  });

  // 2. Look up student in students table for fatherName, rollNo, phone
  const stRes = await db.execute({
    sql: "SELECT * FROM students WHERE admissionNo = ? OR fullName = ? LIMIT 1",
    args: [admNo, studentName]
  });
  const stRow = stRes.rows[0] || {};
  const fatherName = stRow.fatherName || stRow.fathername || 'Parent';
  const rollNo = stRow.rollNo || stRow.rollno || payment.roll_no || 1;
  const studentPhone = stRow.phone || stRow.phone1 || stRow.whatsapp || '';

  // 3. Find EXACT matching due in duemanagement table
  let targetDueRow = null;
  if (duePayId) {
    const byPayId = await db.execute({
      sql: "SELECT * FROM duemanagement WHERE payid = ? LIMIT 1",
      args: [duePayId]
    });
    if (byPayId.rows.length > 0) {
      targetDueRow = byPayId.rows[0];
    }
  }

  // If not found by payId, find the single oldest pending due row matching student
  if (!targetDueRow && (admNo || studentName)) {
    const dueRes = await db.execute({
      sql: "SELECT * FROM duemanagement WHERE (admissionNo = ? OR studentName = ?) AND (status = 'Pending' OR status = 'unpaid' OR status = 'Unpaid' OR status = 'due') ORDER BY id ASC LIMIT 1",
      args: [admNo, studentName]
    });
    if (dueRes.rows.length > 0) {
      targetDueRow = dueRes.rows[0];
    }
  }

  let feeParticulars = targetDueRow?.particulars || 'Tuition Fee';
  if (feeParticulars.includes(' of ')) {
    feeParticulars = feeParticulars.split(' of ')[0].trim();
  }
  const feeSession = targetDueRow?.session || '2026-27';
  const feeMonth = targetDueRow?.month || currentMonth;

  // 4. Find next primary ID for fees table
  const maxRes = await db.execute("SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS nextId FROM fees WHERE id IS NOT NULL;");
  const nextFeeId = maxRes.rows[0]?.nextId ? Number(maxRes.rows[0].nextId) : (Date.now() % 1000000);

  // 5. Generate fresh unique receipt payId and insert official record into fees table
  const { generateUniquePayId } = require('./db-sqlite');
  const receiptPayId = await generateUniquePayId('fees');

  await db.execute({
    sql: `INSERT INTO fees (id, admissionno, studentname, classname, rollno, fathername, term, month, feetypes, tuitionfee, totalfee, paidamount, balance, status, paymentdate, paymentmethod, onlineamount, cashamount, payid) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Paid', ?, ?, ?, 0, ?)`,
    args: [nextFeeId, admNo, studentName, className, rollNo, fatherName, feeSession, feeMonth, feeParticulars, amountNum, amountNum, amountNum, today, method, amountNum, receiptPayId]
  });

  // 6. Reconcile ONLY the exact single due record matching this payment
  if (targetDueRow && targetDueRow.id) {
    const dueAmt = Number(targetDueRow.dueamount || 0);
    const prevPaid = Number(targetDueRow.paidamount || 0);
    const newPaid = prevPaid + amountNum;
    const newBal = Math.max(0, dueAmt - newPaid);
    const newStatus = newBal === 0 ? 'Paid' : 'Pending';

    if (newBal === 0) {
      await db.execute({
        sql: `DELETE FROM duemanagement WHERE id = ?`,
        args: [targetDueRow.id]
      });
    } else {
      await db.execute({
        sql: `UPDATE duemanagement 
              SET status = ?, paidAmount = ?, balance = ?, remarks = COALESCE(remarks, '') || ' [Paid via UTR: ' || ? || ']'
              WHERE id = ?`,
        args: [newStatus, newPaid, newBal, utr || payId, targetDueRow.id]
      });
    }
  }

  return {
    ok: true,
    feeId: nextFeeId,
    studentName,
    admNo,
    className,
    amountNum,
    utr,
    payId,
    studentPhone
  };
}

// ── Message Deduplication & Echo-Loop Protection Cache ──
const processedMessagesCache = new Map();
function isDuplicateOrEcho(phone, text) {
  const key = `${phone}:${text}`;
  const now = Date.now();
  const lastSeen = processedMessagesCache.get(key);
  if (lastSeen && (now - lastSeen) < 5000) {
    return true;
  }
  processedMessagesCache.set(key, now);
  if (processedMessagesCache.size > 200) {
    for (const [k, v] of processedMessagesCache.entries()) {
      if (now - v > 60000) processedMessagesCache.delete(k);
    }
  }
  return false;
}

const RESERVED_WORDS = new Set([
  'APPROVE', 'APPROVED', 'STATUS', 'ALL', 'OK', 'YES', 'NO', 'PAY', 'VERIFY',
  'AUTHENTICATION', 'FAILED', 'INVALID', 'PASSWORD', 'PLEASE', 'VERIFY', 'YOUR',
  'TRY', 'AGAIN', 'EXAMPLE', 'TAPOWAN', 'PUBLIC', 'SCHOOL', 'STUDENT', 'AMOUNT',
  'CLASS', 'DATE', 'ALERT', 'RECEIPT', 'NAME', 'FEES', 'FEE', 'FOR', 'WITH', 'AND', 'ERROR'
]);

/**
 * Handle Inbound WhatsApp Message from Admin / Baileys / Webhook
 */
async function processInboundWhatsAppMessage(senderPhone, rawMessageText, waSock = null) {
  const text = (rawMessageText || "").trim();
  if (!text) return { ok: false, reason: "Empty message" };

  // 1. CRITICAL: Immediately ignore bot's own system replies / broadcasts to prevent echo loops
  if (
    text.startsWith('❌') ||
    text.startsWith('✅') ||
    text.startsWith('🔔') ||
    text.startsWith('🎉') ||
    text.startsWith('⚠️') ||
    text.startsWith('ℹ️') ||
    text.startsWith('📋') ||
    text.startsWith('🏫') ||
    text.includes('TAPOWAN PUBLIC SCHOOL') ||
    text.includes('AUTHENTICATION FAILED') ||
    text.includes('PAYMENT APPROVED') ||
    text.includes('PAYMENT RECORD NOT FOUND') ||
    text.includes('NO PENDING PAYMENTS') ||
    text.includes('ALL PAYMENTS APPROVED') ||
    text.includes('Example: APPROVE') ||
    text.includes('Invalid approval password')
  ) {
    console.log(`[WhatsAppBot] Ignored bot system message reflection from ${senderPhone}.`);
    return { ok: false, reason: "Ignored bot output message" };
  }

  // 2. Message Deduplication Check (Prevents rapid duplicate triggers within 5s)
  if (isDuplicateOrEcho(senderPhone, text)) {
    console.log(`[WhatsAppBot] Duplicate message ignored from ${senderPhone}`);
    return { ok: false, reason: "Duplicate message within 5 seconds" };
  }

  const settings = await getAccessControlSettings();
  const configuredPass = String(settings.approvalPassword || "").trim();
  const cleanTokens = text.replace(/[:,#*`_]/g, ' ').split(/\s+/).filter(Boolean);
  if (cleanTokens.length < 1) return { ok: false, reason: "No tokens" };

  // 3. Strict 2FA Whitelist Enforcement: SENDER MUST BE AN AUTHORIZED ADMIN NUMBER
  const resolvedPhone = resolveSenderPhone(senderPhone);
  const isAuthNumber = isNumberAuthorized(resolvedPhone, settings.authorizedNumbers);

  if (!isAuthNumber) {
    console.log(`[WhatsAppBot] 🛑 BLOCKED unauthorized sender: ${senderPhone} (resolved: ${resolvedPhone}). Message: "${text}"`);
    return { ok: false, reason: "Unauthorized sender: Mobile number is not in authorized admin list" };
  }

  const firstTokenUpper = cleanTokens[0].toUpperCase();

  // ── Command: STATUS [PASSWORD] ──
  if (firstTokenUpper === "STATUS") {
    const pass = cleanTokens[1] || "";
    if (configuredPass && pass && pass.toLowerCase() !== configuredPass.toLowerCase()) {
      const errReply = `❌ *AUTHENTICATION FAILED*\nInvalid approval password.`;
      await sendWhatsAppMessage(senderPhone, errReply, waSock);
      return { ok: false, reason: "Invalid password" };
    }

    const pendingRes = await db.execute({
      sql: "SELECT id, student_name, admission_no, amount, utr_number, payId, created_at FROM app_online_payments WHERE status LIKE '%Pending%' OR status LIKE '%Unverified%' ORDER BY id DESC LIMIT 10",
      args: []
    });

    if (pendingRes.rows.length === 0) {
      const reply = `✅ *NO PENDING PAYMENTS*\nAll online payments have been approved and reconciled!`;
      await sendWhatsAppMessage(senderPhone, reply, waSock);
      return { ok: true, message: reply };
    }

    let listStr = `📋 *PENDING UPI PAYMENTS (${pendingRes.rows.length})*\n───────────────────────────────\n`;
    pendingRes.rows.forEach((p, idx) => {
      listStr += `${idx + 1}. *${p.student_name}* (Adm: ${p.admission_no}) — *₹${p.amount}*\n   UTR: \`${p.utr_number || p.payId || 'N/A'}\`\n`;
    });
    listStr += `───────────────────────────────\nReply \`APPROVE <UTR> ${configuredPass}\` or \`APPROVE\` to approve.`;

    await sendWhatsAppMessage(senderPhone, listStr, waSock);
    return { ok: true, message: listStr };
  }

  // ── Command: APPROVE ALL [PASSWORD] ──
  if (firstTokenUpper === "APPROVE" && cleanTokens[1] && cleanTokens[1].toUpperCase() === "ALL") {
    const pass = cleanTokens[2] || "";
    if (configuredPass && pass && pass.toLowerCase() !== configuredPass.toLowerCase()) {
      const errReply = `❌ *AUTHENTICATION FAILED*\nInvalid approval password.`;
      await sendWhatsAppMessage(senderPhone, errReply, waSock);
      return { ok: false, reason: "Invalid password" };
    }

    const pendingRes = await db.execute({
      sql: "SELECT * FROM app_online_payments WHERE status LIKE '%Pending%' OR status LIKE '%Unverified%'",
      args: []
    });

    if (pendingRes.rows.length === 0) {
      const reply = `ℹ️ No pending online payments found to approve.`;
      await sendWhatsAppMessage(senderPhone, reply, waSock);
      return { ok: true, message: reply };
    }

    let approvedCount = 0;
    let totalAmt = 0;
    for (const p of pendingRes.rows) {
      try {
        const displayPhone = resolveSenderPhone(senderPhone);
        await executePaymentApproval(p, `WhatsApp All (${displayPhone})`);
        approvedCount++;
        totalAmt += (parseFloat(p.amount) || 0);
      } catch (err) {
        console.error(`[WhatsAppBot] Approve All failed for ID ${p.id}:`, err.message);
      }
    }

    const reply = 
`🎉 *ALL PAYMENTS APPROVED SUCCESSFULLY!*
───────────────────────────────
✅ *Total Approved:* ${approvedCount} payments
💰 *Total Amount:* ₹${totalAmt.toLocaleString('en-IN')}
🏛️ Official receipts generated & dues cleared in database.
───────────────────────────────
_${schoolName || 'School'}_`;

    await sendWhatsAppMessage(senderPhone, reply, waSock);
    return { ok: true, approvedCount };
  }

  // ── Smart Approval: Support APPROVE <UTR>, <UTR> <PASSWORD>, <PAYID>, <NAME>, or just 'APPROVE' / 'OK' ──
  const nonCommandTokens = cleanTokens.filter(t => 
    (!configuredPass || t.toLowerCase() !== configuredPass.toLowerCase()) &&
    !['APPROVE', 'APPROVED', 'STATUS', 'ALL', 'OK', 'YES', 'NO', 'PAY', 'VERIFY', 'PAYMENT', 'PAYMENTS'].includes(t.toUpperCase()) &&
    !RESERVED_WORDS.has(t.toUpperCase())
  );

  // 1. Look for 10-14 digit UTR
  let targetRef = nonCommandTokens.find(t => /^\d{10,14}$/.test(t)) || "";

  // 2. Look for PayID or alphanumeric token (e.g. CSH04U, QMPY8X, SCKXKJ, ONLINE_...)
  if (!targetRef) {
    targetRef = nonCommandTokens.find(t => /^[A-Za-z0-9_-]{3,20}$/.test(t) && !RESERVED_WORDS.has(t.toUpperCase())) || "";
  }

  // 3. Look for student name keyword (e.g. "alima", "rehan", "anshu")
  let studentNameKeyword = "";
  if (!targetRef && nonCommandTokens.length > 0) {
    studentNameKeyword = nonCommandTokens.join(' ').trim();
  }

  // 4. If command is simply APPROVE / APPROVED / OK without a ref, grab latest pending payment
  if (!targetRef && !studentNameKeyword && (firstTokenUpper === "APPROVE" || firstTokenUpper === "APPROVED" || firstTokenUpper === "OK" || firstTokenUpper === "VERIFY" || firstTokenUpper === "YES")) {
    const latestPendingRes = await db.execute({
      sql: "SELECT * FROM app_online_payments WHERE status LIKE '%Pending%' OR status LIKE '%Unverified%' ORDER BY id DESC LIMIT 1",
      args: []
    });
    if (latestPendingRes.rows.length > 0) {
      const p = latestPendingRes.rows[0];
      targetRef = p.utr_number || p.payId || String(p.id);
    }
  }

  // If still nothing found
  if (!targetRef && !studentNameKeyword) {
    return { ok: false, reason: "Not an approval command" };
  }

  // Password verification: Check if an explicitly WRONG password was sent
  if (configuredPass) {
    const candidatePasswords = cleanTokens.filter(t => 
      t !== targetRef && 
      !['APPROVE', 'APPROVED', 'OK', 'VERIFY', 'YES', 'PAY', 'PAYMENT', 'PAYMENTS'].includes(t.toUpperCase()) &&
      !RESERVED_WORDS.has(t.toUpperCase())
    );
    if (candidatePasswords.length > 0) {
      const userProvidedPass = candidatePasswords.join('').replace(/\s+/g, '').toLowerCase();
      const actualPass = configuredPass.replace(/\s+/g, '').toLowerCase();
      // If the token is NOT the targetRef and does not match the actual password
      if (userProvidedPass !== actualPass && !userProvidedPass.includes(targetRef.toLowerCase())) {
        const errReply = 
`❌ *AUTHENTICATION FAILED*
Invalid approval password for \`${targetRef || studentNameKeyword}\`.
Please verify your password and try again. Example: \`APPROVE ${targetRef || 'UTR'} ${configuredPass}\``;
        await sendWhatsAppMessage(senderPhone, errReply, waSock);
        return { ok: false, reason: "Invalid password" };
      }
    }
  }

  const cleanRef = (targetRef || studentNameKeyword).trim();
  const searchRes = await db.execute({
    sql: `SELECT * FROM app_online_payments 
          WHERE (utr_number = ? OR payId = ? OR admission_no = ? OR id = ? OR student_name LIKE ?)
          ORDER BY (CASE WHEN status LIKE '%Pending%' OR status LIKE '%Unverified%' THEN 1 ELSE 2 END), id DESC LIMIT 1`,
    args: [cleanRef, cleanRef, cleanRef, isNaN(Number(cleanRef)) ? -1 : Number(cleanRef), `%${cleanRef}%`]
  });

  if (searchRes.rows.length === 0) {
    const notFoundReply = 
`⚠️ *PAYMENT RECORD NOT FOUND*
No payment submission was found matching reference: \`${cleanRef}\`.
Please verify the 12-digit UTR number or Pay ID.`;
    await sendWhatsAppMessage(senderPhone, notFoundReply, waSock);
    return { ok: false, reason: "Payment record not found" };
  }

  const payment = searchRes.rows[0];
  const isAlreadyApproved = String(payment.status || '').toLowerCase().includes('approved') || String(payment.status || '').toLowerCase().includes('paid');
  
  if (isAlreadyApproved) {
    const alreadyReply = 
`ℹ️ *PAYMENT ALREADY APPROVED*
Payment for *${payment.student_name}* (Adm: ${payment.admission_no}) of *₹${payment.amount}* with UTR \`${payment.utr_number || cleanRef}\` has already been approved.`;
    await sendWhatsAppMessage(senderPhone, alreadyReply, waSock);
    return { ok: true, reason: "Already approved" };
  }

  // Execute approval in DB
  const displayPhone = resolveSenderPhone(senderPhone);
  const result = await executePaymentApproval(payment, `WhatsApp (${displayPhone})`);

  const successAdminReply = 
`✅ *PAYMENT APPROVED & RECONCILED*
───────────────────────────────
👤 *Student:* ${result.studentName}
🎓 *Class:* ${result.className}
🆔 *Admission No:* ${result.admNo}
💰 *Amount:* ₹${Number(result.amountNum).toLocaleString('en-IN')}
🔢 *UTR:* \`${result.utr || cleanRef}\`
🧾 *Pay ID:* \`${result.payId}\`
🏛️ *Status:* Verified & Receipt Generated in Fees
💸 *Due Record:* Outstanding Cleared (Balance = ₹0)
───────────────────────────────
_${schoolName || 'School'} — Automated Finance Gateway_`;

  await sendWhatsAppMessage(senderPhone, successAdminReply, waSock);

  // Send WhatsApp Receipt to Student / Parent if phone available
  if (settings.autoNotifyStudent && result.studentPhone) {
    const studentReceiptMsg = 
`🏫 *${(process.env.SCHOOL_NAME || 'School').toUpperCase()}*
🎉 *FEE PAYMENT VERIFIED & APPROVED*
───────────────────────────────
Dear Parent / Student,
Your online fee payment has been successfully verified!

👤 *Student:* ${result.studentName}
🎓 *Class:* ${result.className}
🆔 *Admission No:* ${result.admNo}
💰 *Amount Paid:* ₹${Number(result.amountNum).toLocaleString('en-IN')}
🔢 *UTR Ref:* \`${result.utr || cleanRef}\`
📅 *Date:* ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
✨ *Status:* Fully Paid & Receipt Created

Thank you for your timely payment!
_${schoolName || 'School'}_`;

    await sendWhatsAppMessage(result.studentPhone, studentReceiptMsg, waSock);
  }

  return { ok: true, result };
}

/**
 * Auto-poll and notify any pending payments that haven't had an alert sent yet
 */
async function checkAndNotifyPendingPayments(waSock = null) {
  try {
    const pendingRes = await db.execute({
      sql: `SELECT * FROM app_online_payments 
            WHERE (status LIKE '%Pending%' OR status LIKE '%Unverified%') 
              AND (alert_sent IS NULL OR alert_sent = 0) 
            ORDER BY id ASC LIMIT 5`,
      args: []
    });

    if (!pendingRes.rows || pendingRes.rows.length === 0) {
      return { ok: true, notifiedCount: 0 };
    }

    let notifiedCount = 0;
    for (const payment of pendingRes.rows) {
      const result = await notifyAdminNewPayment(payment, waSock);
      if (result.ok && result.sentCount > 0) {
        await db.execute({
          sql: "UPDATE app_online_payments SET alert_sent = 1 WHERE id = ?",
          args: [payment.id]
        });
        notifiedCount++;
      }
    }
    return { ok: true, notifiedCount };
  } catch (err) {
    console.error("[WhatsAppBot] checkAndNotifyPendingPayments error:", err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getAccessControlSettings,
  saveAccessControlSettings,
  extractPaymentDataFromInsert,
  notifyAdminNewPayment,
  processInboundWhatsAppMessage,
  sendWhatsAppMessage,
  executePaymentApproval,
  checkAndNotifyPendingPayments
};
