const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Fix fallbackRes in api()
const oldFallback = 'if (fallbackRes.ok || fallbackRes.status < 500) {';
const newFallback = 'if (fallbackRes.ok || (fallbackRes.status < 500 && fallbackRes.status !== 401 && fallbackRes.status !== 403)) {';
if (!content.includes(oldFallback)) {
  console.warn('oldFallback not found (might already be patched)');
} else {
  content = content.replace(oldFallback, newFallback);
  console.log('✓ Patched fallbackRes condition in api()');
}

// 2. Remove rogue 401 session destruction in api()
const old401Target = content.indexOf('// Auto-redirect to login if session expired — but ONLY if we were previously logged in');
if (old401Target !== -1) {
  const if401Target = content.indexOf('if (response.status === 401 &&', old401Target);
  const end401Target = content.indexOf('throw new Error("Session expired");\n    }', if401Target);
  if (end401Target !== -1) {
    const fullEnd = end401Target + 'throw new Error("Session expired");\n    }'.length;
    // Also handle \r\n
    content = content.slice(0, old401Target) + content.slice(fullEnd);
    console.log('✓ Removed rogue 401 session destruction from api()');
  } else {
    // Check with \r\n
    const end401TargetCRLF = content.indexOf('throw new Error("Session expired");\r\n    }', if401Target);
    if (end401TargetCRLF !== -1) {
      const fullEnd = end401TargetCRLF + 'throw new Error("Session expired");\r\n    }'.length;
      content = content.slice(0, old401Target) + content.slice(fullEnd);
      console.log('✓ Removed rogue 401 session destruction from api() (CRLF)');
    } else {
      console.warn('Could not locate end of 401 block');
    }
  }
} else {
  console.warn('Rogue 401 comment not found (might already be patched)');
}

// 3. Update getSessionUser() to be resilient against network drops
const oldGetSessionUser = `async function getSessionUser() {
  const data = await api("/api/auth/me");
  if (data.token) localStorage.setItem("token", data.token);
  return data.user;
}`;

const newGetSessionUser = `async function getSessionUser() {
  try {
    const data = await api("/api/auth/me");
    if (data && data.token) localStorage.setItem("token", data.token);
    return data && data.user ? data.user : null;
  } catch (err) {
    console.warn("[getSessionUser] Network error checking session with server:", err.message);
    const cached = localStorage.getItem("tps_user") || sessionStorage.getItem("tps_user");
    if (cached && localStorage.getItem("token")) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }
    return null;
  }
}`;

if (content.includes(oldGetSessionUser)) {
  content = content.replace(oldGetSessionUser, newGetSessionUser);
  console.log('✓ Patched getSessionUser() with offline cache fallback');
} else {
  // Try CRLF
  const oldGetSessionUserCRLF = oldGetSessionUser.replace(/\n/g, '\r\n');
  const newGetSessionUserCRLF = newGetSessionUser.replace(/\n/g, '\r\n');
  if (content.includes(oldGetSessionUserCRLF)) {
    content = content.replace(oldGetSessionUserCRLF, newGetSessionUserCRLF);
    console.log('✓ Patched getSessionUser() with offline cache fallback (CRLF)');
  } else {
    console.warn('oldGetSessionUser not found');
  }
}

// 4. Update boot() to never call applyAuthUI(null) if token exists
const oldBootCheck = `    if (!user) {
      if (!renderedFromCache || !localStorage.getItem("token")) {
        applyAuthUI(null);
        return;
      }
    } else {
      applyAuthUI(user);
    }`;

const newBootCheck = `    if (!user) {
      if (!localStorage.getItem("token")) {
        applyAuthUI(null);
        return;
      }
    } else {
      applyAuthUI(user);
    }`;

if (content.includes(oldBootCheck)) {
  content = content.replace(oldBootCheck, newBootCheck);
  console.log('✓ Patched boot() check to preserve session');
} else {
  const oldBootCheckCRLF = oldBootCheck.replace(/\n/g, '\r\n');
  const newBootCheckCRLF = newBootCheck.replace(/\n/g, '\r\n');
  if (content.includes(oldBootCheckCRLF)) {
    content = content.replace(oldBootCheckCRLF, newBootCheckCRLF);
    console.log('✓ Patched boot() check to preserve session (CRLF)');
  } else {
    console.warn('oldBootCheck not found');
  }
}

// 5. Update 30s signature catch
const oldSigCatch = `      } catch (sigErr) {
        if (sigErr?.message === "Session expired" || !currentUser || !localStorage.getItem("token")) {
          return;
        }
        // Fallback to direct check if signature route is temporarily unavailable
        needsStoreDownload = true;
      }`;

const newSigCatch = `      } catch (sigErr) {
        // Signature check temporarily unavailable; skip this cycle smoothly
        return;
      }`;

if (content.includes(oldSigCatch)) {
  content = content.replace(oldSigCatch, newSigCatch);
  console.log('✓ Patched 30s signature catch');
} else {
  const oldSigCatchCRLF = oldSigCatch.replace(/\n/g, '\r\n');
  const newSigCatchCRLF = newSigCatch.replace(/\n/g, '\r\n');
  if (content.includes(oldSigCatchCRLF)) {
    content = content.replace(oldSigCatchCRLF, newSigCatchCRLF);
    console.log('✓ Patched 30s signature catch (CRLF)');
  } else {
    console.warn('oldSigCatch not found');
  }
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Finished writing updated app.js!');
