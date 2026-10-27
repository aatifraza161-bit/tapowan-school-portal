// public/transport_gps_module.js
// Real Google Maps Live Site & Telematics Tracking Engine for Tapowan Public School
// Displays the Official Interactive Google Maps Web Interface (Real Site) with
// Ramgarh & Hazaribagh Regional Jump Controls, Live Telematics HUD, and Fleet Tracking

(function () {
  const SCHOOL_COORDS = {
    lat: 23.8209682,
    lng: 85.5119629,
    name: "Tapowan Public School (Prem Nagar)",
    radiusMeters: 50.0
  };

  // Ramgarh - Hazaribagh Regional Corridor Presets (NH-20 / NH-33)
  const REGION_PRESETS = {
    campus: {
      name: "🏫 Tapowan Campus (Prem Nagar)",
      query: "23.8209682,85.5119629(Tapowan+Public+School+Prem+Nagar)",
      lat: 23.8209682,
      lng: 85.5119629,
      zoom: 16
    },
    corridor: {
      name: "🛣️ Ramgarh - Hazaribagh Transit Corridor (NH-20)",
      query: "Ramgarh+to+Hazaribagh+NH20+Jharkhand",
      zoom: 11
    },
    hazaribagh: {
      name: "📍 Hazaribagh Town Hub",
      query: "Hazaribagh,+Jharkhand",
      lat: 23.9925,
      lng: 85.3637,
      zoom: 14
    },
    ramgarh: {
      name: "📍 Ramgarh Cantt Hub",
      query: "Ramgarh+Cantt,+Jharkhand",
      lat: 23.6332,
      lng: 85.5149,
      zoom: 14
    }
  };

  let pollIntervalTimer = null;
  let activeTab = "map"; // "map" | "roster" | "setup"
  let autoFollow = false; // off by default so user can freely interact with real Google Map
  let currentVehicleNo = "JH-02-VAN-01";
  let activeVehiclesList = [];
  let currentMapType = "m"; // "m" = Roadmap / Streets, "k" = Satellite, "p" = Terrain
  let currentQuery = REGION_PRESETS.campus.query;
  let currentZoom = 15;
  let lastLoadedIframeUrl = "";

  // Helper to build real Google Maps embed URL
  function buildGoogleEmbedUrl(query, zoom = 15, mapType = "m") {
    return `https://maps.google.com/maps?q=${query}&t=${mapType}&z=${zoom}&output=embed`;
  }

  // Render Full Transport Dashboard with Real Google Maps & Tabs
  window.renderTransportGpsDashboard = function (container) {
    if (!container) return;

    // Inject styles for van telemetry HUD & real Google Maps layout
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
        .map-style-pill { padding:5px 11px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer; border:1px solid #cbd5e1; background:#ffffff; color:#334155; transition:all 0.15s; }
        .map-style-pill.active { background:#2563eb; color:#ffffff; border-color:#2563eb; }
        .corridor-jump-btn { padding:5px 10px; font-size:0.75rem; font-weight:700; border-radius:6px; border:1px solid #e2e8f0; background:#ffffff; color:#1e293b; cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; gap:4px; }
        .corridor-jump-btn:hover { background:#f1f5f9; border-color:#cbd5e1; color:#0f172a; }
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
              Real Google Maps Live Site & Telematics covering Ramgarh &bull; Mandu &bull; Charhi &bull; Prem Nagar &bull; Hazaribagh (NH-20)
            </p>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="van-tab-btn ${activeTab === 'map' ? 'active' : ''}" id="btn_vanTab_map">
              <span>🌐</span> Real Google Map
            </button>
            <button type="button" class="van-tab-btn ${activeTab === 'roster' ? 'active' : ''}" id="btn_vanTab_roster">
              <span>📋</span> Route & Student Allocations
            </button>
            <button type="button" class="van-tab-btn ${activeTab === 'setup' ? 'active' : ''}" id="btn_vanTab_setup">
              <span>📡</span> Hardware GPS Setup Guide
            </button>
          </div>
        </div>

        <!-- TAB 1: REAL GOOGLE MAPS SITE & TELEMATICS -->
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

          <!-- Map Box & Controls Toolbar -->
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <!-- Map Action Controls Header -->
            <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:12px 16px; display:flex; flex-direction:column; gap:10px;">
              <!-- Top Row: Status, Vehicle Selector, Map Style Toggles -->
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="display:inline-flex; align-items:center; gap:5px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:20px;">
                    <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#16a34a;"></span>
                    LIVE GPS FEED
                  </span>
                  <span style="display:inline-flex; align-items:center; gap:5px; background:#eff6ff; color:#1d4ed8; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:20px; border:1px solid #bfdbfe;">
                    <span>🌐</span> Real Google Maps Site &bull; Ramgarh & Hazaribagh Corridor
                  </span>
                  <span id="mapVehicleSelectorWrap"></span>
                </div>

                <!-- Google Map Style Toggles -->
                <div style="display:flex; align-items:center; gap:4px; background:#f1f5f9; padding:3px; border-radius:8px;">
                  <button type="button" class="map-style-pill ${currentMapType === 'm' ? 'active' : ''}" id="btn_mapStyleRoad">
                    🗺️ Streets
                  </button>
                  <button type="button" class="map-style-pill ${currentMapType === 'k' ? 'active' : ''}" id="btn_mapStyleSat">
                    🛰️ Satellite
                  </button>
                  <button type="button" class="map-style-pill ${currentMapType === 'p' ? 'active' : ''}" id="btn_mapStyleTerrain">
                    🏔️ Terrain
                  </button>
                </div>
              </div>

              <!-- Bottom Row: Regional Quick-Focus Corridor Buttons & External Launch -->
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-top:1px solid #e2e8f0; padding-top:8px;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span style="font-size:0.72rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Corridor Jump:</span>
                  <button type="button" class="corridor-jump-btn" id="btn_focusCampus" title="Focus Tapowan Campus (Prem Nagar)">
                    🏫 School Campus
                  </button>
                  <button type="button" class="corridor-jump-btn" id="btn_focusTrackVan" style="background:#eff6ff; border-color:#93c5fd; color:#1d4ed8;" title="Track Real Van Position on Google Map">
                    🚐 Track Active Van
                  </button>
                  <button type="button" class="corridor-jump-btn" id="btn_focusCorridor" title="Ramgarh - Hazaribagh NH-20 Highway Corridor">
                    🛣️ Ramgarh - Hazaribagh
                  </button>
                  <button type="button" class="corridor-jump-btn" id="btn_focusHazaribagh" title="Hazaribagh Town Hub">
                    📍 Hazaribagh
                  </button>
                  <button type="button" class="corridor-jump-btn" id="btn_focusRamgarh" title="Ramgarh Cantt Hub">
                    📍 Ramgarh
                  </button>
                </div>

                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <button type="button" id="btn_mapFollowToggle" class="btn secondary" style="padding:5px 10px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#f1f5f9; color:#475569; display:inline-flex; align-items:center; gap:4px;">
                    ⚡ Auto-Follow: OFF
                  </button>
                  <button type="button" id="btn_mapSimulate" class="btn secondary" style="padding:5px 10px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#fef3c7; border-color:#f59e0b; color:#b45309; display:inline-flex; align-items:center; gap:4px;" title="Test live movement animation on map">
                    ▶ Test Motion Simulation
                  </button>
                  <a id="btn_openGoogleMapsApp" href="https://www.google.com/maps/search/?api=1&query=23.8209682,85.5119629" target="_blank" class="btn primary" style="padding:5px 12px; font-size:0.78rem; font-weight:800; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; background:#16a34a; border-color:#16a34a; color:#fff;" title="Open in Official Google Maps Application or Website">
                    ↗️ Open in Google Maps App
                  </a>
                  <a href="/driver-gps.html" target="_blank" class="btn secondary" style="padding:5px 10px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#eff6ff; border-color:#3b82f6; color:#1d4ed8; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                    📱 Driver Mobile GPS
                  </a>
                </div>
              </div>
            </div>

            <!-- Real Google Maps Embedded Site (Iframe) -->
            <div id="transportGpsMapContainer" style="width:100%; height:580px; background:#f8fafc; position:relative; overflow:hidden;">
              <iframe
                id="realGoogleMapFrame"
                src="${buildGoogleEmbedUrl(currentQuery, currentZoom, currentMapType)}"
                style="width:100%; height:100%; border:none; display:block;"
                allowfullscreen=""
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade">
              </iframe>

              <!-- Floating Live Sensor Pill over Map -->
              <div id="mapFloatingVanPill" style="position:absolute; top:12px; left:12px; background:rgba(15, 23, 42, 0.92); color:#ffffff; padding:8px 14px; border-radius:10px; box-shadow:0 4px 14px rgba(0,0,0,0.3); font-size:0.8rem; font-weight:700; display:flex; align-items:center; gap:10px; z-index:10; pointer-events:auto; backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.15);">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="font-size:16px;">🚐</span>
                  <span id="pill_vanNo" style="font-weight:800; color:#38bdf8;">JH-02-VAN-01</span>
                </div>
                <div style="height:12px; width:1px; background:#475569;"></div>
                <div id="pill_vanSpeed" style="color:#22c55e; font-weight:800;">0 km/h</div>
                <div style="height:12px; width:1px; background:#475569;"></div>
                <div id="pill_vanDist" style="color:#fbbf24;">-- km to Campus</div>
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

    // Update Google Maps Frame Function
    const updateMapFrame = (query, zoom, type) => {
      currentQuery = query || currentQuery;
      currentZoom = zoom || currentZoom;
      currentMapType = type || currentMapType;

      const iframe = container.querySelector("#realGoogleMapFrame");
      const targetUrl = buildGoogleEmbedUrl(currentQuery, currentZoom, currentMapType);
      if (iframe && targetUrl !== lastLoadedIframeUrl) {
        lastLoadedIframeUrl = targetUrl;
        iframe.src = targetUrl;
      }
    };

    // Google Map Style Toggles
    const btnRoad = container.querySelector("#btn_mapStyleRoad");
    const btnSat = container.querySelector("#btn_mapStyleSat");
    const btnTerrain = container.querySelector("#btn_mapStyleTerrain");

    const setActiveStyleBtn = (type) => {
      [btnRoad, btnSat, btnTerrain].forEach(b => b && b.classList.remove("active"));
      if (type === "m" && btnRoad) btnRoad.classList.add("active");
      if (type === "k" && btnSat) btnSat.classList.add("active");
      if (type === "p" && btnTerrain) btnTerrain.classList.add("active");
    };

    if (btnRoad) {
      btnRoad.addEventListener("click", () => {
        setActiveStyleBtn("m");
        updateMapFrame(currentQuery, currentZoom, "m");
      });
    }
    if (btnSat) {
      btnSat.addEventListener("click", () => {
        setActiveStyleBtn("k");
        updateMapFrame(currentQuery, currentZoom, "k");
      });
    }
    if (btnTerrain) {
      btnTerrain.addEventListener("click", () => {
        setActiveStyleBtn("p");
        updateMapFrame(currentQuery, currentZoom, "p");
      });
    }

    // Regional Jump Buttons
    const btnFocusCampus = container.querySelector("#btn_focusCampus");
    if (btnFocusCampus) {
      btnFocusCampus.addEventListener("click", () => {
        updateMapFrame(REGION_PRESETS.campus.query, REGION_PRESETS.campus.zoom, currentMapType);
      });
    }

    const btnFocusTrackVan = container.querySelector("#btn_focusTrackVan");
    if (btnFocusTrackVan) {
      btnFocusTrackVan.addEventListener("click", () => {
        const van = activeVehiclesList.find(v => v.vehicleNo === currentVehicleNo) || activeVehiclesList[0];
        if (van && van.latitude && van.longitude) {
          const q = `${van.latitude},${van.longitude}(${encodeURIComponent(van.vehicleNo + ' - ' + (van.driverName || 'Van'))})`;
          updateMapFrame(q, 16, currentMapType);
        }
      });
    }

    const btnFocusCorridor = container.querySelector("#btn_focusCorridor");
    if (btnFocusCorridor) {
      btnFocusCorridor.addEventListener("click", () => {
        updateMapFrame(REGION_PRESETS.corridor.query, REGION_PRESETS.corridor.zoom, currentMapType);
      });
    }

    const btnFocusHazaribagh = container.querySelector("#btn_focusHazaribagh");
    if (btnFocusHazaribagh) {
      btnFocusHazaribagh.addEventListener("click", () => {
        updateMapFrame(REGION_PRESETS.hazaribagh.query, REGION_PRESETS.hazaribagh.zoom, currentMapType);
      });
    }

    const btnFocusRamgarh = container.querySelector("#btn_focusRamgarh");
    if (btnFocusRamgarh) {
      btnFocusRamgarh.addEventListener("click", () => {
        updateMapFrame(REGION_PRESETS.ramgarh.query, REGION_PRESETS.ramgarh.zoom, currentMapType);
      });
    }

    // Auto-Follow Toggle
    const btnFollowToggle = container.querySelector("#btn_mapFollowToggle");
    if (btnFollowToggle) {
      btnFollowToggle.addEventListener("click", () => {
        autoFollow = !autoFollow;
        btnFollowToggle.textContent = autoFollow ? "⚡ Auto-Follow: ON" : "⚡ Auto-Follow: OFF";
        btnFollowToggle.style.background = autoFollow ? "#dcfce7" : "#f1f5f9";
        btnFollowToggle.style.color = autoFollow ? "#15803d" : "#475569";
      });
    }

    // Simulation Button
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
            btnSimulate.textContent = "✓ Simulation Running";
            setTimeout(() => { btnSimulate.textContent = "▶ Test Motion Simulation"; }, 15000);
            fetchLiveGpsData();
          }
        } catch (e) {
          console.error("Simulation error:", e);
        }
      });
    }

    // Initial state
    switchTab(activeTab);
    lastLoadedIframeUrl = buildGoogleEmbedUrl(currentQuery, currentZoom, currentMapType);

    // Start Real-Time Telematics Polling (every 3.5 seconds)
    fetchLiveGpsData();
    if (pollIntervalTimer) clearInterval(pollIntervalTimer);
    pollIntervalTimer = setInterval(() => {
      if (document.getElementById("realGoogleMapFrame") && activeTab === "map") {
        fetchLiveGpsData();
      }
    }, 3500);
  };

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
          if (autoFollow && van.latitude && van.longitude) {
            const iframe = document.getElementById("realGoogleMapFrame");
            const q = `${van.latitude},${van.longitude}(${encodeURIComponent(van.vehicleNo)})`;
            currentQuery = q;
            if (iframe) iframe.src = buildGoogleEmbedUrl(q, currentZoom, currentMapType);
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

      // If Auto-Follow is active, update Google Map to van's current location
      if (autoFollow && van.latitude && van.longitude) {
        const iframe = document.getElementById("realGoogleMapFrame");
        const targetQ = `${van.latitude},${van.longitude}(${encodeURIComponent(van.vehicleNo)})`;
        if (iframe && targetQ !== currentQuery) {
          currentQuery = targetQ;
          iframe.src = buildGoogleEmbedUrl(targetQ, currentZoom, currentMapType);
        }
      }
    } catch (e) {
      console.warn("GPS live fetch error:", e);
    }
  }

  // Update HUD Cards & Floating Pill with Live Sensor Data
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
    const btnOpenApp = document.getElementById("btn_openGoogleMapsApp");

    const pillVanNo = document.getElementById("pill_vanNo");
    const pillVanSpeed = document.getElementById("pill_vanSpeed");
    const pillVanDist = document.getElementById("pill_vanDist");

    const speedVal = Math.round(van.speed || 0);

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
    if (hudSpeed) hudSpeed.innerHTML = `${speedVal} <span style="font-size:0.8rem; font-weight:700; color:#64748b;">km/h</span>`;
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

    if (btnOpenApp && van.latitude && van.longitude) {
      btnOpenApp.href = `https://www.google.com/maps/search/?api=1&query=${van.latitude},${van.longitude}`;
    }

    // Floating Map Sensor Pill
    if (pillVanNo) pillVanNo.textContent = van.vehicleNo;
    if (pillVanSpeed) pillVanSpeed.textContent = `${speedVal} km/h`;
    if (pillVanDist) pillVanDist.textContent = `${van.distanceFromCampusKm} km to Campus`;
  }
})();
