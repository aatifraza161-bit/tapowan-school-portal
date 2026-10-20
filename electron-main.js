const os = require('os');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, autoUpdater, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');

let mainWindow;
let bgProcesses = [];
let logStream;

function patchInsightFaceModels() {
  try {
    const modelDir = path.join(os.homedir(), '.insightface', 'models', 'buffalo_l');
    const filesToRemove = ['1k3d68.onnx', '2d106det.onnx', 'genderage.onnx'];
    if (fs.existsSync(modelDir)) {
      filesToRemove.forEach(f => {
        const fp = path.join(modelDir, f);
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
          console.log('Removed unnecessary insightface model to prevent PyInstaller crash:', f);
        }
      });
    }
  } catch (e) {
    console.error('Failed to patch insightface models:', e);
  }
}

// --- DB MIGRATION FOR ASAR ---
function migrateDatabase() {
  const userDataPath = app.getPath('userData');
  process.env.USER_DATA_PATH = userDataPath; // Make available to server.js
  
  const currentDbPath = path.join(__dirname, 'server', 'school.db');
  const newDbPath = path.join(userDataPath, 'school.db');
  
  if (fs.existsSync(currentDbPath) && !fs.existsSync(newDbPath)) {
    try {
      fs.copyFileSync(currentDbPath, newDbPath);
      console.log("Database successfully migrated to AppData!");
    } catch(e) {
      console.error("Migration failed:", e);
    }
  }
}

function logOutput(prefix, data) {
  if (!logStream) return;
  const lines = data.toString().split('\n').filter(l => l.trim().length > 0);
  const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
  lines.forEach(line => {
    logStream.write(`[${timestamp}] [${prefix}] ${line}\n`);
  });
}

