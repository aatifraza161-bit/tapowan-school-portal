const { createClient } = require('@supabase/supabase-js');
const { list } = require('./db-sqlite');

// Load environment variables for Supabase
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  globalThis.WebSocket = require('ws');
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

// New database for Quiz and Dues Breakdown
const SUPABASE_QUIZ_URL = process.env.SUPABASE_QUIZ_URL || 'https://onfdgdevtuyaarhomvmo.supabase.co';
const SUPABASE_QUIZ_KEY = process.env.SUPABASE_QUIZ_KEY || '';
const supabaseQuiz = createClient(SUPABASE_QUIZ_URL, SUPABASE_QUIZ_KEY, {
    auth: { persistSession: false }
});

// Setup Instant Sync via Realtime for Online Payments
supabaseQuiz
  .channel('online_payments_realtime')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'app_online_payments' },
    (payload) => {
      console.log('[Supabase Sync] Instant payment received via Realtime! Triggering sync...');
      syncToSupabase();
    }
  )
  .subscribe((status) => {
    console.log('[Supabase Sync] Realtime subscription status:', status);
  });

let isSyncing = false;
async function syncToSupabase(pullOnly = false) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    if (!supabase) {
      console.log('[Supabase Sync] Skipped: Credentials not configured in .env');
      return;
    }
    if (!pullOnly) {
      console.log('[Supabase Sync] Starting cloud synchronization...');
    const students = await list("students");
    const dueMgmt = await list("dueManagement");
    const allFees = await list("fees");
    const holidays = await list("holidays");
    const timetable = await list("timetable");
    const attendance = await list("attendance");
    const notifications = await list("notifications");

    // Pre-calculate attendance stats per student
    // We'll calculate: Total Working Days (where status is Present, Absent, Half Day, etc.)
    // and Total Present Days. We'll group by admissionNo, using rollNo and className to map.
    const attStats = {};
    for (const att of attendance) {
      if (!att.status) continue;
      // We need admissionNo, but attendance might only have rollNo and className.
      // Let's find the admissionNo from the students list
      const stu = students.find(s => s.rollNo === att.rollNo && s.className === att.className);
      if (stu) {
        if (!attStats[stu.admissionNo]) {
          attStats[stu.admissionNo] = { total: 0, present: 0 };
        }
        attStats[stu.admissionNo].total += 1;
        if (att.status.toLowerCase() === 'present' || att.status.toLowerCase() === 'half day') {
          attStats[stu.admissionNo].present += 1;
        }
      }
    }

    // Process Students & Dues
    const todayString = new Date().toISOString().split('T')[0];
    
    // We need to fetch the raw photo data since list() strips it out
    const db = require('./db-sqlite');
    const getRawStudentRes = await db.runRaw("SELECT admissionNo, photo, motherName, dob, address FROM students", [], "students");
    const rawStudents = getRawStudentRes.rows;
    const rawStudentMap = new Map();
    for (const r of rawStudents) {
      rawStudentMap.set(r.admissionNo, r);
    }

    const cloudStudentsRaw = await Promise.all(students.filter(s => s.status === 'Active').map(async student => {
      const studentDues = dueMgmt.filter(d => d.admissionNo === student.admissionNo && d.status !== 'Paid');
      const totalDueAmount = studentDues.reduce((sum, d) => sum + (parseFloat(d.balance) || 0), 0);
      const stats = attStats[student.admissionNo] || { total: 0, present: 0 };
      const rawData = rawStudentMap.get(student.admissionNo) || {};
      
      // Determine today's attendance for this student
      let todayStatus = 'Absent';
      const todayAttRecord = attendance.find(a => 
        a.date && a.date.startsWith(todayString) && 
        a.rollNo === student.rollNo && 
        a.className === student.className
      );
      if (todayAttRecord) {
        todayStatus = todayAttRecord.status;
      }

      // Check if photo exists locally and upload if needed
      let photoUrl = student.photoUrl || '';
      if (rawData.photo && rawData.photo.length > 100) {
        if (!photoUrl || photoUrl === '') {
          // It's still a base64 string or un-uploaded, we need to upload it to Storage
          try {
            const fileName = `student_${student.admissionNo.replace(/\//g, '_')}_${Date.now()}.jpg`;
            
            // Extract base64 part
            const base64Data = rawData.photo.includes('base64,') 
              ? rawData.photo.split('base64,')[1] 
              : rawData.photo;
              
            const buffer = Buffer.from(base64Data, 'base64');
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('student-photos')
              .upload(fileName, buffer, {
                contentType: 'image/jpeg',
                upsert: true
              });
              
            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from('student-photos')
                .getPublicUrl(fileName);
              
              photoUrl = publicUrlData.publicUrl;
              console.log(`[Supabase Sync] Uploaded photo for ${student.admissionNo}`);
              
              try {
                await db.runRaw("ALTER TABLE students ADD COLUMN photoUrl TEXT", [], "students");
              } catch(e) {} // Ignore if exists
              
              try {
                await db.runRaw("UPDATE students SET photoUrl = ? WHERE admissionNo = ?", [photoUrl, student.admissionNo], "students");
              } catch(e) {
                console.error(`[Supabase Sync] Failed to save photoUrl locally for ${student.admissionNo}`);
              }
            }
          } catch (e) {
            console.error(`[Supabase Sync] Failed to upload photo for ${student.admissionNo}:`, e.message);
          }
        }
      }

      return {
        admissionNo: student.admissionNo,
        fullName: student.fullName,
        className: student.className,
        fatherName: student.fatherName,
        phone: student.phone || student.phone1 || '',
        monthlyFee: parseFloat(student.monthlyFee) || 0,
        totalDue: totalDueAmount,
        attendanceTotal: stats.total,
        attendancePresent: stats.present,
        todayAttendance: todayStatus,
        photo: photoUrl,
        motherName: rawData.motherName || '',
        dob: rawData.dob || '',
        address: rawData.address || ''
      };
    }));

    // Deduplicate by admissionNo (keep last entry which is the most recently promoted class)
    const studentMap = new Map();
    for (const s of cloudStudentsRaw) {
      studentMap.set(s.admissionNo, s);
    }
    const cloudStudents = [...studentMap.values()];

    // Process transactions from the last 365 days
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 365);
    const cloudTransactions = [];
    
    for (const fee of allFees) {
      if (!fee.admissionNo || parseFloat(fee.paidAmount) <= 0) continue;
      
      const txDate = new Date(fee.paymentDate || fee.creationDate);
      if (txDate >= tenDaysAgo) {
        cloudTransactions.push({
          id: fee.id,
          admissionNo: fee.admissionNo,
          amountPaid: parseFloat(fee.paidAmount),
          date: fee.paymentDate || fee.creationDate,
          method: fee.paymentMethod || 'Cash',
          payId: fee.payId || '',
          particulars: (fee.feeTypes || fee.term || 'Fee Payment') + (fee.month ? ` (${fee.month})` : '')
        });
      }
    }

    // Process Holidays
    const cloudHolidays = holidays.map(h => ({
      id: h.id,
      date: h.date,
      name: h.name,
      type: h.type || 'Holiday'
    }));

    // Process Timetable
    const cloudTimetable = timetable.map(t => ({
      id: t.id,
      className: t.className,
      day: t.day,
      period: t.period,
      subject: t.subject,
      teacher: t.teacher,
      roomNo: t.roomNo
    }));

    // Process Notifications
    const cloudNotifications = notifications.map(n => ({
      id: n.id,
      message: n.message,
      type: n.type,
      date: n.date
    }));

    // Upsert All Data with error logging
    console.log(`[Supabase Sync] Syncing ${cloudStudents.length} students, ${cloudTransactions.length} transactions, ${cloudHolidays.length} holidays, ${cloudTimetable.length} timetable entries, ${cloudNotifications.length} notifications`);

    if (cloudStudents.length > 0) {
      // Batch upsert students in groups of 10 to avoid payload size limits (photos can be very large)
      const BATCH_SIZE = 10;
      let syncedCount = 0;
      for (let i = 0; i < cloudStudents.length; i += BATCH_SIZE) {
        const batch = cloudStudents.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('app_students').upsert(batch, { onConflict: 'admissionNo' });
        if (error) {
          console.error(`[Supabase Sync] Students batch ${Math.floor(i/BATCH_SIZE)+1} error:`, error.message, error.details);
          // If batch fails due to size, retry without photos
          const batchNoPhoto = batch.map(s => ({ ...s, photo: null }));
          const { error: retryError } = await supabase.from('app_students').upsert(batchNoPhoto, { onConflict: 'admissionNo' });
          if (retryError) console.error(`[Supabase Sync] Students batch ${Math.floor(i/BATCH_SIZE)+1} retry error:`, retryError.message);
          else syncedCount += batch.length;
        } else {
          syncedCount += batch.length;
        }
      }
      console.log(`[Supabase Sync] ✅ ${syncedCount} students synced`);
    }

    if (cloudTransactions.length > 0) {
      // First, wipe all transactions in Supabase to enforce the 10-per-student limit strictly
      // Since this is a one-way sync, it's safe to clear and repopulate
      await supabase.from('app_transactions').delete().neq('id', 0);
      
      const { error } = await supabase.from('app_transactions').upsert(cloudTransactions, { onConflict: 'id' });
      if (error) console.error('[Supabase Sync] Transactions error:', error.message);
    }

    if (cloudHolidays.length > 0) {
      const { error } = await supabase.from('app_holidays').upsert(cloudHolidays, { onConflict: 'id' });
      if (error) console.error('[Supabase Sync] Holidays error:', error.message);
    }
    if (cloudTimetable.length > 0) {
      const { error } = await supabase.from('app_timetable').upsert(cloudTimetable, { onConflict: 'id' });
      if (error) console.error('[Supabase Sync] Timetable error:', error.message);
    }
    if (cloudNotifications.length > 0) {
      const { error } = await supabase.from('app_notifications').upsert(cloudNotifications, { onConflict: 'id' });
      if (error) console.error('[Supabase Sync] Notifications error:', error.message);
    }

    // Sync Dues Breakdown to New Database (1:1 mapping to preserve payId)
    const activeDues = [];
    dueMgmt.forEach(d => {
      const balance = parseFloat(d.balance) || 0;
      if (balance > 0 && d.status !== 'Paid') {
        activeDues.push({
          admission_no: d.admissionNo,
          particulars: d.particulars,
          due_amount: parseFloat(d.dueAmount) || 0,
          paid_amount: parseFloat(d.paidAmount) || 0,
          balance: balance,
          status: d.status || 'Unpaid',
          payId: d.payId || ''
        });
      }
    });

    if (activeDues.length > 0) {
      // Clear existing dues to enforce a clean state (simple one-way sync)
      await supabaseQuiz.from('app_student_dues').delete().neq('id', 0);
      
      // Batch insert dues to avoid payload size limits
      const DUE_BATCH = 100;
      let syncDueCount = 0;
      for (let i = 0; i < activeDues.length; i += DUE_BATCH) {
        const batch = activeDues.slice(i, i + DUE_BATCH);
        const { error } = await supabaseQuiz.from('app_student_dues').insert(batch);
        if (error) console.error(`[Supabase Sync] Dues batch ${Math.floor(i/DUE_BATCH)+1} error:`, error.message);
        else syncDueCount += batch.length;
      }
      console.log(`[Supabase Sync] ✅ ${syncDueCount} dues synced to new database`);
    }
  } // End of if (!pullOnly)

  // Pull Pending Online Payments from Supabase and insert into local 'fees'
    const { data: pendingPayments, error: pullError } = await supabaseQuiz
      .from('app_online_payments')
      .select('*')
      .eq('status', 'Pending');

    if (!pullError && pendingPayments && pendingPayments.length > 0) {
      let syncedNewPayments = false;
      for (const p of pendingPayments) {
        try {
          // Fetch student details to enrich the record
          const _stuRes = await db.runRaw("SELECT fatherName, rollNo, monthlyFee FROM students WHERE admissionNo = ?", [p.admission_no], "students");
          const stu = _stuRes.rows[0] || {};
          
          // Check for unpaid dues in dueManagement
          const _duesRes = await db.runRaw("SELECT id, balance, particulars, payId FROM dueManagement WHERE admissionNo = ? AND status != 'Paid' AND balance > 0", [p.admission_no], "dueManagement");
          const unpaidDues = _duesRes.rows;
          const totalDuesAmt = unpaidDues.reduce((sum, d) => sum + (parseFloat(d.balance) || 0), 0);
          
          let mgmtIds = [];
          let feeTypesStr = "Online Payment";
          let feeStructId = "";
          
          if (p.payId) {
             // Link to the specific due using payId
             const specificDue = unpaidDues.find(d => d.payId === p.payId);
             if (specificDue) {
                mgmtIds = [specificDue.id];
                feeTypesStr = specificDue.particulars || "Online Payment";
             }
          } else if (totalDuesAmt > 0 && parseFloat(p.amount) === totalDuesAmt) {
             // The payment matches exactly the sum of unpaid dues! Link them!
             mgmtIds = unpaidDues.map(d => d.id);
             feeTypesStr = unpaidDues.map(d => d.particulars).join(", ");
          } else {
             // Fallback to assuming it's just the Tuition fee if no exact due match
             const _feeStructRes = await db.runRaw("SELECT id FROM feeStructures WHERE className = ? AND (lower(feeType) LIKE '%tuition%' OR lower(feeType) LIKE '%monthly%') LIMIT 1", [p.class_name || ''], "feeStructures");
             const feeStruct = _feeStructRes.rows[0];
             if (feeStruct) {
                 feeStructId = feeStruct.id.toString();
                 feeTypesStr = "Tuition Fee (Monthly)";
             }
          }
          
          const monthStr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][new Date().getMonth()];
          const d = new Date();
          let startYear = d.getFullYear();
          if (d.getMonth() < 3) startYear--;
          const termStr = `${startYear}-${(startYear + 1).toString().slice(-2)}`;
          const todayString = new Date().toISOString().split('T')[0];
          
          await db.runRaw(`
            INSERT INTO fees (
              admissionNo, studentName, className, rollNo, fatherName, term, month,
              totalFee, paidAmount, balance, status, paymentDate, paymentMethod, feeTypes, consolidatedFeeIds, consolidatedDueMgmtIds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            p.admission_no, p.student_name, p.class_name || '', stu.rollNo || '', stu.fatherName || '', termStr, monthStr,
            p.amount.toString(), p.amount.toString(), 0, 'Paid', todayString, 'Online', feeTypesStr, '[]', JSON.stringify(mgmtIds)
          ], "fees");

          // Automatically REMOVE the associated dues from dueManagement as requested
          if (mgmtIds.length > 0) {
            for (const id of mgmtIds) {
              await db.runRaw("DELETE FROM dueManagement WHERE id = ?", [id], "dueManagement");
            }
          }

          await supabaseQuiz.from('app_online_payments').update({ status: 'Synced' }).eq('id', p.id);
          console.log(`[Supabase Sync] ✅ Pulled pending payment for ${p.student_name} (${p.amount})`);
          syncedNewPayments = true;
        } catch (insertErr) {
          console.error(`[Supabase Sync] Failed to insert pending payment:`, insertErr.message);
        }
      }
      
      if (syncedNewPayments && global.broadcastEvent) {
         global.broadcastEvent('store_updated', { source: 'online_payment' });
      }
    }

    console.log(`[Supabase Sync] Successfully synced to cloud!`);
  } catch (error) {
    console.error('[Supabase Sync] Error:', error.message);
  } finally {
    isSyncing = false;
  }
}

module.exports = { syncToSupabase };
