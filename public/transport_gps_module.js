// public/transport_gps_module.js
// High-Definition Live GPS Map Tracking & Telematics Engine for Tapowan Public School
// Features: Reverse-Engineered Google Maps Hybrid/Roadmap/Satellite/Traffic Layers
// Covering the entire Ramgarh – Hazaribagh – Barhi Transit Corridor (NH-20 / NH-33)

(function () {
  const SCHOOL_COORDS = {
    lat: 23.8209682,
    lng: 85.5119629,
    name: "Tapowan Public School (Prem Nagar)",
    radiusMeters: 50.0
  };

  // Ramgarh - Hazaribagh Regional Landmark Coordinates (NH-20 / NH-33 Corridor)
  const REGION_PRESETS = {
    campus: {
      name: "🏫 Tapowan Campus (Prem Nagar)",
      lat: 23.8209682,
      lng: 85.5119629,
      zoom: 16
    },
    corridor: {
      name: "🛣️ Ramgarh - Hazaribagh Transit Corridor (NH-20)",
      bounds: [
        [23.5800, 85.3000], // Ramgarh South-West
        [24.0600, 85.6200]  // Hazaribagh North-East
      ]
    },
    hazaribagh: {
      name: "📍 Hazaribagh Town Hub",
      lat: 23.9925,
      lng: 85.3637,
      zoom: 14
    },
    ramgarh: {
      name: "📍 Ramgarh Cantt Hub",
      lat: 23.6332,
      lng: 85.5149,
      zoom: 14
    }
  };

  // Key Corridor Transit Hubs along NH-20
  const CORRIDOR_HUBS = [
    { name: "Hazaribagh Hub", lat: 23.9925, lng: 85.3637, type: "city" },
    { name: "Demotand Chowk", lat: 23.9520, lng: 85.3900, type: "junction" },
    { name: "Charhi", lat: 23.8780, lng: 85.4380, type: "town" },
    { name: "Prem Nagar (Tapowan Campus)", lat: 23.8209682, lng: 85.5119629, type: "school" },
    { name: "Mandu", lat: 23.7930, lng: 85.4740, type: "town" },
    { name: "Kuju", lat: 23.7225, lng: 85.5080, type: "town" },
    { name: "Ramgarh Cantt", lat: 23.6332, lng: 85.5149, type: "city" }
  ];

  let transportMap = null;
  let vanMarker = null;
  let schoolMarker = null;
  let geofenceCircle = null;
  let historyPolyline = null;
  let corridorHubsLayer = null;
  let pollIntervalTimer = null;
  let activeTab = "map"; // "map" | "roster" | "setup"
  let autoFollow = true;
  let currentVehicleNo = "JH-02-VAN-01";
  let activeVehiclesList = [];

  // Tile layer handles
  let googleHybridLayer = null;
  let googleRoadmapLayer = null;
  let googleSatelliteLayer = null;
  let googleTerrainLayer = null;
  let googleTrafficOverlay = null;
  let osmStandardLayer = null;
  let layerControl = null;

  // Ensure Leaflet is loaded
  function ensureLeafletLoaded(callback) {
    if (typeof L !== "undefined") {
      return callback();
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => callback();
    document.head.appendChild(script);
  }

  // Custom Animated Van SVG Icon
  function createVanIcon(heading = 0, isMoving = false, status = "Moving", speed = 0) {
    const isOnline = (status === "Moving" || status === "Idle" || status === "At Campus");
    const glowColor = isMoving ? "#22c55e" : (isOnline ? "#38bdf8" : "#94a3b8");
    const speedText = isMoving ? `${Math.round(speed || 34)} km/h` : status;

    const html = `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
        ${isMoving ? `<div style="position:absolute; width:44px; height:44px; border-radius:50%; background:${glowColor}33; animation:vanPulse 1.5s infinite;"></div>` : ''}
        <div style="width:36px; height:36px; border-radius:50%; background:#0f172a; border:2.5px solid ${glowColor}; box-shadow:0 4px 10px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; transform:rotate(${heading}deg); transition:transform 0.5s ease;">
          <span style="font-size:18px; transform:rotate(-${heading}deg);">🚐</span>
        </div>
        <div style="position:absolute; bottom:-6px; background:#0f172a; color:#fff; font-size:9px; font-weight:800; padding:1px 6px; border-radius:10px; border:1px solid ${glowColor}; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
          ${speedText}
        </div>
      </div>
    `;

    return L.divIcon({
      className: "van-custom-marker",
      html: html,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22]
    });
  }

  // School Campus Pin Icon
  function createSchoolIcon() {
    const html = `
      <div style="position:relative; width:42px; height:42px; display:flex; align-items:center; justify-content:center;">
        <div style="width:36px; height:36px; border-radius:50%; background:#d97706; border:2.5px solid #ffffff; box-shadow:0 4px 14px rgba(217,119,6,0.5); display:flex; align-items:center; justify-content:center;">
          <span style="font-size:18px;">🏫</span>
        </div>
      </div>
    `;
    return L.divIcon({
      className: "school-custom-marker",
      html: html,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -21]
    });
  }

  // Render Full Transport Dashboard with Map & Tabs
  window.renderTransportGpsDashboard = function (container) {
    if (!container) return;

    // Inject styles for van animation & leaflet controls
    if (!document.getElementById("vanGpsStyles")) {
      const st = document.createElement("style");
      st.id = "vanGpsStyles";
      st.textContent = `
        @keyframes vanPulse { 0% { transform:scale(0.8); opacity:0.8; } 50% { transform:scale(1.4); opacity:0.2; } 100% { transform:scale(1.6); opacity:0; } }
        .van-hud-card { background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:4px; }
        .van-tab-btn { padding:10px 18px; border-radius:8px; font-size:0.88rem; font-weight:700; cursor:pointer; border:1.5px solid transparent; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s; }
        .van-tab-btn.active { background:#1e293b; color:#ffffff; }
        .van-tab-btn:not(.active) { background:#f1f5f9; color:#475569; border-color:#e2e8f0; }
        .van-tab-btn:not(.active):hover { background:#e2e8f0; color:#1e293b; }
        .leaflet-control-layers {
          border-radius: 10px !important;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18) !important;
          border: 1.5px solid #cbd5e1 !important;
          font-family: inherit !important;
          font-size: 0.82rem !important;
          font-weight: 600 !important;
          padding: 8px 12px !important;
          background: rgba(255, 255, 255, 0.95) !important;
          backdrop-filter: blur(4px);
        }
        .leaflet-control-layers-base label, .leaflet-control-layers-overlays label {
          margin-bottom: 4px !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          cursor: pointer !important;
        }
      `;
      document.head.appendChild(st);
    }

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Header & Nav Tabs -->
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px 22px; box-shadow:0 1px 3px rgba(0,0,0,0.03); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:24px;">🚐</span>
              <h2 style="margin:0; font-size:1.35rem; font-weight:800; color:#0f172a;">School Van & Bus GPS Live Tracking</h2>
            </div>
            <p style="margin:4px 0 0; color:#64748b; font-size:0.85rem;">
              Real-time Google Maps satellite telematics & live traffic covering Ramgarh &bull; Mandu &bull; Charhi &bull; Prem Nagar &bull; Hazaribagh (NH-20)
            </p>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="van-tab-btn ${activeTab === 'map' ? 'active' : ''}" id="btn_vanTab_map">
              <span>🗺️</span> Live GPS Tracker
            </button>
            <button type="button" class="van-tab-btn ${activeTab === 'roster' ? 'active' : ''}" id="btn_vanTab_roster">
              <span>📋</span> Route & Student Allocations
            </button>
            <button type="button" class="van-tab-btn ${activeTab === 'setup' ? 'active' : ''}" id="btn_vanTab_setup">
              <span>📡</span> Hardware GPS Setup Guide
            </button>
          </div>
        </div>

        <!-- TAB 1: LIVE GPS MAP -->
        <div id="vanTabContent_map" style="display:${activeTab === 'map' ? 'flex' : 'none'}; flex-direction:column; gap:16px;">
          <!-- Telematics HUD Cards -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px;">
            <div class="van-hud-card">
              <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Vehicle Status</div>
              <div id="hud_vanStatus" style="font-size:1.15rem; font-weight:800; color:#16a34a; display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#16a34a;"></span>
                <span>Connecting...</span>
              </div>
              <div id="hud_vehicleName" style="font-size:0.75rem; color:#64748b; font-weight:600;">JH-02-VAN-01 &bull; School Van</div>
            </div>

            <div class="van-hud-card">
              <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Current Speed</div>
              <div id="hud_vanSpeed" style="font-size:1.45rem; font-weight:900; color:#0284c7; line-height:1.1;">0 <span style="font-size:0.8rem; font-weight:700; color:#64748b;">km/h</span></div>
              <div id="hud_ignition" style="font-size:0.75rem; color:#16a34a; font-weight:700;">Engine / ACC: ON</div>
            </div>

            <div class="van-hud-card">
              <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Distance to Campus</div>
              <div id="hud_vanDistance" style="font-size:1.45rem; font-weight:900; color:#d97706; line-height:1.1;">-- <span style="font-size:0.8rem; font-weight:700; color:#64748b;">km</span></div>
              <div id="hud_geofence" style="font-size:0.75rem; color:#64748b; font-weight:600;">Prem Nagar (50m Geofence)</div>
            </div>

            <div class="van-hud-card">
              <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Estimated Arrival (ETA)</div>
              <div id="hud_vanEta" style="font-size:1.45rem; font-weight:900; color:#7c3aed; line-height:1.1;">-- <span style="font-size:0.8rem; font-weight:700; color:#64748b;">mins</span></div>
              <div id="hud_lastPing" style="font-size:0.75rem; color:#64748b; font-weight:600;">Last signal: Just now</div>
            </div>

            <div class="van-hud-card">
              <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Driver In-Charge</div>
              <div id="hud_driverName" style="font-size:1.05rem; font-weight:800; color:#1e293b;">Ramesh Yadav</div>
              <div style="margin-top:2px;">
                <a id="hud_driverCallBtn" href="tel:9876543210" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:700; color:#2563eb; text-decoration:none; background:#eff6ff; padding:2px 8px; border-radius:6px;">
                  📞 9876543210 &bull; Call Driver
                </a>
              </div>
            </div>
          </div>

          <!-- Map Box & Toolbar -->
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <!-- Map Action Controls Header -->
            <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="display:inline-flex; align-items:center; gap:5px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:20px;">
                  <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#16a34a;"></span>
                  LIVE GPS FEED
                </span>
                <span style="display:inline-flex; align-items:center; gap:5px; background:#eff6ff; color:#1d4ed8; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:20px; border:1px solid #bfdbfe;">
                  <span>🛰️</span> Google Maps &bull; Ramgarh & Hazaribagh Corridor
                </span>
                <span id="mapVehicleSelectorWrap"></span>
              </div>

              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <!-- Regional Quick-Focus Buttons -->
                <div style="display:inline-flex; align-items:center; background:#e2e8f0; padding:2px; border-radius:8px; gap:2px;">
                  <button type="button" id="btn_focusCampus" class="btn secondary" style="padding:4px 8px; font-size:0.75rem; font-weight:700; border-radius:5px; border:none; background:#ffffff; color:#0f172a;" title="Campus (Prem Nagar)">
                    🏫 Campus
                  </button>
                  <button type="button" id="btn_focusCorridor" class="btn secondary" style="padding:4px 8px; font-size:0.75rem; font-weight:700; border-radius:5px; border:none; background:#ffffff; color:#0f172a;" title="Ramgarh - Hazaribagh NH-20 Highway Corridor">
                    🛣️ Ramgarh - Hazaribagh
                  </button>
                  <button type="button" id="btn_focusHazaribagh" class="btn secondary" style="padding:4px 8px; font-size:0.75rem; font-weight:700; border-radius:5px; border:none; background:#ffffff; color:#0f172a;" title="Hazaribagh Town Hub">
                    📍 Hazaribagh
                  </button>
                  <button type="button" id="btn_focusRamgarh" class="btn secondary" style="padding:4px 8px; font-size:0.75rem; font-weight:700; border-radius:5px; border:none; background:#ffffff; color:#0f172a;" title="Ramgarh Cantt Hub">
                    📍 Ramgarh
                  </button>
                </div>

                <button type="button" id="btn_mapCenterVan" class="btn secondary" style="padding:5px 12px; font-size:0.78rem; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                  🚐 Center Van
                </button>
                <button type="button" id="btn_mapFollowToggle" class="btn secondary" style="padding:5px 12px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#dcfce7; color:#15803d; display:inline-flex; align-items:center; gap:4px;">
                  ⚡ Auto-Follow: ON
                </button>
                <button type="button" id="btn_mapSimulate" class="btn secondary" style="padding:5px 12px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#fef3c7; border-color:#f59e0b; color:#b45309; display:inline-flex; align-items:center; gap:4px;" title="Test live movement animation on map">
                  ▶ Test Motion Simulation
                </button>
                <a href="/driver-gps.html" target="_blank" class="btn secondary" style="padding:5px 12px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#eff6ff; border-color:#3b82f6; color:#1d4ed8; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                  📱 Driver Mobile GPS
                </a>
              </div>
            </div>

            <!-- Leaflet Map Div -->
            <div id="transportGpsMapContainer" style="width:100%; height:550px; background:#e2e8f0; position:relative;">
              <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; color:#64748b;">
                <div class="spinner" style="width:36px; height:36px; border:3px solid #cbd5e1; border-top-color:#3b82f6; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 10px;"></div>
                <div style="font-weight:700; font-size:0.9rem;">Initializing Google Maps Satellite & Telematics...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: ROUTE & STUDENT ALLOCATIONS (Table view) -->
        <div id="vanTabContent_roster" style="display:${activeTab === 'roster' ? 'block' : 'none'};">
          <div id="vanOriginalTablePlaceholder"></div>
        </div>

        <!-- TAB 3: HARDWARE GPS SETUP GUIDE -->
        <div id="vanTabContent_setup" style="display:${activeTab === 'setup' ? 'block' : 'none'};">
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:20px;">
            <div>
              <h3 style="margin:0 0 6px; font-size:1.15rem; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>📡</span> How to Connect Your School Van Hardware GPS Tracker
              </h3>
              <p style="margin:0; color:#64748b; font-size:0.88rem;">Our universal GPS gateway supports SinoTrack (ST-901/902), Coban (TK103), Concox, AIS-140, Teltonika, and any GPRS SIM tracker with HTTP webhook or OsmAnd protocol.</p>
            </div>

            <!-- Webhook Server URL Box -->
            <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:16px;">
              <div style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:6px;">Your Dedicated GPS Webhook URL:</div>
              <div style="display:flex; gap:8px; align-items:center;">
                <input type="text" id="gpsWebhookUrlCopy" readonly value="${window.location.origin}/api/transport/gps/update" style="flex:1; padding:10px 14px; font-family:monospace; font-size:0.9rem; font-weight:700; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:8px; color:#1e293b;">
                <button type="button" id="btn_copyWebhookUrl" class="btn primary" style="padding:10px 18px; font-size:0.85rem; font-weight:700; white-space:nowrap;">
                  📋 Copy URL
                </button>
              </div>
            </div>

            <!-- Tracker Models Configuration Grid -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
              <!-- SinoTrack -->
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-bottom:6px;">1. SinoTrack (ST-901 / ST-902 / ST-905)</div>
                <p style="font-size:0.82rem; color:#64748b; margin-bottom:10px;">Send these SMS commands to the SIM card inside the tracker:</p>
                <div style="background:#0f172a; color:#38bdf8; padding:10px 12px; border-radius:6px; font-family:monospace; font-size:0.8rem; line-height:1.6;">
                  8040000 tapowan-school.vercel.app 80<br>
                  7100000<br>
                  8050000 10
                </div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:8px;">*Sets server address, activates GPRS mode, and uploads every 10 seconds.</div>
              </div>

              <!-- Coban / TK103 -->
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-bottom:6px;">2. Coban (TK102 / TK103 / GPS103)</div>
                <p style="font-size:0.82rem; color:#64748b; margin-bottom:10px;">Send these SMS commands to the tracker SIM:</p>
                <div style="background:#0f172a; color:#38bdf8; padding:10px 12px; border-radius:6px; font-family:monospace; font-size:0.8rem; line-height:1.6;">
                  adminip123456 tapowan-school.vercel.app 80<br>
                  gprs123456<br>
                  fix010s***n123456
                </div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:8px;">*Default password is 123456. Configures server IP and 10s interval.</div>
              </div>

              <!-- AIS-140 & Generic HTTP -->
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-bottom:6px;">3. AIS-140 / Concox / Custom HTTP GPS</div>
                <p style="font-size:0.82rem; color:#64748b; margin-bottom:10px;">Send standard HTTP GET or POST requests:</p>
                <div style="background:#0f172a; color:#38bdf8; padding:10px 12px; border-radius:6px; font-family:monospace; font-size:0.8rem; line-height:1.6; word-break:break-all;">
                  GET /api/transport/gps/update?id=JH-02-VAN-01&lat=23.8210&lon=85.5120&speed=35&bearing=90
                </div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:8px;">*Compatible with OsmAnd, Traccar client, or any HTTP webhook forwarder.</div>
              </div>
            </div>

            <!-- Zero-Hardware Driver Phone Mode Notice -->
            <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:10px; padding:16px; display:flex; gap:12px; align-items:flex-start;">
              <span style="font-size:24px;">💡</span>
              <div>
                <div style="font-weight:800; font-size:0.92rem; color:#1e40af;">Zero-Cost Instant GPS Tracking via Mobile Phone</div>
                <p style="font-size:0.83rem; color:#1e3a8a; margin:4px 0 8px;">If you want to track the van immediately before your hardware GPS tracker is configured, the driver can open <a href="/driver-gps.html" target="_blank" style="font-weight:800; color:#2563eb;">/driver-gps.html</a> on any phone mounted on the van dashboard and tap "Start Tracking". It keeps the phone awake and broadcasts live satellite telemetry!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire Tabs
    const tabMap = container.querySelector("#btn_vanTab_map");
    const tabRoster = container.querySelector("#btn_vanTab_roster");
    const tabSetup = container.querySelector("#btn_vanTab_setup");

    const contentMap = container.querySelector("#vanTabContent_map");
    const contentRoster = container.querySelector("#vanTabContent_roster");
    const contentSetup = container.querySelector("#vanTabContent_setup");

    const switchTab = (tab) => {
      activeTab = tab;
      [tabMap, tabRoster, tabSetup].forEach(t => t.classList.remove("active"));
      contentMap.style.display = (tab === "map") ? "flex" : "none";
      contentRoster.style.display = (tab === "roster") ? "block" : "none";
      contentSetup.style.display = (tab === "setup") ? "block" : "none";

      const tableWrapEl = document.querySelector(".table-wrap");
      const toolsPanel = document.querySelector(".tools-panel");
      if (tableWrapEl) tableWrapEl.style.display = (tab === "roster") ? "block" : "none";
      if (toolsPanel) toolsPanel.style.display = (tab === "roster") ? "flex" : "none";

      if (tab === "map") {
        tabMap.classList.add("active");
        if (transportMap) {
          setTimeout(() => { transportMap.invalidateSize(); }, 200);
        }
      } else if (tab === "roster") {
        tabRoster.classList.add("active");
      } else if (tab === "setup") {
        tabSetup.classList.add("active");
      }
    };

    if (tabMap) tabMap.addEventListener("click", () => switchTab("map"));
    if (tabRoster) tabRoster.addEventListener("click", () => switchTab("roster"));
    if (tabSetup) tabSetup.addEventListener("click", () => switchTab("setup"));

    // Copy Webhook URL button
    const copyBtn = container.querySelector("#btn_copyWebhookUrl");
    const copyInput = container.querySelector("#gpsWebhookUrlCopy");
    if (copyBtn && copyInput) {
      copyBtn.addEventListener("click", () => {
        copyInput.select();
        navigator.clipboard.writeText(copyInput.value);
        copyBtn.textContent = "✓ Copied!";
        setTimeout(() => { copyBtn.textContent = "📋 Copy URL"; }, 2000);
      });
    }

    // Regional Jump Buttons
    const btnFocusCampus = container.querySelector("#btn_focusCampus");
    if (btnFocusCampus) {
      btnFocusCampus.addEventListener("click", () => {
        if (transportMap) {
          transportMap.flyTo([REGION_PRESETS.campus.lat, REGION_PRESETS.campus.lng], REGION_PRESETS.campus.zoom, { duration: 1.2 });
        }
      });
    }

    const btnFocusCorridor = container.querySelector("#btn_focusCorridor");
    if (btnFocusCorridor) {
      btnFocusCorridor.addEventListener("click", () => {
        if (transportMap) {
          transportMap.fitBounds(REGION_PRESETS.corridor.bounds, { padding: [30, 30], animate: true, duration: 1.2 });
        }
      });
    }

    const btnFocusHazaribagh = container.querySelector("#btn_focusHazaribagh");
    if (btnFocusHazaribagh) {
      btnFocusHazaribagh.addEventListener("click", () => {
        if (transportMap) {
          transportMap.flyTo([REGION_PRESETS.hazaribagh.lat, REGION_PRESETS.hazaribagh.lng], REGION_PRESETS.hazaribagh.zoom, { duration: 1.2 });
        }
      });
    }

    const btnFocusRamgarh = container.querySelector("#btn_focusRamgarh");
    if (btnFocusRamgarh) {
      btnFocusRamgarh.addEventListener("click", () => {
        if (transportMap) {
          transportMap.flyTo([REGION_PRESETS.ramgarh.lat, REGION_PRESETS.ramgarh.lng], REGION_PRESETS.ramgarh.zoom, { duration: 1.2 });
        }
      });
    }

    // Map Action Buttons
    const btnCenterVan = container.querySelector("#btn_mapCenterVan");
    if (btnCenterVan) {
      btnCenterVan.addEventListener("click", () => {
        if (vanMarker && transportMap) {
          transportMap.flyTo(vanMarker.getLatLng(), 16, { duration: 1 });
        }
      });
    }

    const btnFollowToggle = container.querySelector("#btn_mapFollowToggle");
    if (btnFollowToggle) {
      btnFollowToggle.addEventListener("click", () => {
        autoFollow = !autoFollow;
        btnFollowToggle.textContent = autoFollow ? "⚡ Auto-Follow: ON" : "⚡ Auto-Follow: OFF";
        btnFollowToggle.style.background = autoFollow ? "#dcfce7" : "#f1f5f9";
        btnFollowToggle.style.color = autoFollow ? "#15803d" : "#475569";
      });
    }

    const btnSimulate = container.querySelector("#btn_mapSimulate");
    if (btnSimulate) {
      btnSimulate.addEventListener("click", async () => {
        try {
          btnSimulate.textContent = "⏳ Starting Simulation...";
          const res = await fetch("/api/transport/gps/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicleNo: currentVehicleNo })
          });
          const data = await res.json();
          if (data.ok) {
            if (typeof showToast === "function") showToast("Started Van Motion Simulation (Barhi to Tapowan Campus)", "success");
            btnSimulate.textContent = "✓ Simulation Running (4s)";
            setTimeout(() => { btnSimulate.textContent = "▶ Test Motion Simulation"; }, 15000);
            fetchLiveGpsData();
          }
        } catch (e) {
          console.error("Simulation error:", e);
        }
      });
    }

    // Initial tab state
    switchTab(activeTab);

    // Initialize Leaflet Map with Google Maps Layers
    ensureLeafletLoaded(() => {
      initLeafletMap(container);
    });
  };

  // Initialize Map Instance with Reverse-Engineered Google Maps Engine
  function initLeafletMap(container) {
    const mapDiv = document.getElementById("transportGpsMapContainer");
    if (!mapDiv) return;

    if (transportMap) {
      try { transportMap.remove(); } catch(e){}
      transportMap = null;
    }

    mapDiv.innerHTML = ""; // Clear loader

    // Default center at Tapowan Public School Prem Nagar campus
    transportMap = L.map("transportGpsMapContainer", {
      center: [SCHOOL_COORDS.lat, SCHOOL_COORDS.lng],
      zoom: 15,
      zoomControl: true
    });

    // 1. Google Hybrid Layer (Satellite + Highway Networks + Settlement labels in English & Hindi)
    googleHybridLayer = L.tileLayer("https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["0", "1", "2", "3"],
      attribution: '&copy; <a href="https://maps.google.com" target="_blank">Google Maps</a> &bull; Ramgarh & Hazaribagh Satellite'
    });

    // 2. Google Roadmap Layer (Clean high-definition vector streets)
    googleRoadmapLayer = L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["0", "1", "2", "3"],
      attribution: '&copy; Google Maps Streets'
    });

    // 3. Google Satellite (Raw high-resolution photographic imagery)
    googleSatelliteLayer = L.tileLayer("https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["0", "1", "2", "3"],
      attribution: '&copy; Google Maps Satellite'
    });

    // 4. Google Terrain (Topographic contours and hill shading)
    googleTerrainLayer = L.tileLayer("https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["0", "1", "2", "3"],
      attribution: '&copy; Google Maps Terrain'
    });

    // 5. OpenStreetMap Standard (Fallback)
    osmStandardLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    // 6. Google Live Traffic Overlay (Real-time traffic congestion on NH-20 and regional roads)
    googleTrafficOverlay = L.tileLayer("https://mt{s}.google.com/vt?lyrs=h,traffic|seconds_into_week:-1&style=15&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["0", "1", "2", "3"],
      opacity: 0.9,
      attribution: '&copy; Google Maps Live Real-Time Traffic'
    });

    // Add Default Primary Layers: Google Hybrid + Live Traffic
    googleHybridLayer.addTo(transportMap);
    googleTrafficOverlay.addTo(transportMap);

    // School Campus Marker & 50m Geofence Circle
    schoolMarker = L.marker([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], {
      icon: createSchoolIcon()
    }).addTo(transportMap);

    schoolMarker.bindPopup(`
      <div style="font-family:sans-serif; padding:4px;">
        <div style="font-weight:800; font-size:0.95rem; color:#d97706;">🏫 Tapowan Public School</div>
        <div style="font-size:0.8rem; color:#475569; margin-top:2px;">Prem Nagar Campus &bull; 50m Radius</div>
        <div style="font-size:0.75rem; color:#16a34a; font-weight:700; margin-top:4px;">📍 NH-20 Ramgarh - Hazaribagh Corridor</div>
      </div>
    `);

    geofenceCircle = L.circle([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], {
      radius: SCHOOL_COORDS.radiusMeters,
      color: "#16a34a",
      fillColor: "#22c55e",
      fillOpacity: 0.22,
      weight: 2.5,
      dashArray: "4, 4"
    }).addTo(transportMap);

    // History polyline
    historyPolyline = L.polyline([], {
      color: "#38bdf8",
      weight: 4,
      opacity: 0.85,
      dashArray: "6, 6"
    }).addTo(transportMap);

    // Corridor Transit Hubs Layer
    const hubMarkers = CORRIDOR_HUBS.map(hub => {
      const isSchool = hub.type === "school";
      const color = isSchool ? "#d97706" : (hub.type === "city" ? "#2563eb" : "#475569");
      const icon = L.divIcon({
        className: "hub-pin",
        html: `<div style="background:${color}; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:12px; border:1.5px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); white-space:nowrap;">${hub.name}</div>`,
        iconAnchor: [30, 10]
      });
      return L.marker([hub.lat, hub.lng], { icon: icon }).bindPopup(`<strong>${hub.name}</strong><br>NH-20 Transit Hub`);
    });
    corridorHubsLayer = L.layerGroup(hubMarkers).addTo(transportMap);

    // Add Base & Overlay Controls
    const baseLayers = {
      "🛰️ Google Hybrid (Satellite + Roads)": googleHybridLayer,
      "🗺️ Google Roadmap (Streets)": googleRoadmapLayer,
      "🌍 Google Satellite (Raw)": googleSatelliteLayer,
      "🏔️ Google Terrain (Contours)": googleTerrainLayer,
      "🌐 OpenStreetMap Standard": osmStandardLayer
    };

    const overlayLayers = {
      "🚦 Google Live Traffic Overlay": googleTrafficOverlay,
      "🏫 School 50m Geofence": geofenceCircle,
      "🛣️ Van Breadcrumb Path": historyPolyline,
      "📍 NH-20 Corridor Transit Hubs": corridorHubsLayer
    };

    layerControl = L.control.layers(baseLayers, overlayLayers, {
      position: "topright",
      collapsed: false
    }).addTo(transportMap);

    // Leaflet Scale Control (Metric)
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(transportMap);

    // Initial Van Marker
    vanMarker = L.marker([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], {
      icon: createVanIcon(0, false, "Connecting...", 0)
    }).addTo(transportMap);

    // Start Real-Time Telematics Polling (every 3.5 seconds)
    fetchLiveGpsData();
    if (pollIntervalTimer) clearInterval(pollIntervalTimer);
    pollIntervalTimer = setInterval(() => {
      if (document.getElementById("transportGpsMapContainer") && activeTab === "map") {
        fetchLiveGpsData();
      }
    }, 3500);
  }

  // Update or render Vehicle Switcher Dropdown
  function updateVehicleSelector(vehicles) {
    const wrap = document.getElementById("mapVehicleSelectorWrap");
    if (!wrap || !vehicles || !vehicles.length) return;

    let select = document.getElementById("mapVehicleSelect");
    if (!select) {
      wrap.innerHTML = `
        <select id="mapVehicleSelect" style="padding:4px 10px; font-size:0.78rem; font-weight:700; border-radius:6px; border:1.5px solid #cbd5e1; background:#ffffff; color:#0f172a; cursor:pointer;">
          ${vehicles.map(v => `<option value="${v.vehicleNo}" ${v.vehicleNo === currentVehicleNo ? 'selected' : ''}>${v.vehicleNo} (${v.routeName || 'School Van'})</option>`).join('')}
        </select>
      `;
      select = document.getElementById("mapVehicleSelect");
      select.addEventListener("change", (e) => {
        currentVehicleNo = e.target.value;
        const van = activeVehiclesList.find(v => v.vehicleNo === currentVehicleNo);
        if (van) {
          updateHudDisplays(van);
          updateMapMarker(van);
          fetchBreadcrumbTrail(van.vehicleNo);
          if (vanMarker && transportMap) {
            transportMap.flyTo(vanMarker.getLatLng(), 16, { duration: 1 });
          }
        }
      });
    }
  }

  // Fetch Live Telemetry from /api/transport/gps/live
  async function fetchLiveGpsData() {
    try {
      const res = await fetch("/api/transport/gps/live");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !data.vehicles || !data.vehicles.length) return;

      activeVehiclesList = data.vehicles;
      updateVehicleSelector(activeVehiclesList);

      const van = data.vehicles.find(v => v.vehicleNo === currentVehicleNo) || data.vehicles[0];
      if (!van) return;

      currentVehicleNo = van.vehicleNo;
      updateHudDisplays(van);
      updateMapMarker(van);
      fetchBreadcrumbTrail(van.vehicleNo);
    } catch (e) {
      console.warn("GPS live fetch error:", e);
    }
  }

  // Update HUD Cards with Live Sensor Data
  function updateHudDisplays(van) {
    const hudStatus = document.getElementById("hud_vanStatus");
    const hudVehicleName = document.getElementById("hud_vehicleName");
    const hudSpeed = document.getElementById("hud_vanSpeed");
    const hudIgnition = document.getElementById("hud_ignition");
    const hudDist = document.getElementById("hud_vanDistance");
    const hudEta = document.getElementById("hud_vanEta");
    const hudLastPing = document.getElementById("hud_lastPing");
    const hudDriverName = document.getElementById("hud_driverName");
    const hudCallBtn = document.getElementById("hud_driverCallBtn");

    if (hudStatus) {
      const isOnline = van.isOnline;
      const isMoving = van.status === "Moving";
      const color = isMoving ? "#16a34a" : (isOnline ? "#0284c7" : "#64748b");
      hudStatus.style.color = color;
      hudStatus.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color};"></span>
        <span>${van.status}</span>
      `;
    }

    if (hudVehicleName) hudVehicleName.textContent = `${van.vehicleNo} • ${van.routeName || 'School Van'}`;
    if (hudSpeed) hudSpeed.innerHTML = `${Math.round(van.speed || 0)} <span style="font-size:0.8rem; font-weight:700; color:#64748b;">km/h</span>`;
    if (hudIgnition) {
      const ign = van.ignition || (van.isOnline ? "ON" : "OFF");
      hudIgnition.textContent = `Engine / ACC: ${ign}`;
      hudIgnition.style.color = (ign === "ON") ? "#16a34a" : "#dc2626";
    }

    if (hudDist) hudDist.innerHTML = `${van.distanceFromCampusKm} <span style="font-size:0.8rem; font-weight:700; color:#64748b;">km</span>`;
    if (hudEta) {
      if (van.isInsideGeofence) {
        hudEta.innerHTML = `<span style="color:#16a34a;">At School</span>`;
      } else {
        hudEta.innerHTML = `~${van.etaMinutes} <span style="font-size:0.8rem; font-weight:700; color:#64748b;">mins</span>`;
      }
    }

    if (hudLastPing) {
      const age = van.ageSeconds || 0;
      hudLastPing.textContent = age < 5 ? "Last signal: Just now" : `Last signal: ${age}s ago`;
    }

    if (hudDriverName) hudDriverName.textContent = van.driverName || "School Driver";
    if (hudCallBtn && van.driverPhone) {
      hudCallBtn.href = `tel:${van.driverPhone}`;
      hudCallBtn.innerHTML = `📞 ${van.driverPhone} &bull; Call Driver`;
    }
  }

  // Update Van Marker Position & Popup
  function updateMapMarker(van) {
    if (!transportMap || !vanMarker) return;

    const lat = van.latitude;
    const lng = van.longitude;
    const speed = van.speed || 0;
    const isMoving = (van.status === "Moving");

    vanMarker.setLatLng([lat, lng]);
    vanMarker.setIcon(createVanIcon(van.heading || 0, isMoving, van.status, speed));

    // Update Popup content
    const popupHtml = `
      <div style="font-family:sans-serif; min-width:190px; padding:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:6px;">
          <strong style="color:#0f172a; font-size:0.95rem;">🚐 ${van.vehicleNo}</strong>
          <span style="font-size:0.75rem; font-weight:800; color:${isMoving ? '#16a34a' : '#0284c7'};">${van.status}</span>
        </div>
        <div style="font-size:0.8rem; color:#475569; line-height:1.5;">
          <div><strong>Speed:</strong> ${Math.round(speed)} km/h</div>
          <div><strong>To Campus:</strong> ${van.distanceFromCampusKm} km (~${van.etaMinutes} mins)</div>
          <div><strong>Corridor:</strong> NH-20 Ramgarh &bull; Hazaribagh</div>
          <div><strong>Driver:</strong> ${van.driverName || 'Driver'}</div>
        </div>
        ${van.driverPhone ? `<a href="tel:${van.driverPhone}" style="display:block; text-align:center; background:#2563eb; color:#fff; font-size:0.75rem; font-weight:700; text-decoration:none; padding:5px 8px; border-radius:6px; margin-top:8px;">📞 Call Driver (${van.driverPhone})</a>` : ''}
      </div>
    `;
    vanMarker.bindPopup(popupHtml);

    // Auto-pan if enabled
    if (autoFollow) {
      transportMap.panTo([lat, lng], { animate: true, duration: 1 });
    }
  }

  // Fetch Breadcrumb Trail Path
  async function fetchBreadcrumbTrail(vehicleNo) {
    if (!historyPolyline) return;
    try {
      const res = await fetch(`/api/transport/gps/history?vehicleNo=${encodeURIComponent(vehicleNo)}&limit=100`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && data.trail && data.trail.length) {
        const pts = data.trail.map(t => [t.lat, t.lng]);
        historyPolyline.setLatLngs(pts);
      }
    } catch(e){}
  }
})();
