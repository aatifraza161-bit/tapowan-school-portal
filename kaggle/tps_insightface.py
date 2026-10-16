# -*- coding: utf-8 -*-
# ==============================================================================
# Tapowan Public School - Automated GPU InsightFace ArcFace 512-D Server
# Runs 100% in Cloud on Nvidia Tesla T4 GPU (Google Colab / Kaggle) with Auto-Sync to Turso Database
# ==============================================================================

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
    log(f"🔄 Auto-updating live URL in Turso Database: {url}")
    payload = {
        "requests": [
            {"type": "execute", "stmt": {"sql": "DELETE FROM settings WHERE key IN ('colab_insightface_url', 'kaggle_insightface_url', 'muse_insightface_url');"}},
            {"type": "execute", "stmt": {"sql": "INSERT INTO settings (key, value, category, updatedBy) VALUES ('colab_insightface_url', ?, 'AI', 'Cloud GPU Server');", "args": [{"type": "text", "value": url}]}},
            {"type": "execute", "stmt": {"sql": "INSERT INTO settings (key, value, category, updatedBy) VALUES ('kaggle_insightface_url', ?, 'AI', 'Cloud GPU Server');", "args": [{"type": "text", "value": url}]}},
            {"type": "close"}
        ]
    }
    try:
        r = requests.post(TURSO_URL, json=payload, headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"}, timeout=15)
        if r.ok:
            log("🎉 SUCCESS: Auto-registered live GPU URL with Turso DB! TPS Web Attendance portal will connect automatically.")
        else:
            log(f"⚠️ Turso response error: {r.status_code} {r.text}")
    except Exception as e:
        log(f"⚠️ Could not update Turso DB: {e}")

log("=" * 65)
log("🚀 STARTING TAPOWAN PUBLIC SCHOOL GPU AI SERVER (COLAB / KAGGLE)")
log("=" * 65)

log("\n[1/4] 📦 Installing Python dependencies (InsightFace, ONNX GPU, FastAPI)...")
subprocess.run([
    sys.executable, "-m", "pip", "install", "-q",
    "fastapi", "uvicorn", "insightface", "onnxruntime-gpu", "opencv-python-headless", "pillow", "requests", "python-multipart"
], check=False)

log("\n[2/4] 🌐 Downloading Cloudflare Tunnel binary...")
try:
    if not os.path.exists("cloudflared"):
        urllib.request.urlretrieve("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64", "cloudflared")
        os.chmod("cloudflared", 0o777)
        log("✅ Cloudflare tunnel binary downloaded & ready.")
    else:
        log("✅ Existing Cloudflare tunnel binary found.")
except Exception as e:
    log(f"⚠️ Error downloading cloudflared: {e}")

log("\n[3/4] ⚡ Generating FastAPI InsightFace Engine...")
with open("app.py", "w", encoding="utf-8") as f:
    f.write('''# -*- coding: utf-8 -*-
import os, numpy as np, cv2
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis

app = FastAPI(title="TPS InsightFace GPU Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🔄 Initializing InsightFace buffalo_l on Nvidia GPU...", flush=True)
face_app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("✅ InsightFace 512-D ArcFace ready on GPU!", flush=True)

@app.get("/")
@app.get("/health")
@app.get("/status")
def status():
    return {
        "status": "ok",
        "engine": "Cloud GPU 512-D ArcFace",
        "model": "buffalo_l",
        "active": True
    }

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

log("\n[4/4] 🚀 Launching Server & Creating Public Cloudflare HTTPS Tunnel...")
server_proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"])

tunnel_cmd = ["./cloudflared", "tunnel", "--url", "http://127.0.0.1:8000", "--no-autoupdate"]
tunnel_proc = subprocess.Popen(
    tunnel_cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

active_url = None
start_time = time.time()
while time.time() - start_time < 90:
    line = tunnel_proc.stdout.readline()
    if not line:
        time.sleep(0.5)
        continue
    line_clean = line.strip()
    if line_clean:
        log(line_clean)
    match = re.search(r'https://([a-zA-Z0-9-]+)\.trycloudflare\.com', line)
    if match and match.group(1) != "api":
        active_url = match.group(0)
        log("\n" + "=" * 65)
        log("🎉 YOUR LIVE GPU INSIGHTFACE URL IS READY!")
        log(f"👉 {active_url}")
        log("=" * 65 + "\n")
        update_turso(active_url)
        break

if not active_url:
    log("⚠️ Could not detect trycloudflare.com URL within 90 seconds. Checking tunnel output...")

log("✅ GPU Server active and listening for face detection requests!")
try:
    while True:
        time.sleep(60)
except KeyboardInterrupt:
    log("Stopping server...")
    server_proc.terminate()
    tunnel_proc.terminate()
