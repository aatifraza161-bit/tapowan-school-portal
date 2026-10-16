# -*- coding: utf-8 -*-
"""
Tapowan Public School - Dedicated Local InsightFace AI Server
Runs 100% locally on your computer with automatic Cloudflare Tunnel and Turso DB sync.
"""

import os
import sys
import subprocess
import time
import re
import urllib.request
import requests

TURSO_URL = 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io/v2/pipeline'
TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA'

def log(msg):
    print(msg, flush=True)

def update_turso(url):
    log(f"🔄 Syncing URL to Turso DB: {url}")
    payload = {
        "requests": [
            {"type": "execute", "stmt": {"sql": "DELETE FROM settings WHERE key IN ('colab_insightface_url', 'kaggle_insightface_url');"}},
            {"type": "execute", "stmt": {"sql": "INSERT INTO settings (key, value, category) VALUES ('colab_insightface_url', ?, 'AI');", "args": [{"type": "text", "value": url}]}},
            {"type": "execute", "stmt": {"sql": "INSERT INTO settings (key, value, category) VALUES ('kaggle_insightface_url', ?, 'AI');", "args": [{"type": "text", "value": url}]}},
            {"type": "close"}
        ]
    }
    try:
        r = requests.post(TURSO_URL, json=payload, headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"}, timeout=15)
        if r.ok:
            log("🎉 SUCCESS! Web Attendance portal has automatically connected to this Face Server!")
        else:
            log(f"⚠️ Turso update warning: {r.status_code}")
    except Exception as e:
        log(f"⚠️ Error updating Turso DB: {e}")

def get_cloudflared_path():
    # 1. Check existing whatsapp gateway cloudflared
    candidate = r"C:\Users\Admin\Desktop\Tapowan-WhatsApp-Gateway\cloudflared.exe"
    if os.path.exists(candidate):
        return candidate
    
    # 2. Check local script dir
    local_cf = os.path.join(os.path.dirname(__file__), "cloudflared.exe")
    if os.path.exists(local_cf):
        return local_cf

    # 3. Download if missing
    log("🌐 Downloading cloudflared.exe for Windows...")
    try:
        url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        urllib.request.urlretrieve(url, local_cf)
        log("✅ cloudflared.exe downloaded successfully.")
        return local_cf
    except Exception as e:
        log(f"⚠️ Could not download cloudflared: {e}")
        return None

def main():
    log("=" * 65)
    log("🚀 TAPOWAN PUBLIC SCHOOL - LOCAL INSIGHTFACE AI SERVER")
    log("=" * 65)

    cf_path = get_cloudflared_path()
    if not cf_path:
        log("❌ cloudflared.exe not found. Running in local-only mode (http://127.0.0.1:8000).")

    # Start FastAPI server via uvicorn
    app_file = os.path.join(os.path.dirname(__file__), "face_app.py")
    if not os.path.exists(app_file):
        with open(app_file, "w", encoding="utf-8") as f:
            f.write('''# -*- coding: utf-8 -*-
import os, numpy as np, cv2
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis

app = FastAPI(title="TPS InsightFace Engine")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

print("🔄 Initializing InsightFace buffalo_l...", flush=True)
face_app = FaceAnalysis(name='buffalo_l', allowed_modules=['detection', 'recognition'])
try:
    face_app.prepare(ctx_id=0, det_size=(640, 640))
    print("✅ InsightFace GPU mode ready!", flush=True)
except Exception as e:
    print(f"⚠️ GPU init fallback to CPU: {e}", flush=True)
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    print("✅ InsightFace CPU mode ready!", flush=True)

@app.get("/")
@app.get("/health")
@app.get("/status")
def status():
    return {"status": "ok", "engine": "InsightFace 512-D ArcFace", "active": True}

@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"faces": []}
    faces = face_app.get(img)
    out = []
    for f in faces:
        x, y, x2, y2 = f.bbox.astype(int)
        emb = f.embedding
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        w = max(1, x2 - x)
        h = max(1, y2 - y)
        out.append({
            "box": [int(x), int(y), int(w), int(h)],
            "bbox": [int(x), int(y), int(x2), int(y2)],
            "score": float(f.det_score) if hasattr(f, 'det_score') else 0.95,
            "embedding": emb.tolist()
        })
    return {"faces": out}

@app.post("/log_attendance")
async def log_attendance():
    return {"status": "ok"}
''')

    server_dir = os.path.dirname(app_file)
    log("⚡ Launching Uvicorn server on port 8000...")
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "face_app:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=server_dir
    )

    tunnel_proc = None
    if cf_path:
        log("🌐 Starting Cloudflare Public HTTPS Tunnel...")
        tunnel_proc = subprocess.Popen(
            [cf_path, "tunnel", "--url", "http://127.0.0.1:8000", "--no-autoupdate"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        active_url = None
        start_time = time.time()
        while time.time() - start_time < 60:
            line = tunnel_proc.stdout.readline()
            if not line:
                time.sleep(0.2)
                continue
            line_clean = line.strip()
            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line_clean)
            if match:
                active_url = match.group(0)
                log("\n" + "=" * 65)
                log("🎉 LIVE PUBLIC FACE SERVER URL:")
                log(f"👉 {active_url}")
                log("=" * 65 + "\n")
                update_turso(active_url)
                break

    log("✅ Face server running! Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Shutting down...")
        if server_proc:
            server_proc.terminate()
        if tunnel_proc:
            tunnel_proc.terminate()

if __name__ == "__main__":
    main()