function startBackgroundServers() {
  const isPackaged = app.isPackaged;
  // If ASAR is used, __dirname is the app.asar file itself
  const workDir = __dirname;
  const cwdDir = isPackaged ? process.resourcesPath : __dirname;
  
  try {
    logStream = fs.createWriteStream(path.join(app.getPath('userData'), 'system_logs.txt'), { flags: 'w' });
    logStream.write(`=== NEW SESSION STARTED AT ${new Date().toLocaleString()} ===\n\n`);
  } catch(e) { console.error("Could not write logs:", e); }

  // Patch models before starting face server
  patchInsightFaceModels();

  console.log("Starting background servers in:", workDir);

  const mainProc = spawn(process.execPath, [path.join(workDir, 'server.js')], { 
    cwd: cwdDir, 
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  mainProc.stdout.on('data', (data) => logOutput('NODE', data));
  mainProc.stderr.on('data', (data) => logOutput('NODE_ERR', data));
  bgProcesses.push(mainProc);

  const unpackedRoot = isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked') : workDir;
  const directExe1 = path.join(unpackedRoot, 'face_server', 'dist', 'face_server.exe');
  const directExe2 = path.join(unpackedRoot, 'face_server', 'face_server.exe');
  const batPath = path.join(unpackedRoot, 'START_FACE_SERVER.bat');
  
  function startFaceServer() {
    if (app.isQuitting) return;
    let faceProc;
    if (fs.existsSync(directExe1)) {
      logOutput('FACE_SYS', `Starting local InsightFace directly from: ${directExe1}`);
      faceProc = spawn(directExe1, [], { cwd: path.dirname(directExe1), windowsHide: true });
    } else if (fs.existsSync(directExe2)) {
      logOutput('FACE_SYS', `Starting local InsightFace directly from: ${directExe2}`);
      faceProc = spawn(directExe2, [], { cwd: path.dirname(directExe2), windowsHide: true });
    } else {
      logOutput('FACE_SYS', `Starting local InsightFace via bat: ${batPath}`);
      faceProc = spawn('cmd.exe', ['/c', batPath], { cwd: cwdDir, windowsHide: true });
    }
    faceProc.stdout.on('data', (data) => logOutput('FACE', data));
    faceProc.stderr.on('data', (data) => logOutput('FACE_ERR', data));
    bgProcesses.push(faceProc);

    faceProc.on('exit', (code) => {
      logOutput('FACE_SYS', `Face server exited with code ${code}. Restarting in 3 seconds...`);
      bgProcesses = bgProcesses.filter(p => p !== faceProc);
      if (!app.isQuitting) setTimeout(startFaceServer, 3000);
    });
  }
  startFaceServer();

  // Start Vidya Voice AI
  const vidyaExePath = isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'vidya_voice_ai', 'vidya_ai.exe') 
    : path.join(workDir, 'vidya_voice_ai', 'vidya_ai.exe');

  if (fs.existsSync(vidyaExePath)) {
    const vidyaProc = spawn(vidyaExePath, [], { 
      cwd: path.dirname(vidyaExePath), 
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    vidyaProc.stdout.on('data', (data) => logOutput('VIDYA_AI', data));
    vidyaProc.stderr.on('data', (data) => logOutput('VIDYA_AI_ERR', data));
    bgProcesses.push(vidyaProc);
    console.log("Vidya Voice AI started.");
  } else {
    logOutput('VIDYA_AI_ERR', `Could not find executable at ${vidyaExePath}`);
  }

  bgProcesses.forEach(proc => {
    proc.on('error', (err) => console.error("Process error:", err));
  });
}

function waitForServer(url, timeoutMs, callback) {
  const start = Date.now();
  function check() {
    if (Date.now() - start > timeoutMs) return callback(new Error("Timeout"));
    const req = http.get(url, (res) => {
      if ([200, 304, 401, 404].includes(res.statusCode)) {
        callback(null);
      } else {
        setTimeout(check, 1000);
      }
    });
    req.on('error', () => setTimeout(check, 1000));
  }
  check();
}

const GITHUB_USER = 'your-github-username';
const GITHUB_REPO = 'tapowan-school-system';

function checkForUpdates() {
  if (!app.isPackaged) return;
  const feedURL = `https://update.electronjs.org/${GITHUB_USER}/${GITHUB_REPO}/${process.platform}/${app.getVersion()}`;
  try {
    autoUpdater.setFeedURL({ url: feedURL });
    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const response = dialog.showMessageBoxSync({
        type: 'info',
        buttons: ['Restart & Update', 'Later'],
        title: 'Update Available',
        message: `Version ${releaseName} is ready. Restart to install?`
      });
      if (response === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', (err) => console.log('Auto-update error:', err.message));
    autoUpdater.checkForUpdates();
  } catch (error) {}
}

const LIVE_CLOUD_URL = 'https://tapowan-school.vercel.app';
const LOCAL_FALLBACK_URL = 'http://localhost:3000';

function checkUrlReachable(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch (_) {
      resolve(false);
    }
  });
}

async function startAppFlow() {
  startBackgroundServers();

  let logoImgHtml = '<span style="font-size: 42px;">🎓</span>';
  try {
    const logoPath = path.join(__dirname, 'public', 'educore_logo.png');
    if (fs.existsSync(logoPath)) {
      const b64 = fs.readFileSync(logoPath).toString('base64');
      logoImgHtml = `<img src="data:image/png;base64,${b64}" style="width: 76px; height: 76px; object-fit: contain; border-radius: 16px;" />`;
    }
  } catch (_) {}

  // Show immediate sleek loading state while servers spin up
  if (mainWindow) {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>EduCore - Starting Up...</title>
        <style>
          body { margin: 0; background: #0f172a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; -webkit-app-region: drag; }
          .logo-box { width: 90px; height: 90px; border-radius: 22px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
          .spinner { width: 34px; height: 34px; border: 3px solid rgba(59,130,246,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-top: 20px; }
          @keyframes spin { to { transform: rotate(360deg); } }
          h2 { font-size: 1.4rem; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em; }
          p { font-size: 0.88rem; color: #94a3b8; margin: 0; }
        </style>
      </head>
      <body>
        <div class="logo-box">
          ${logoImgHtml}
        </div>
        <h2>EduCore</h2>
        <p>Connecting to Cloud Portal & Background Engines...</p>
        <div class="spinner"></div>
      </body>
      </html>
    `)}`);
  }

  // Fast check: Is live cloud accessible?
  const isCloudOnline = await checkUrlReachable(LIVE_CLOUD_URL, 3500);

  if (isCloudOnline) {
    console.log(`[Hybrid Mode] Live cloud portal is active (${LIVE_CLOUD_URL}). Loading latest live deployment...`);
    if (mainWindow) {
      mainWindow.loadURL(LIVE_CLOUD_URL);
    }
  } else {
    console.log(`[Hybrid Mode] Cloud offline or unreachable. Falling back to local offline server (${LOCAL_FALLBACK_URL})...`);
    waitForServer(LOCAL_FALLBACK_URL, 150000, (err) => {
      if (err) return;
      if (mainWindow) mainWindow.loadURL(LOCAL_FALLBACK_URL);
    });
  }

  checkForUpdates();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    title: "EduCore — School Management System",
    icon: path.join(__dirname, 'public', 'icon.ico'),
    autoHideMenuBar: true,
    // Native frameless with Windows overlay controls (like WhatsApp, VS Code, Edge)
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111827',       // Dark gunmetal matching app header
      symbolColor: '#e2e8f0', // Light icons for contrast
      height: 36              // Compact like WhatsApp
    },
    backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Essential: Allows live web app to call local InsightFace (http://127.0.0.1:8000) & local WhatsApp without mixed-content blocks!
      allowRunningInsecureContent: true
    }
  });

  mainWindow.maximize();

  // Useful power shortcuts: F5 (Reload), Ctrl+Shift+R (Hard Refresh), F12 (DevTools), Ctrl+Shift+L (Toggle Cloud/Local)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload();
    }
    if (input.control && input.shift && input.key.toLowerCase() === 'r') {
      mainWindow.webContents.reloadIgnoringCache();
    }
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
    if (input.control && input.shift && input.key.toLowerCase() === 'l') {
      const current = mainWindow.webContents.getURL();
      const target = current.includes('tapowan-school') ? LOCAL_FALLBACK_URL : LIVE_CLOUD_URL;
      console.log(`[Hybrid Mode] Manually switching view to: ${target}`);
      mainWindow.loadURL(target);
    }
  });

  startAppFlow();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  migrateDatabase();
  createWindow();

  app.on('activate', function () {
    if (mainWindow === null) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  app.isQuitting = true;
  console.log("Shutting down background processes...");
  bgProcesses.forEach(proc => {
    try { proc.kill('SIGINT'); } catch (e) {}
  });
  spawn('taskkill', ['/F', '/T', '/PID', process.pid], { windowsHide: true });
});
