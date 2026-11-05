const fs = require('fs');
const path = require('path');

// 1. PATCH public/app.js
const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let appContent = fs.readFileSync(appJsPath, 'utf8');

// A. Update loadStore to never crash when cached store is present
const oldLoadStoreCatch = `  } catch (err) {
    if (err?.message === "Session expired" || !currentUser || !localStorage.getItem("token")) {
      return;
    }
    console.error("loadStore failed:", err);
    throw err;
  }`;

const newLoadStoreCatch = `  } catch (err) {
    if (err?.message === "Session expired" || !currentUser || !localStorage.getItem("token")) {
      return;
    }
    console.warn("loadStore background refresh failed, retaining in-memory data:", err?.message || err);
    if (serverStore && Object.keys(serverStore).length > 0) {
      return serverStore;
    }
    throw err;
  }`;

if (appContent.includes(oldLoadStoreCatch)) {
  appContent = appContent.replace(oldLoadStoreCatch, newLoadStoreCatch);
  console.log('✓ Updated loadStore catch in app.js (LF)');
} else {
  const oldLoadStoreCatchCRLF = oldLoadStoreCatch.replace(/\n/g, '\r\n');
  const newLoadStoreCatchCRLF = newLoadStoreCatch.replace(/\n/g, '\r\n');
  if (appContent.includes(oldLoadStoreCatchCRLF)) {
    appContent = appContent.replace(oldLoadStoreCatchCRLF, newLoadStoreCatchCRLF);
    console.log('✓ Updated loadStore catch in app.js (CRLF)');
  } else {
    console.warn('Could not find oldLoadStoreCatch in app.js');
  }
}

// B. Update removeRecord to optimistically delete in-memory & catch loadStore
const oldRemoveRecordTail = `  await loadStore();
}`;

const newRemoveRecordTail = `  // Optimistically remove from in-memory store so UI updates immediately without lag
  if (serverStore && Array.isArray(serverStore[moduleName])) {
    serverStore[moduleName] = serverStore[moduleName].filter(r => String(r.id) !== String(id));
    tpsIdb.set("serverStore", serverStore).catch(() => {});
    renderAll();
  }

  try {
    await loadStore();
    renderAll();
  } catch (syncErr) {
    console.warn("[removeRecord] Background store refresh notice:", syncErr.message);
  }
}`;

if (appContent.includes(oldRemoveRecordTail)) {
  appContent = appContent.replace(oldRemoveRecordTail, newRemoveRecordTail);
  console.log('✓ Updated removeRecord in app.js (LF)');
} else {
  const oldRemoveRecordTailCRLF = oldRemoveRecordTail.replace(/\n/g, '\r\n');
  const newRemoveRecordTailCRLF = newRemoveRecordTail.replace(/\n/g, '\r\n');
  if (appContent.includes(oldRemoveRecordTailCRLF)) {
    appContent = appContent.replace(oldRemoveRecordTailCRLF, newRemoveRecordTailCRLF);
    console.log('✓ Updated removeRecord in app.js (CRLF)');
  } else {
    console.warn('Could not find oldRemoveRecordTail in app.js');
  }
}

fs.writeFileSync(appJsPath, appContent, 'utf8');

// 2. PATCH public/_worker.js
const workerJsPath = path.join(__dirname, '..', 'public', '_worker.js');
let workerContent = fs.readFileSync(workerJsPath, 'utf8');

// Add edgeStoreCache at the top if not present
if (!workerContent.includes('let edgeStoreCache = null;')) {
  workerContent = workerContent.replace('const edgeFrameCache = new Map();', 'const edgeFrameCache = new Map();\nlet edgeStoreCache = null;\nlet edgeStoreCacheTime = 0;');
  console.log('✓ Added edgeStoreCache variable in _worker.js');
}

// Invalidate cache on mutations
const mutationHooks = [
  "if (url.pathname.startsWith('/api/modules/') && request.method === 'DELETE') {",
  "if (url.pathname.startsWith('/api/modules/') && request.method === 'PUT') {",
  "if (url.pathname.startsWith('/api/modules/') && request.method === 'POST') {"
];

mutationHooks.forEach(hook => {
  if (workerContent.includes(hook) && !workerContent.includes(hook + '\n      edgeStoreCache = null;')) {
    workerContent = workerContent.replace(hook, hook + '\n      edgeStoreCache = null;\n      edgeStoreCacheTime = 0;');
  }
});

// Update /api/store handler in _worker.js
const oldStoreHandler = `    // 4.5 FAST EDGE STORE & MODULES (Instant sub-25ms hydration from Turso Cloud directly)
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
        const batchReqs = tables.map(t => ({ type: 'execute', stmt: { sql: \`SELECT * FROM \${t} ORDER BY id DESC\`, args: [] } }));
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
    }`;

const newStoreHandler = `    // 4.5 FAST EDGE STORE & MODULES (Instant sub-25ms hydration from Turso Cloud directly)
    if (url.pathname === '/api/store' && request.method === 'GET') {
      if (edgeStoreCache && (Date.now() - edgeStoreCacheTime < 10000)) {
        return jsonResponse(edgeStoreCache, 200, { 'Cache-Control': 'no-store' });
      }
      try {
        const tables = [
          'students', 'teachers', 'classes', 'subjects', 'attendance', 
          'teacherAttendance', 'exams', 'examSchedules', 'fees', 'timetable', 
          'users', 'dueManagement', 'settings', 'feeStructures', 'holidays', 
          'library', 'transport', 'hostel', 'payroll', 'admissions', 'announcements',
          'booksAndDress', 'whatsappAlerts', 'weeklyEvaluation',
          'app_device_registry', 'app_online_payments', 'app_student_sessions'
        ];
        const batchReqs = tables.map(t => ({ type: 'execute', stmt: { sql: \`SELECT * FROM \${t} ORDER BY id DESC\`, args: [] } }));
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
        edgeStoreCache = store;
        edgeStoreCacheTime = Date.now();
        return jsonResponse(store, 200, { 'Cache-Control': 'no-store' });
      } catch (storeErr) {
        console.error('[Edge Store Error]', storeErr.message);
        if (edgeStoreCache) {
          return jsonResponse(edgeStoreCache, 200, { 'Cache-Control': 'no-store' });
        }
        return jsonResponse({ ok: false, error: storeErr.message }, 500);
      }
    }`;

if (workerContent.includes(oldStoreHandler)) {
  workerContent = workerContent.replace(oldStoreHandler, newStoreHandler);
  console.log('✓ Updated store handler in _worker.js (LF)');
} else {
  const oldStoreHandlerCRLF = oldStoreHandler.replace(/\n/g, '\r\n');
  const newStoreHandlerCRLF = newStoreHandler.replace(/\n/g, '\r\n');
  if (workerContent.includes(oldStoreHandlerCRLF)) {
    workerContent = workerContent.replace(oldStoreHandlerCRLF, newStoreHandlerCRLF);
    console.log('✓ Updated store handler in _worker.js (CRLF)');
  } else {
    console.warn('Could not find oldStoreHandler in _worker.js');
  }
}

fs.writeFileSync(workerJsPath, workerContent, 'utf8');
console.log('Finished writing 503 fix updates!');
