/**
 * server/call-automation.js
 * ── Tapowan Public School Automated WebRTC Fee Reminder & IVR Calling Engine ──
 * 
 * Features:
 * 1. High-fidelity neural TTS proxy with auto-chunking (Hindi / English / Hinglish)
 * 2. Targeted Due Students Query (aggregated balances from duemanagement + students + app tokens)
 * 3. WebRTC Automated Call Initiation & High-Priority Ring Dispatch
 * 4. Interactive IVR Keypress Processing ('1' -> Official UPI Payment Link + Dynamic QR Code via WhatsApp)
 * 5. Call audit logging & campaign analytics in Turso Cloud (`app_ivr_call_logs`)
 */

const { db } = require('./db-sqlite');
const qrcode = require('qrcode');
const { initiateCall } = require('./calls');
const { sendWhatsAppMessage } = require('./whatsapp-payment-bot');

const SCHOOL_UPI_VPA = '6201167306@ucobank';
const SCHOOL_PAYEE_NAME = (process.env.SCHOOL_NAME || 'School').toUpperCase();
const SCHOOL_MERCHANT_CODE = '8299';
const SCHOOL_ORG_ID = '159028';

/**
 * Split text into chunks <= 150 characters along sentence boundaries
 */
function splitTextForTts(text, maxLen = 150) {
  if (!text || text.length <= maxLen) return [text];
  const parts = [];
  // Split on punctuation or commas
  const sentences = text.split(/([।?!.,;]+)/).filter(Boolean);
  let current = '';

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if ((current + s).length <= maxLen) {
      current += s;
    } else {
      if (current.trim()) parts.push(current.trim());
      current = s;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length > 0 ? parts : [text.substring(0, maxLen)];
}

/**
 * Fetch a single Google TTS chunk as an MP3 Buffer
 */
async function fetchTtsChunk(text, lang = 'hi') {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/'
    }
  });
  if (!resp.ok) {
    throw new Error(`Google TTS error: HTTP ${resp.status}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

/**
 * 1. Stream TTS Audio for Web Audio / WebRTC Mixing
 */
async function handleTtsAudio(req, res) {
  try {
    const rawText = String(req.query.text || req.query.q || '').trim();
    const lang = String(req.query.lang || 'hi').trim().toLowerCase();

    if (!rawText) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    const chunks = splitTextForTts(rawText, 140);
    const audioBuffers = [];

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const buf = await fetchTtsChunk(chunk, lang);
      audioBuffers.push(buf);
    }

    const combined = Buffer.concat(audioBuffers);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h client cache
    res.setHeader('Content-Length', combined.length);
    res.send(combined);
  } catch (err) {
    console.error('[CallAutomation TTS Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate voice audio: ' + err.message });
  }
}

/**
 * 2. Get Target Students with Pending Dues
 */
async function getTargetStudentsWithDues({ className = '', minDue = 0, search = '' } = {}) {
  try {
    let whereClauses = ["d.status IN ('Pending', 'Partial')", "CAST(d.balance AS REAL) > 0"];
    let args = [];

    if (className && className !== 'All') {
      whereClauses.push("(d.className = ? OR s.className = ?)");
      args.push(className, className);
    }

    if (minDue && Number(minDue) > 0) {
      whereClauses.push("CAST(d.balance AS REAL) >= ?");
      args.push(Number(minDue));
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
        COALESCE(s.phone, s.phone1, '') as phone,
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

    const res = await db.execute({ sql, args, skipCache: true });
    const students = res.rows || [];

    // Check which students have active push tokens / TPS app installed
    if (students.length > 0) {
      const admList = students.map(st => st.admissionNo || st.admissionno).filter(Boolean);
      const phs = admList.map(() => '?').join(',');
      const tokenRes = await db.execute({
        sql: `SELECT DISTINCT admission_no FROM app_push_tokens WHERE admission_no IN (${phs})`,
        args: admList,
        skipCache: true
      });
      const registeredSet = new Set((tokenRes.rows || []).map(r => r.admission_no || r.admissionno));

      return students.map(st => {
        const adm = st.admissionNo || st.admissionno;
        return {
          admissionNo: adm,
          studentName: st.studentName || st.studentname,
          className: st.className || st.classname,
          phone: st.phone || '',
          rollNo: st.rollNo || st.rollno || '',
          totalDue: Math.round(Number(st.totalDue || st.totaldue || 0)),
          dueCount: Number(st.dueCount || st.duecount || 1),
          particularsSummary: st.particularsSummary || st.particularssummary || '',
          hasAppInstalled: registeredSet.has(adm)
        };
      });
    }

    return [];
  } catch (err) {
    console.error('[CallAutomation getTargetStudents Error]:', err.message);
    throw err;
  }
}

/**
 * 3. Formulate Speech and Acknowledgment Templates with Smart Name & Role Recognition
 */
function buildIvrScript({ studentName, className, dueAmount, lang = 'hi', admissionNo = '' }) {
  const cleanAmt = Math.round(Number(dueAmount || 0));
  const rawName = String(studentName || '').replace(/\s*\([^)]*\)/g, '').replace(/👨‍🏫|👩‍🏫|📞/g, '').trim();
  const sAdm = String(admissionNo || '').trim();
  const cName = String(className || '').trim();

  // Role detection: check if recipient is a Teacher or Faculty
  const isFaculty = Boolean(
    cName.toLowerCase() === 'faculty' ||
    cName.toLowerCase() === 'teacher' ||
    sAdm.startsWith('EMP-') ||
    rawName.toLowerCase().includes('teacher') ||
    rawName.toLowerCase().includes('sir') ||
    rawName.toLowerCase().includes('madam')
  );

  // Clean title words out of the name
  const cleanName = rawName
    .replace(/\b(teacher|sir|madam|miss|mr|mrs|shri|smt)\b/gi, '')
    .trim() || (isFaculty ? 'शिक्षक' : 'विद्यार्थी');

  // Devanagari transliteration map for 100% natural Indian Hindi TTS pronunciation
  const nameMapHi = {
    'aatif': 'आतिफ',
    'aatif raza': 'आतिफ रज़ा',
    'rizwan': 'रिज़वान',
    'rizwan teacher': 'रिज़वान',
    'sumant': 'सुमंत',
    'sunil': 'सुनील',
    'aliza': 'अलीज़ा',
    'snehlata': 'स्नेहलता',
    'ruhi': 'रूही'
  };
  const phoneticName = nameMapHi[cleanName.toLowerCase()] || cleanName;

  if (lang === 'en') {
    if (isFaculty) {
      return {
        speechText: `Hello ${cleanName} Sir! This is an automated fee reminder from ${schoolName}. Kindly clear the outstanding fee balance of ${cleanAmt} Rupees. Press 1 now to immediately receive your official payment link and UPI Q-R code on WhatsApp, or press 2 to speak with the school fee counter.`,
        ackText: `Thank you ${cleanName} Sir! Your payment link and official UPI Q-R code have been sent to your WhatsApp number. Have a great day!`
      };
    }
    return {
      speechText: `Hello! This is an automated fee reminder from ${schoolName} for student ${cleanName}, ${cName || 'Class'}. Your outstanding school fee balance is ${cleanAmt} Rupees. Press 1 now to immediately receive your official payment link and UPI Q-R code on WhatsApp, or press 2 to speak with the school fee counter.`,
      ackText: `Thank you! Your payment link and official UPI Q-R code have been sent to your WhatsApp number. Have a great day!`
    };
  } else if (lang === 'hinglish') {
    if (isFaculty) {
      return {
        speechText: `Namaste ${cleanName} Sir! Yeh ${schoolName} se fee reminder call hai. Aapki pending fee ${cleanAmt} rupaye clear karne ki request hai. WhatsApp payment link aur UPI Q-R code ke liye abhi 1 dabayein, ya school se baat karne ke liye 2 dabayein.`,
        ackText: `Dhanyawaad ${cleanName} Sir! Aapka payment link aur Q-R code aapke registered WhatsApp number par bhej diya gaya hai. Shubh din!`
      };
    }
    return {
      speechText: `Namaste! Yeh ${schoolName} se automated fee reminder call hai. Dear student ${cleanName}, ${cName || 'Class'}, aapki pending school fee ${cleanAmt} rupaye hai. Instant WhatsApp payment link aur UPI Q-R code paane ke liye abhi 1 dabayein, ya school se baat karne ke liye 2 dabayein.`,
      ackText: `Dhanyawaad! Aapka payment link aur Q-R code aapke registered WhatsApp number par bhej diya gaya hai. Shubh din!`
    };
  } else {
    // Default Hindi
    if (isFaculty) {
      return {
        speechText: `नमस्ते ${phoneticName} सर! यह तपोवन पब्लिक स्कूल से फीस रिमाइंडर कॉल है। आपकी बकाया राशि ${cleanAmt} रुपये क्लियर करने का अनुरोध है। तुरंत अपने व्हाट्सएप पर पेमेंट लिंक और यूपीआई क्यू-आर कोड प्राप्त करने के लिए अभी 1 दबाएं, या स्कूल फीस काउंटर से बात करने के लिए 2 दबाएं।`,
        ackText: `धन्यवाद ${phoneticName} सर! आपका पेमेंट लिंक और ऑफिशियल यूपीआई क्यू-आर कोड आपके व्हाट्सएप नंबर पर भेज दिया गया है। धन्यवाद!`
      };
    }
    return {
      speechText: `नमस्ते! यह तपोवन पब्लिक स्कूल से एक ऑटोमेटेड फीस सूचना है। प्रिय विद्यार्थी ${phoneticName}, ${cName ? 'कक्षा ' + cName + ',' : ''} आपकी कुल बकाया फीस ${cleanAmt} रुपये है। तुरंत अपने व्हाट्सएप पर पेमेंट लिंक और यूपीआई क्यू-आर कोड प्राप्त करने के लिए अभी 1 दबाएं, या स्कूल फीस काउंटर से बात करने के लिए 2 दबाएं।`,
      ackText: `धन्यवाद! आपका पेमेंट लिंक और ऑफिशियल यूपीआई क्यू-आर कोड आपके व्हाट्सएप नंबर पर भेज दिया गया है। आप अपने फोन स्क्रीन पर भी सीधे भुगतान कर सकते हैं। धन्यवाद!`
    };
  }
}

/**
 * 4. Initiate IVR Call from Web Portal
 */
async function initiateIvrCall({
  admissionNo,
  studentName,
  className,
  dueAmount,
  phone,
  lang = 'hi',
  customSpeech = '',
  offerSdp,
  operatorId = 'admin',
  operatorName = 'Fee Desk'
}) {
  if (!admissionNo) {
    return { ok: false, error: 'Admission number is required' };
  }

  const cleanAmt = Math.round(Number(dueAmount || 0));
  const scripts = buildIvrScript({ studentName, className, dueAmount: cleanAmt, lang, admissionNo });
  const finalSpeech = customSpeech && customSpeech.trim() ? customSpeech.trim() : scripts.speechText;
  const finalAck = scripts.ackText;

  const callId = `IVR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Record in app_ivr_call_logs table
  try {
    await db.execute({
      sql: `INSERT INTO app_ivr_call_logs (
        call_id, admission_no, student_name, class_name, phone, due_amount,
        language, status, operator_id, operator_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ringing', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        callId, admissionNo, studentName || '', className || '', phone || '',
        cleanAmt, lang, operatorId, operatorName
      ]
    });
  } catch (err) {
    console.warn('[CallAutomation IVR Log Insert Warning]:', err.message);
  }

  // Initiate WebRTC Call with automated IVR role and extra payload
  const callResult = await initiateCall({
    callerId: 'tps_fee_automation',
    callerName: `${schoolName} Fee Alert`,
    callerRole: 'automated_fee_ivr',
    callerAvatar: 'https://tapowan-school.vercel.app/public/tps_logo_new.png',
    receiverId: admissionNo,
    receiverName: studentName || 'Student',
    receiverRole: 'student',
    offerSdp: offerSdp || null,
    callId: callId,
    extraData: {
      isAutomatedIvr: 'true',
      dueAmount: String(cleanAmt),
      studentName: studentName || '',
      admissionNo: admissionNo,
      className: className || '',
      lang: lang,
      speechText: finalSpeech,
      ackText: finalAck
    }
  });

  return {
    ...callResult,
    callId,
    speechText: finalSpeech,
    ackText: finalAck,
    dueAmount: cleanAmt
  };
}

/**
 * 5. Handle IVR Keypress ('1' -> Instant UPI Link + QR Code Dispatch)
 */
async function handleIvrKeypress({
  callId,
  key,
  admissionNo,
  studentName,
  className,
  dueAmount,
  phone
}) {
  const pressedKey = String(key || '').trim();
  const cleanAmt = Math.round(Number(dueAmount || 0));

  console.log(`[CallAutomation Keypress] Call: ${callId}, Key: '${pressedKey}', Student: ${studentName} (${admissionNo}), Due: ₹${cleanAmt}`);

  if (pressedKey === '1') {
    // 1. Generate official NPCI UPI Deep Link
    const tn = `AdmNo ${admissionNo} Fee`;
    const upiUrl = `upi://pay?pa=${SCHOOL_UPI_VPA}&pn=${encodeURIComponent(SCHOOL_PAYEE_NAME)}&mc=${SCHOOL_MERCHANT_CODE}&orgid=${SCHOOL_ORG_ID}&am=${cleanAmt}&tn=${encodeURIComponent(tn)}&cu=INR`;

    // 2. Generate Base64 Data URL for in-call & mobile rendering
    let qrDataUrl = '';
    try {
      qrDataUrl = await qrcode.toDataURL(upiUrl, {
        width: 360,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    } catch (e) {
      console.warn('QR generation error:', e.message);
    }

    // 3. Formulate WhatsApp Message
    const targetPhone = phone || '';
    let waSent = false;

    if (targetPhone) {
      const waMessage = 
`🏫 **
📍 **
───────────────────────────────
🔔 *FEE PAYMENT LINK & OFFICIAL UPI QR*

Dear Parent / Student,
As requested during your automated reminder call, here are the official payment details for *${studentName || 'Student'}*:

👤 *Student Name:* ${studentName || 'N/A'}
🎫 *Admission No:* ${admissionNo || 'N/A'}
🏫 *Class:* ${className || 'N/A'}
💰 *Outstanding Due:* ₹${cleanAmt.toLocaleString('en-IN')}

📲 *Instant One-Tap Payment (PhonePe, GPay, Paytm, BHIM):*
${upiUrl}

🌐 *Online Portal Link:*
https://tapowan-school.vercel.app

📌 *Bank UPI VPA:* \`${SCHOOL_UPI_VPA}\`
*Payee Name:* ${SCHOOL_PAYEE_NAME}

ℹ️ *Submission Instructions:*
After completing payment, please enter the 12-digit Bank Reference Number (UTR / RRN) in your TPS Mobile App or WhatsApp to receive your official digital fee receipt.
───────────────────────────────
_Automated School Finance Service • ${schoolName}_`;

      try {
        waSent = await sendWhatsAppMessage(targetPhone, waMessage);
      } catch (waErr) {
        console.warn('[CallAutomation WhatsApp Error]:', waErr.message);
      }
    }

    // 4. Update IVR call log
    try {
      await db.execute({
        sql: `UPDATE app_ivr_call_logs 
              SET key_pressed = '1', payment_link_sent = 1, status = 'completed', updated_at = CURRENT_TIMESTAMP 
              WHERE call_id = ? OR admission_no = ?`,
        args: [callId || '', admissionNo || '']
      });
    } catch (dbErr) {
      console.warn('[CallAutomation DB Update Warning]:', dbErr.message);
    }

    return {
      ok: true,
      key: '1',
      action: 'PAYMENT_LINK_AND_QR',
      paymentLink: upiUrl,
      qrDataUrl: qrDataUrl,
      dueAmount: cleanAmt,
      whatsAppSent: waSent,
      phone: targetPhone
    };
  } else if (pressedKey === '2') {
    // Key 2: Request connection to fee counter / operator
    try {
      await db.execute({
        sql: `UPDATE app_ivr_call_logs 
              SET key_pressed = '2', updated_at = CURRENT_TIMESTAMP 
              WHERE call_id = ? OR admission_no = ?`,
        args: [callId || '', admissionNo || '']
      });
    } catch (e) {}

    return {
      ok: true,
      key: '2',
      action: 'OPERATOR_DESK_REQUESTED',
      message: 'Connecting to school fee counter...'
    };
  }

  // Any other key
  try {
    await db.execute({
      sql: `UPDATE app_ivr_call_logs SET key_pressed = ?, updated_at = CURRENT_TIMESTAMP WHERE call_id = ?`,
      args: [pressedKey, callId || '']
    });
  } catch (e) {}

  return { ok: true, key: pressedKey };
}

/**
 * 6. Auto-Purge IVR Call Logs Older Than 24 Hours
 */
async function purgeOldIvrLogs() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const res = await db.execute({
      sql: `DELETE FROM app_ivr_call_logs WHERE created_at < ? OR created_at IS NULL`,
      args: [cutoff],
      skipCache: true
    });
    const purgedCount = res?.rowsAffected || 0;
    if (purgedCount > 0) {
      console.log(`[CallAutomation Purge] Auto-removed ${purgedCount} IVR call logs older than 24h (cutoff: ${cutoff})`);
    }
    return { ok: true, purgedCount, cutoff };
  } catch (err) {
    console.warn('[CallAutomation Purge Warning]:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * 7. Query Recent IVR Logs (Auto-purges & limits to last 24 hours)
 */
async function getIvrLogs({ limit = 50, page = 1, search = '' } = {}) {
  try {
    // 1. Auto-remove call logs older than 24 hours on every fetch
    await purgeOldIvrLogs();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    let whereClauses = ["created_at >= ?"];
    let args = [cutoff];

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      whereClauses.push("(LOWER(admission_no) LIKE ? OR LOWER(student_name) LIKE ? OR phone LIKE ?)");
      args.push(s, s, s);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = Math.max(0, (Number(page) - 1) * Number(limit));

    const sql = `
      SELECT id, call_id, admission_no, student_name, class_name, phone, due_amount,
             language, status, key_pressed, payment_link_sent, duration_sec, operator_name, created_at
      FROM app_ivr_call_logs
      ${whereStr}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(id) as total FROM app_ivr_call_logs ${whereStr}`;
    const [rowsRes, countRes] = await Promise.all([
      db.execute({ sql, args: [...args, Number(limit), offset], skipCache: true }),
      db.execute({ sql: countSql, args, skipCache: true })
    ]);

    return {
      logs: rowsRes.rows || [],
      total: countRes.rows?.[0]?.total || 0,
      page: Number(page),
      limit: Number(limit)
    };
  } catch (err) {
    console.error('[CallAutomation getIvrLogs Error]:', err.message);
    throw err;
  }
}

/**
 * 7. Get Aggregated Campaign Statistics
 */
async function getIvrStats() {
  try {
    const res = await db.execute({
      sql: `
        SELECT 
          COUNT(id) as totalCalls,
          SUM(CASE WHEN status = 'completed' OR duration_sec > 5 THEN 1 ELSE 0 END) as answeredCalls,
          SUM(CASE WHEN key_pressed = '1' THEN 1 ELSE 0 END) as pressedOne,
          SUM(CASE WHEN payment_link_sent = 1 THEN 1 ELSE 0 END) as linksSent,
          SUM(due_amount) as totalDueReminded
        FROM app_ivr_call_logs
        WHERE created_at >= ?
      `,
      args: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)],
      skipCache: true
    });

    const r = res.rows?.[0] || {};
    return {
      totalCalls: Number(r.totalCalls || r.totalcalls || 0),
      answeredCalls: Number(r.answeredCalls || r.answeredcalls || 0),
      pressedOne: Number(r.pressedOne || r.pressedone || 0),
      linksSent: Number(r.linksSent || r.linkssent || 0),
      totalDueReminded: Math.round(Number(r.totalDueReminded || r.totalduereminded || 0))
    };
  } catch (err) {
    console.error('[CallAutomation getIvrStats Error]:', err.message);
    return { totalCalls: 0, answeredCalls: 0, pressedOne: 0, linksSent: 0, totalDueReminded: 0 };
  }
}

/**
 * 7. Get IVR Session Details by callId (Used by recipient mobile app to retrieve personalized speech)
 */
async function getIvrSessionDetails(callId) {
  try {
    if (!callId) return { ok: false, error: 'callId required' };
    const res = await db.execute({
      sql: `SELECT * FROM app_ivr_call_logs WHERE call_id = ? LIMIT 1`,
      args: [callId],
      skipCache: true
    });
    const row = res?.rows?.[0];
    if (!row) {
      return { ok: false, error: 'Session not found' };
    }
    const cleanAmt = Math.round(Number(row.due_amount || row.dueamount || 0));
    const lang = row.language || 'hi';
    const sName = row.student_name || row.studentname || '';
    const cName = row.class_name || row.classname || '';
    const adm = row.admission_no || row.admissionno || '';

    const scripts = buildIvrScript({
      studentName: sName,
      className: cName,
      dueAmount: cleanAmt,
      lang: lang,
      admissionNo: adm
    });

    return {
      ok: true,
      callId: row.call_id,
      admissionNo: adm,
      studentName: sName,
      className: cName,
      dueAmount: cleanAmt,
      lang: lang,
      speechText: scripts.speechText,
      ackText: scripts.ackText
    };
  } catch (err) {
    console.error('[CallAutomation getIvrSessionDetails Error]:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  handleTtsAudio,
  getTargetStudentsWithDues,
  buildIvrScript,
  initiateIvrCall,
  handleIvrKeypress,
  purgeOldIvrLogs,
  getIvrLogs,
  getIvrStats,
  getIvrSessionDetails
};
