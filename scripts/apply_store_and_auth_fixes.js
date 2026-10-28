const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Timeout in api()
const oldApiTimeout = `async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout`;

const newApiTimeout = `async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutMs = (path.includes("/api/store") || path.includes("/api/backup")) ? 45000 : 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);`;

if (!content.includes(newApiTimeout)) {
  content = content.replace(oldApiTimeout, newApiTimeout);
  console.log('[1] Replaced api() timeout');
} else {
  console.log('[1] api() timeout already updated');
}

// 2. 401 redirect exclusion
const old401 = `if (response.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/me") && !path.includes("/auth/signup")) {`;
const new401 = `if (response.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/me") && !path.includes("/auth/signup") && !path.includes("/online-payments/pending")) {`;

if (!content.includes(new401)) {
  content = content.replace(old401, new401);
  console.log('[2] Replaced 401 redirect check');
} else {
  console.log('[2] 401 check already updated');
}

// 3. loadStore()
const oldLoadStore = `async function loadStore() {
  try {
    const data = await api("/api/store");
    if (data && typeof data === "object") {
      serverStore = data;
      // Asynchronously persist in IndexedDB for instant sub-50ms future reloads
      tpsIdb.set("serverStore", data).catch(() => {});
      // Automatically remove face data for people who no longer exist
      cleanupOrphanedFaces();
    }
  } catch (err) {
    if (err?.message === "Session expired" || !currentUser || !localStorage.getItem("token")) {
      return;
    }
    console.error("loadStore failed:", err);
    throw err;
  }
}`;

const newLoadStore = `let isStoreLoading = false;
let storeLoadPromise = null;

async function loadStore(force = false) {
  if (isStoreLoading && storeLoadPromise && !force) {
    return storeLoadPromise;
  }
  isStoreLoading = true;
  storeLoadPromise = (async () => {
    try {
      const data = await api("/api/store");
      if (data && typeof data === "object") {
        serverStore = data;
        // Asynchronously persist in IndexedDB for instant sub-50ms future reloads
        if (typeof tpsIdb !== "undefined" && tpsIdb.set) {
          tpsIdb.set("serverStore", data).catch(() => {});
        }
        // Automatically remove face data for people who no longer exist
        cleanupOrphanedFaces();
      }
      return serverStore;
    } catch (err) {
      if (err?.message === "Session expired" || !currentUser || !localStorage.getItem("token")) {
        return;
      }
      console.warn("[loadStore] Background store refresh notice:", err.message);
      // If we already have serverStore in memory, do NOT throw an error to the UI!
      if (serverStore && Object.keys(serverStore).length > 0) {
        return serverStore;
      }
      // If serverStore is empty, try loading from IndexedDB before failing
      if (typeof tpsIdb !== "undefined" && tpsIdb.get) {
        try {
          const cached = await tpsIdb.get("serverStore");
          if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
            console.log("[loadStore] Loaded from IndexedDB cache after network issue");
            serverStore = cached;
            return serverStore;
          }
        } catch (_) {}
      }
      throw err;
    } finally {
      isStoreLoading = false;
      storeLoadPromise = null;
    }
  })();
  return storeLoadPromise;
}`;

if (!content.includes('let isStoreLoading = false;')) {
  content = content.replace(oldLoadStore, newLoadStore);
  console.log('[3] Replaced loadStore()');
} else {
  console.log('[3] loadStore() already updated');
}

// 4. onlinePayBanner
const oldBanner = `    if (onlinePayBanner) {
      fetch('/api/online-payments/pending')
        .then(r => r.json())
        .then(d => {
          if (d.ok && d.count > 0) {
            onlinePayBanner.style.display = "flex";
            const cEl = document.getElementById("onlinePayBannerCount");
            if (cEl) cEl.textContent = \`\${d.count} Online Fee Request\${d.count > 1 ? 's' : ''}\`;
          } else {
            onlinePayBanner.style.display = "none";
          }
        }).catch(() => {});
    }`;

