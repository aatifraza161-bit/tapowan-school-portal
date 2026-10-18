const os = require('os');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, autoUpdater, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
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

function startAppFlow() {
  startBackgroundServers();
  waitForServer('http://localhost:3000', 150000, (err) => {
    if (err) {
      return;
    }
    if(mainWindow) mainWindow.loadURL('http://localhost:3000');
  });
  checkForUpdates();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    title: "Tapowan Public School System",
    icon: path.join(__dirname, 'public', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.maximize();

  // Copy protection removed - always start app flow directly
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
