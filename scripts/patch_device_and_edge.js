const fs = require('fs');
const path = require('path');

// 1. Update public/app.js
const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// A. Immediate render of cached devices on panel open
const oldOpenCode = `    document.body.appendChild(overlay);
    _liveOtaPanelEl = overlay;`;

const newOpenCode = `    document.body.appendChild(overlay);
    _liveOtaPanelEl = overlay;
    if (Array.isArray(_cachedLiveOtaDevices) && _cachedLiveOtaDevices.length > 0) {
      renderLiveOtaDevices();
    }`;

if (!appJs.includes('if (Array.isArray(_cachedLiveOtaDevices) && _cachedLiveOtaDevices.length > 0) {')) {
  appJs = appJs.replace(oldOpenCode, newOpenCode);
  console.log('[app.js] Added immediate render for cached devices');
}

// B. Friendly error handling in loadDeviceList instead of stuck loading
const oldCatchCode = `      renderLiveOtaDevices();
    } catch (err) {
      console.error("LIVEOTA load error:", err);
    }
  }`;

const newCatchCode = `      renderLiveOtaDevices();
    } catch (err) {
      console.error("LIVEOTA load error:", err);
      const container = document.getElementById("liveOtaDeviceList");
      if (container && (!Array.isArray(_cachedLiveOtaDevices) || _cachedLiveOtaDevices.length === 0)) {
        container.innerHTML = \`
          <div style="text-align:center;padding:40px;color:#ef4444;font-size:0.85rem;grid-column:1/-1;">
            <span class="material-symbols-outlined" style="font-size:32px;display:block;margin:0 auto 8px;color:#ef4444;">cloud_off</span>
            <b style="color:#b91c1c;">Unable to load devices</b>
            <p style="margin:6px 0 14px;color:#64748b;font-size:0.78rem;">\${err.message || "Network timeout or connection failed"}</p>
            <button onclick="loadDeviceList()" style="padding:7px 16px;border-radius:8px;background:#2563eb;color:#fff;border:none;cursor:pointer;font-weight:700;display:inline-flex;align-items:center;gap:6px;"><span class="material-symbols-outlined" style="font-size:16px;">refresh</span> Retry</button>
          </div>\`;
      }
    }
  }`;

if (!appJs.includes('Unable to load devices')) {
  appJs = appJs.replace(oldCatchCode, newCatchCode);
  console.log('[app.js] Added error state to loadDeviceList()');
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('[app.js] Successfully written!');

// 2. Update server.js APK redirect
const serverJsPath = path.join(__dirname, '..', 'server.js');
let serverJs = fs.readFileSync(serverJsPath, 'utf8');

const oldServerApk = `  if (fs.existsSync(localApkPath)) {
    return res.sendFile(localApkPath);
  }`;

const newServerApk = `  if (process.env.VERCEL) {
    const targetUrl = 'https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk';
    res.writeHead(302, {
      Location: targetUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    });
    return res.end();
  }
  if (fs.existsSync(localApkPath)) {
    return res.sendFile(localApkPath);
  }`;

if (!serverJs.includes('if (process.env.VERCEL) {\n    const targetUrl = \'https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk\';') && !serverJs.includes('if (process.env.VERCEL) {\r\n    const targetUrl = \'https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk\';')) {
  serverJs = serverJs.replace(oldServerApk, newServerApk);
  console.log('[server.js] Added Vercel APK 302 redirect guard');
  fs.writeFileSync(serverJsPath, serverJs, 'utf8');
}

// 3. Update public/index.html version
const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
indexHtml = indexHtml.replace(/app\.js\?v=\d+/g, 'app.js?v=202610310630');
fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
console.log('[index.html] Updated app.js?v=202610310630');