const newBanner = `    if (onlinePayBanner) {
      const token = localStorage.getItem("token");
      if (token || currentUser) {
        if (typeof api === "function") {
          api('/api/online-payments/pending')
            .then(d => {
              if (d && d.ok && d.count > 0) {
                onlinePayBanner.style.display = "flex";
                const cEl = document.getElementById("onlinePayBannerCount");
                if (cEl) cEl.textContent = \`\${d.count} Online Fee Request\${d.count > 1 ? 's' : ''}\`;
              } else {
                onlinePayBanner.style.display = "none";
              }
            }).catch(() => {
              if (onlinePayBanner) onlinePayBanner.style.display = "none";
            });
        }
      } else {
        onlinePayBanner.style.display = "none";
      }
    }`;

if (!content.includes('const token = localStorage.getItem("token");\r\n      if (token || currentUser) {\r\n        if (typeof api === "function") {') && !content.includes('const token = localStorage.getItem("token");\n      if (token || currentUser) {\n        if (typeof api === "function") {')) {
  content = content.replace(oldBanner, newBanner);
  console.log('[4] Replaced onlinePayBanner');
} else {
  console.log('[4] onlinePayBanner already updated');
}

// 5. addRecord
const oldAdd = `  await api(\`/api/modules/\${moduleName}\`, { method: "POST", body: JSON.stringify(record) });
  await loadStore();
}`;

const newAdd = `  const res = await api(\`/api/modules/\${moduleName}\`, { method: "POST", body: JSON.stringify(record) });
  if (res && res.id && serverStore && Array.isArray(serverStore[moduleName])) {
    const existingIdx = serverStore[moduleName].findIndex(r => String(r.id) === String(res.id));
    if (existingIdx !== -1) {
      serverStore[moduleName][existingIdx] = res;
    } else {
      serverStore[moduleName].unshift(res);
    }
    if (typeof tpsIdb !== "undefined" && tpsIdb.set) {
      tpsIdb.set("serverStore", serverStore).catch(() => {});
    }
  }
  try {
    const updatedRows = await api(\`/api/modules/\${moduleName}\`);
    if (Array.isArray(updatedRows) && serverStore) {
      serverStore[moduleName] = updatedRows;
      if (typeof tpsIdb !== "undefined" && tpsIdb.set) {
        tpsIdb.set("serverStore", serverStore).catch(() => {});
      }
    }
  } catch (_) {}
}`;

if (!content.includes('const existingIdx = serverStore[moduleName].findIndex(')) {
  content = content.replace(oldAdd, newAdd);
  console.log('[5] Replaced addRecord()');
} else {
  console.log('[5] addRecord() already updated');
}

// 6. removeRecord
const oldRemove = `async function removeRecord(moduleName, id) {
  if (moduleName === "fees" && id) {
    const store = getStore();
    const fee = (store.fees || []).find(f => String(f.id) === String(id));
    if (fee && (fee.consolidatedFeeIds || fee.consolidatedDueMgmtIds)) {
      try {
        const feeIds = JSON.parse(fee.consolidatedFeeIds || "[]");
        const mgmtIds = JSON.parse(fee.consolidatedDueMgmtIds || "[]");
        // The backend \`server/db-sqlite.js\` now handles automatic restoration of dueManagement balances 
        // when a fee record containing consolidatedDueMgmtIds is deleted.
        // We no longer need to manually calculate and send PUT requests from the frontend here.
      } catch (err) {
        console.error("Error reversing consolidation on delete:", err);
      }
    }
  }
  await api(\`/api/modules/\${moduleName}/\${id}\`, { method: "DELETE" });

  // Cleanup Face Recognition Data if deleting a student or teacher
  if (moduleName === "students" || moduleName === "teachers") {
    const person = (getStore()[moduleName] || []).find(p => String(p.id) === String(id));
    if (person && person.fullName) {
      const faceStore = getFaceStore();
      const faceKey = \`\${moduleName}|\${person.fullName}\`;
      if (faceStore[faceKey]) {
        delete faceStore[faceKey];
        saveFaceStore(faceStore);
        console.log(\`[FaceAI] Deleted face data for \${person.fullName}\`);
        
        // Try to remove from server as well (best effort)
        try {
          const store = getStore();
          const embeddings = store.faceEmbeddings || [];
          const emb = embeddings.find(e => e.name === person.fullName && e.targetType === moduleName);
          if (emb && emb.id) {
            await api(\`/api/modules/faceEmbeddings/\${emb.id}\`, { method: "DELETE" });
          }
        } catch (e) {
          console.warn("Server face cleanup failed:", e.message);
        }
      }
    }
  }

  await loadStore();
}`;

const newRemove = `async function removeRecord(moduleName, id) {
  if (moduleName === "fees" && id) {
    const store = getStore();
    const fee = (store.fees || []).find(f => String(f.id) === String(id));
    if (fee && (fee.consolidatedFeeIds || fee.consolidatedDueMgmtIds)) {
      try {
        const feeIds = JSON.parse(fee.consolidatedFeeIds || "[]");
        const mgmtIds = JSON.parse(fee.consolidatedDueMgmtIds || "[]");
        // The backend \`server/db-sqlite.js\` now handles automatic restoration of dueManagement balances 
        // when a fee record containing consolidatedDueMgmtIds is deleted.
        // We no longer need to manually calculate and send PUT requests from the frontend here.
      } catch (err) {
        console.error("Error reversing consolidation on delete:", err);
      }
    }
  }

  // Optimistically remove from local store immediately so UI updates instantaneously!
  if (serverStore && Array.isArray(serverStore[moduleName])) {
    serverStore[moduleName] = serverStore[moduleName].filter(r => String(r.id) !== String(id));
    if (typeof tpsIdb !== "undefined" && tpsIdb.set) {
      tpsIdb.set("serverStore", serverStore).catch(() => {});
    }
  }

  await api(\`/api/modules/\${moduleName}/\${id}\`, { method: "DELETE" });

  // Cleanup Face Recognition Data if deleting a student or teacher
  if (moduleName === "students" || moduleName === "teachers") {
    const person = (getStore()[moduleName] || []).find(p => String(p.id) === String(id));
    if (person && person.fullName) {
      const faceStore = getFaceStore();
      const faceKey = \`\${moduleName}|\${person.fullName}\`;
      if (faceStore[faceKey]) {
        delete faceStore[faceKey];
        saveFaceStore(faceStore);
        console.log(\`[FaceAI] Deleted face data for \${person.fullName}\`);
        
        // Try to remove from server as well (best effort)
        try {
          const store = getStore();
          const embeddings = store.faceEmbeddings || [];
          const emb = embeddings.find(e => e.name === person.fullName && e.targetType === moduleName);
          if (emb && emb.id) {
            await api(\`/api/modules/faceEmbeddings/\${emb.id}\`, { method: "DELETE" });
          }
        } catch (e) {
          console.warn("Server face cleanup failed:", e.message);
        }
      }
    }
  }

  // Lightweight background sync for this specific module (non-blocking, never throws 30s timeout)
  try {
    const updatedRows = await api(\`/api/modules/\${moduleName}\`);
    if (Array.isArray(updatedRows) && serverStore) {
      serverStore[moduleName] = updatedRows;
      if (typeof tpsIdb !== "undefined" && tpsIdb.set) {
        tpsIdb.set("serverStore", serverStore).catch(() => {});
      }
      renderCurrentModule();
    }
  } catch (syncErr) {
    console.warn(\`[removeRecord] Module \${moduleName} background sync notice:\`, syncErr.message);
  }
  if (moduleName === "fees") {
    try {
      const dues = await api("/api/modules/dueManagement");
      if (Array.isArray(dues) && serverStore) {
        serverStore.dueManagement = dues;
        if (typeof tpsIdb !== "undefined" && tpsIdb.set) {
          tpsIdb.set("serverStore", serverStore).catch(() => {});
        }
      }
    } catch (_) {}
  }
}`;

if (!content.includes('// Optimistically remove from local store immediately so UI updates instantaneously!')) {
  content = content.replace(oldRemove, newRemove);
  console.log('[6] Replaced removeRecord()');
} else {
  console.log('[6] removeRecord() already updated');
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Successfully written updated app.js!');
