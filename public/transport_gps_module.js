// public/transport_gps_module.js
// High-Definition Live GPS Map Tracking & Telematics Engine for Tapowan Public School
// Features: Dual-Engine Interactive Radar (ESRI Satellite & OSM Streets) + Real Google Maps Embed
// Live Animated Van Marker (Pulsing Radar, Speed Badge, Heading, Geofence & Breadcrumb Trail)
// Covering Prem Nagar Campus, Ramgarh Cantt, Mandu, Charhi, and Hazaribagh (NH-20)

(function () {
  const SCHOOL_COORDS = {
    lat: 23.8209682,
    lng: 85.5119629,
    name: "Tapowan Public School (Prem Nagar)",
    radiusMeters: 50.0
  };

  // Haversine distance in km
  function getDistanceFromSchoolKm(lat, lng) {
    if (!lat || !lng) return 0;
    const R = 6371;
    const dLat = (lat - SCHOOL_COORDS.lat) * (Math.PI / 180);
    const dLng = (lng - SCHOOL_COORDS.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(SCHOOL_COORDS.lat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  // Ramgarh - Hazaribagh Regional Corridor Presets (NH-20 / NH-33)
  const REGION_PRESETS = {
    campus: {
      name: "🏫 Tapowan Campus (Prem Nagar)",
      lat: 23.8209682,
      lng: 85.5119629,
      zoom: 17,
      query: "23.8209682,85.5119629(Tapowan+Public+School+Prem+Nagar)"
    },
    corridor: {
      name: "🛣️ Ramgarh - Hazaribagh Transit Corridor (NH-20)",
      bounds: [
        [23.5800, 85.3000], // Ramgarh South-West
        [24.0600, 85.6200]  // Hazaribagh North-East
      ],
      query: "Ramgarh+to+Hazaribagh+NH20+Jharkhand",
      zoom: 11
    },
    hazaribagh: {
      name: "📍 Hazaribagh Town Hub",
      lat: 23.9925,
      lng: 85.3637,
      zoom: 14,
      query: "Hazaribagh,+Jharkhand"
    },
    ramgarh: {
      name: "📍 Ramgarh Cantt Hub",
      lat: 23.6332,
      lng: 85.5149,
      zoom: 14,
      query: "Ramgarh+Cantt,+Jharkhand"
    }
  };

  let transportMap = null;
  let vanMarker = null;
  let schoolMarker = null;
  let geofenceCircle = null;
  let distanceLine = null;
  let historyPolyline = null;

  // Tile layers
  let esriSatLayer = null;
  let esriLabelsLayer = null;
  let osmStreetsLayer = null;
  let currentActiveLayer = "sat"; // "sat" | "osm" | "google"

  let pollIntervalTimer = null;
  let activeTab = "map"; // "map" | "roster" | "setup"
  let autoFollow = false;
  let hasCenteredInitialVan = false;
  let currentVehicleNo = "JH-02-VAN-01";
  let activeVehiclesList = [];

  // Helper to build real Google Maps embed URL
  function buildGoogleEmbedUrl(query, zoom = 16, mapType = "m") {
    return `https://maps.google.com/maps?q=${query}&t=${mapType}&z=${zoom}&output=embed`;
  }

  // Ensure Leaflet library is available
  function ensureLeafletReady(callback) {
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

  // Create High-Visibility Custom HTML Marker for School Van
  function createVanIcon(heading = 0, isMoving = false, status = "Idle", speed = 0, vehicleNo = "JH-02-VAN-01", driverName = "Driver") {
    const isOnline = (status === "Moving" || status === "Idle" || status === "At Campus");
    const ringColor = isMoving ? "#22c55e" : (isOnline ? "#38bdf8" : "#94a3b8");
    const speedText = isMoving ? `${Math.round(speed || 25)} km/h` : (status === "At Campus" ? "At Campus" : "Idle");

    const html = `
      <div class="tps-van-marker-wrap" style="position:relative; width:52px; height:52px; display:flex; align-items:center; justify-content:center;">
        <!-- Pulsing Radar Halo Rings -->
        <div style="position:absolute; width:56px; height:56px; border-radius:50%; background:${ringColor}33; border:1.5px solid ${ringColor}; animation:vanPulse 1.8s infinite ease-out; pointer-events:none;"></div>
        <div style="position:absolute; width:74px; height:74px; border-radius:50%; background:${ringColor}1a; border:1px dashed ${ringColor}88; animation:vanPulse2 1.8s infinite ease-out 0.6s; pointer-events:none;"></div>
        
        <!-- Direction Heading Arrow -->
        <div style="position:absolute; top:-12px; width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:12px solid ${isMoving ? '#22c55e' : '#facc15'}; transform-origin:center 38px; transform:rotate(${heading}deg); transition:transform 0.4s ease; pointer-events:none; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));"></div>

        <!-- School Van Core Emblem -->
        <div style="position:relative; width:44px; height:44px; border-radius:50%; background:#0f172a; border:3px solid #facc15; box-shadow:0 6px 16px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:2; cursor:pointer;">
          <span style="font-size:24px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🚐</span>
        </div>

        <!-- High-Visibility Floating Van Badge (Always Visible on Map) -->
        <div style="position:absolute; top:-36px; left:50%; transform:translateX(-50%); background:#0f172a; color:#ffffff; padding:3px 9px; border-radius:8px; border:1.5px solid #facc15; font-size:11px; font-weight:800; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.4); display:flex; align-items:center; gap:5px; pointer-events:none; z-index:3;">
          <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${isMoving ? '#22c55e' : (isOnline ? '#38bdf8' : '#94a3b8')};"></span>
          <span>${vehicleNo}</span>
          <span style="color:#facc15; font-weight:800;">&bull; ${speedText}</span>
        </div>
      </div>
    `;

    return L.divIcon({
      className: "van-custom-marker",
      html: html,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      popupAnchor: [0, -32]
    });
  }

  // Create School Campus Pin Icon
  function createSchoolIcon() {
    const html = `
      <div class="tps-school-marker-wrap" style="position:relative; width:46px; height:46px; display:flex; align-items:center; justify-content:center;">
        <div style="width:40px; height:40px; border-radius:50%; background:#d97706; border:3px solid #ffffff; box-shadow:0 4px 16px rgba(217,119,6,0.6); display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <span style="font-size:22px;">🏫</span>
        </div>
        <div style="position:absolute; bottom:-26px; left:50%; transform:translateX(-50%); background:#ffffff; color:#0f172a; padding:2px 8px; border-radius:6px; border:1.5px solid #d97706; font-size:10px; font-weight:800; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.18); pointer-events:none;">
          Tapowan Campus
        </div>
      </div>
    `;

    return L.divIcon({
      className: "school-custom-marker",
      html: html,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
      popupAnchor: [0, -26]
    });
  }

  // Render Full Transport Dashboard with Dual Map Engine & Tabs
  window.renderTransportGpsDashboard = function (container) {
    if (!container) return;

    // Inject styles for van telemetry HUD & live radar animation
    if (!document.getElementById("vanGpsStyles")) {
      const st = document.createElement("style");
      st.id = "vanGpsStyles";
      st.textContent = `
        @keyframes vanPulse { 0% { transform:scale(0.85); opacity:0.9; } 50% { transform:scale(1.35); opacity:0.4; } 100% { transform:scale(1.65); opacity:0; } }
        @keyframes vanPulse2 { 0% { transform:scale(0.9); opacity:0.7; } 50% { transform:scale(1.45); opacity:0.25; } 100% { transform:scale(1.85); opacity:0; } }
        .van-custom-marker { background:transparent !important; border:none !important; }
        .school-custom-marker { background:transparent !important; border:none !important; }
        .van-hud-card { background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:4px; }
        .van-tab-btn { padding:10px 18px; border-radius:8px; font-size:0.88rem; font-weight:700; cursor:pointer; border:1.5px solid transparent; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s; }
        .van-tab-btn.active { background:#1e293b; color:#ffffff; }
        .van-tab-btn:not(.active) { background:#f1f5f9; color:#475569; border-color:#e2e8f0; }
        .van-tab-btn:not(.active):hover { background:#e2e8f0; color:#1e293b; }
        .map-engine-pill { padding:6px 12px; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; transition:all 0.15s; display:inline-flex; align-items:center; gap:5px; }
        .map-engine-pill.active { background:#2563eb; color:#ffffff; border-color:#2563eb; box-shadow:0 2px 6px rgba(37,99,235,0.3); }
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
              <span style="font-size:26px;">🚐</span>
              <h2 style="margin:0; font-size:1.35rem; font-weight:800; color:#0f172a;">School Van & Bus Live GPS Tracking</h2>
            </div>
            <p style="margin:4px 0 0; color:#64748b; font-size:0.85rem;">
              Interactive High-Definition Radar & Telematics covering Prem Nagar &bull; Mandu &bull; Charhi &bull; Ramgarh &bull; Hazaribagh (NH-20)
            </p>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="van-tab-btn ${activeTab === 'map' ? 'active' : ''}" id="btn_vanTab_map">
              <span>🗺️</span> Live Van Radar Map
            </button>
            <button type="button" class="van-tab-btn ${activeTab === 'roster' ? 'active' : ''}" id="btn_vanTab_roster">
              <span>📋</span> Route & Student Allocations
            </button>
            <button type="button" class="van-tab-btn ${activeTab === 'setup' ? 'active' : ''}" id="btn_vanTab_setup">
              <span>📡</span> Hardware GPS Setup Guide
            </button>
          </div>
        </div>

        <!-- TAB 1: LIVE RADAR MAP & TELEMATICS -->
        <div id="vanTabContent_map" style="display:${activeTab === 'map' ? 'flex' : 'none'}; flex-direction:column; gap:16px;">
          <!-- Telematics HUD Cards -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px;">
            <div class="van-hud-card">
              <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Vehicle Status</div>
              <div id="hud_vanStatus" style="font-size:1.15rem; font-weight:800; color:#0284c7; display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#0284c7;"></span>
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
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Driver In-Charge</div>
                <button type="button" id="btn_openEditDriverModal" style="background:#eff6ff; border:1px solid #bfdbfe; color:#2563eb; font-size:0.72rem; font-weight:800; cursor:pointer; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:2px;">
                  ✏️ Edit Details
                </button>
              </div>
              <div id="hud_driverName" style="font-size:1.05rem; font-weight:800; color:#1e293b;">Connecting to driver...</div>
              <div style="margin-top:2px;">
                <a id="hud_driverCallBtn" href="tel:" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:700; color:#64748b; text-decoration:none; background:#f1f5f9; padding:2px 8px; border-radius:6px;">
                  📞 Awaiting Signal...
                </a>
              </div>
            </div>
          </div>

          <!-- Map Box & Controls Toolbar -->
          <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <!-- Map Action Controls Header -->
            <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:12px 16px; display:flex; flex-direction:column; gap:10px;">
              <!-- Top Row: Live Status, Vehicle Selector, Map Engine Toggles -->
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="display:inline-flex; align-items:center; gap:5px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:800; padding:4px 11px; border-radius:20px; border:1px solid #bbf7d0;">
                    <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#16a34a; animation:vanPulse 1.5s infinite;"></span>
                    LIVE RADAR FEED
                  </span>
                  <span id="mapVehicleSelectorWrap"></span>
                </div>

                <!-- Dual Map Engine / Layer Toggles -->
                <div style="display:flex; align-items:center; gap:6px; background:#f1f5f9; padding:4px; border-radius:10px;">
                  <button type="button" class="map-engine-pill ${currentActiveLayer === 'sat' ? 'active' : ''}" id="btn_layerSat" title="High-Resolution Satellite Imagery with Street & Landmark Overlays">
                    🛰️ Radar Satellite
                  </button>
                  <button type="button" class="map-engine-pill ${currentActiveLayer === 'osm' ? 'active' : ''}" id="btn_layerOsm" title="OpenStreetMap Clean Roads & Highways">
                    🗺️ Streets Map
                  </button>
                  <button type="button" class="map-engine-pill ${currentActiveLayer === 'google' ? 'active' : ''}" id="btn_layerGoogle" title="Switch to Official Google Maps Site Embed">
                    🌐 Google Maps Embed
                  </button>
                </div>
              </div>

              <!-- Bottom Row: Regional Quick-Focus Corridor Buttons & External Navigation -->
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-top:1px solid #e2e8f0; padding-top:8px;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span style="font-size:0.72rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Quick Focus:</span>
                  <button type="button" class="corridor-jump-btn" id="btn_focusTrackVan" style="background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; font-weight:800;" title="Zoom directly to the Van's live position">
                    🚐 Zoom to Van
                  </button>
                  <button type="button" class="corridor-jump-btn" id="btn_focusCampus" style="background:#fef3c7; border-color:#fde68a; color:#b45309; font-weight:800;" title="Focus Tapowan Campus (Prem Nagar 50m Geofence)">
                    🏫 School Campus
                  </button>
                  <button type="button" class="corridor-jump-btn" id="btn_focusBoth" style="background:#f0fdf4; border-color:#bbf7d0; color:#15803d; font-weight:800;" title="Show both Van and School in one view">
                    📐 Show Van & Campus (Fit)
                  </button>
                  <button type="button" class="corridor-jump-btn" id="btn_focusCorridor" title="Ramgarh - Hazaribagh NH-20 Highway Corridor">
                    🛣️ NH-20 Corridor
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
                  <button type="button" id="btn_mapSimulate" class="btn secondary" style="padding:5px 10px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#fef3c7; border-color:#f59e0b; color:#b45309; display:inline-flex; align-items:center; gap:4px;" title="Test live motion simulation on map">
                    ▶ Test Motion Simulation
                  </button>
                  <a id="btn_openGoogleMapsApp" href="https://www.google.com/maps/search/?api=1&query=23.8209682,85.5119629" target="_blank" class="btn primary" style="padding:5px 12px; font-size:0.78rem; font-weight:800; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; background:#16a34a; border-color:#16a34a; color:#fff;" title="Open in Official Google Maps Application or Website for Turn-by-Turn Navigation">
                    ↗️ Open in Google Maps App
                  </a>
                  <a href="/driver-gps.html" target="_blank" class="btn secondary" style="padding:5px 10px; font-size:0.78rem; font-weight:700; border-radius:6px; background:#eff6ff; border-color:#3b82f6; color:#1d4ed8; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                    📱 Driver Mobile GPS
                  </a>
                </div>
              </div>
            </div>

            <!-- Map Viewports Area (Leaflet Radar Map & Google Maps Iframe) -->
            <div id="transportGpsMapContainer" style="width:100%; height:600px; background:#0f172a; position:relative; overflow:hidden;">
              <!-- Leaflet Interactive Radar Viewport -->
              <div id="leafletRadarMap" style="width:100%; height:100%; position:absolute; top:0; left:0; z-index:1;"></div>

              <!-- Real Google Maps Embedded Site Iframe (Shown only when Google Maps Embed is toggled) -->
              <iframe
                id="realGoogleMapFrame"
                src="${buildGoogleEmbedUrl(REGION_PRESETS.campus.query, 16, 'm')}"
                style="width:100%; height:100%; border:none; position:absolute; top:0; left:0; z-index:2; display:none;"
                allowfullscreen=""
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade">
              </iframe>

              <!-- Floating Live Sensor Pill over Map -->
              <div id="mapFloatingVanPill" style="position:absolute; top:12px; left:12px; background:rgba(15, 23, 42, 0.94); color:#ffffff; padding:9px 16px; border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,0.45); font-size:0.82rem; font-weight:700; display:flex; align-items:center; gap:12px; z-index:500; pointer-events:auto; backdrop-filter:blur(8px); border:1.5px solid rgba(250, 204, 21, 0.5);">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="font-size:18px;">🚐</span>
                  <span id="pill_vanNo" style="font-weight:900; color:#facc15;">JH-02-VAN-01</span>
                </div>
                <div style="height:14px; width:1px; background:#475569;"></div>
                <div id="pill_vanSpeed" style="color:#22c55e; font-weight:800;">0 km/h</div>
                <div style="height:14px; width:1px; background:#475569;"></div>
                <div id="pill_vanDist" style="color:#38bdf8; font-weight:800;">-- km to Campus</div>
                <div style="height:14px; width:1px; background:#475569;"></div>
                <div id="pill_vanDriver" style="color:#cbd5e1; font-weight:600;">Driver: Connecting...</div>
              </div>

              <!-- Map Legend Indicator Pill -->
              <div style="position:absolute; bottom:14px; left:12px; background:rgba(15, 23, 42, 0.9); color:#ffffff; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; display:flex; align-items:center; gap:12px; z-index:500; pointer-events:none; border:1px solid rgba(255,255,255,0.15);">
                <span style="display:flex; align-items:center; gap:4px;">
                  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e; box-shadow:0 0 6px #22c55e;"></span>
                  <span>Active Van</span>
                </span>
                <span style="display:flex; align-items:center; gap:4px;">
                  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#d97706;"></span>
                  <span>School Campus</span>
                </span>
                <span style="display:flex; align-items:center; gap:4px;">
                  <span style="display:inline-block; width:14px; height:2px; background:#22c55e; border-top:1px dashed #22c55e;"></span>
                  <span>50m Geofence</span>
                </span>
              </div>
            </div>

            <!-- Real-Time Telematics & Location Summary Footer -->
            <div style="background:#ffffff; border-top:1px solid #e2e8f0; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:42px; height:42px; border-radius:50%; background:#eff6ff; border:2px solid #bfdbfe; display:flex; align-items:center; justify-content:center; font-size:20px;">
                  📍
                </div>
                <div>
                  <div style="font-weight:800; font-size:0.95rem; color:#0f172a; display:flex; align-items:center; gap:6px;">
                    <span id="footer_vanNo">JH-02-VAN-01</span> &bull; <span id="footer_vanRoute" style="color:#64748b; font-weight:600;">Main Campus Route</span>
                  </div>
                  <div style="font-size:0.82rem; color:#475569; margin-top:2px;">
                    <strong>Live Van Position:</strong> <span id="footer_vanCoords" style="font-family:monospace; color:#2563eb; font-weight:700;">23.820968° N, 85.511963° E</span> &bull; <span id="footer_vanAddress" style="color:#16a34a; font-weight:700;">Prem Nagar Campus, Tapowan Public School</span>
                  </div>
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:8px;">
                <button type="button" class="btn secondary" id="btn_footerTrackVan" style="padding:7px 16px; font-size:0.82rem; font-weight:800; border-radius:8px; display:inline-flex; align-items:center; gap:4px; background:#eff6ff; border-color:#93c5fd; color:#1d4ed8;">
                  🎯 Center on Van
                </button>
                <a id="footer_googleMapsDir" href="https://www.google.com/maps/dir/?api=1&destination=23.8209682,85.5119629" target="_blank" class="btn secondary" style="padding:7px 16px; font-size:0.82rem; font-weight:800; border-radius:8px; display:inline-flex; align-items:center; gap:4px; text-decoration:none; background:#f0fdf4; border-color:#86efac; color:#166534;">
                  🧭 Google Driving Directions
                </a>
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
                  8040000 tapowan-app.vercel.app 80<br>
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
                  adminip123456 tapowan-app.vercel.app 80<br>
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

        <!-- Edit Driver & Vehicle Details Modal -->
        <div id="editDriverModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; align-items:center; justify-content:center;">
          <div style="background:#ffffff; border-radius:16px; width:90%; max-width:440px; padding:24px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px;">
              <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                <span>🚐</span> Edit Vehicle & Driver Details
              </h3>
              <button type="button" id="btn_closeEditDriverModal" style="background:none; border:none; font-size:22px; color:#64748b; cursor:pointer; line-height:1;">&times;</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px;">
              <div>
                <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Vehicle Registration No</label>
                <input type="text" id="modal_vehicleNo" style="width:100%; padding:9px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-weight:700; box-sizing:border-box;" value="JH-02-VAN-01" />
              </div>

              <div>
                <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Driver Full Name</label>
                <input type="text" id="modal_driverName" style="width:100%; padding:9px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-weight:700; box-sizing:border-box;" placeholder="Enter Driver Name" />
              </div>

              <div>
                <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Driver Contact Number</label>
                <input type="tel" id="modal_driverPhone" style="width:100%; padding:9px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-weight:700; box-sizing:border-box;" placeholder="10-Digit Mobile Number" />
              </div>

              <div>
                <label style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Route Description</label>
                <input type="text" id="modal_routeName" style="width:100%; padding:9px 12px; border:1.5px solid #cbd5e1; border-radius:8px; font-weight:700; box-sizing:border-box;" placeholder="e.g. Ramgarh - Mandu - Campus" />
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
              <button type="button" id="btn_cancelEditDriverModal" class="btn secondary" style="padding:9px 16px; border-radius:8px; font-weight:700;">Cancel</button>
              <button type="button" id="btn_saveEditDriverModal" class="btn primary" style="padding:9px 20px; border-radius:8px; font-weight:800; background:#2563eb; color:#fff;">Save Details</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire Navigation Tabs
    const tabMap = container.querySelector("#btn_vanTab_map");
    const tabRoster = container.querySelector("#btn_vanTab_roster");
    const tabSetup = container.querySelector("#btn_vanTab_setup");

    const contentMap = container.querySelector("#vanTabContent_map");
    const contentRoster = container.querySelector("#vanTabContent_roster");
    const contentSetup = container.querySelector("#vanTabContent_setup");

    const switchTab = (tab) => {
      activeTab = tab;
      [tabMap, tabRoster, tabSetup].forEach(t => t && t.classList.remove("active"));
      contentMap.style.display = (tab === "map") ? "flex" : "none";
      contentRoster.style.display = (tab === "roster") ? "block" : "none";
      contentSetup.style.display = (tab === "setup") ? "block" : "none";

      const tableWrapEl = document.querySelector(".table-wrap");
      const toolsPanel = document.querySelector(".tools-panel");
      if (tableWrapEl) tableWrapEl.style.display = (tab === "roster") ? "block" : "none";
      if (toolsPanel) toolsPanel.style.display = (tab === "roster") ? "flex" : "none";

      if (tab === "map") {
        tabMap && tabMap.classList.add("active");
        if (transportMap) {
          setTimeout(() => transportMap.invalidateSize(), 200);
        }
      } else if (tab === "roster") {
        tabRoster && tabRoster.classList.add("active");
      } else if (tab === "setup") {
        tabSetup && tabSetup.classList.add("active");
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

    // Initialize Leaflet Radar Map Engine
    ensureLeafletReady(() => {
      initLeafletMapEngine(container);
    });

    // Wire Layer & Engine Toggle Buttons
    const btnLayerSat = container.querySelector("#btn_layerSat");
    const btnLayerOsm = container.querySelector("#btn_layerOsm");
    const btnLayerGoogle = container.querySelector("#btn_layerGoogle");

    const setLayerEngine = (mode) => {
      currentActiveLayer = mode;
      [btnLayerSat, btnLayerOsm, btnLayerGoogle].forEach(b => b && b.classList.remove("active"));

      const leafletEl = container.querySelector("#leafletRadarMap");
      const googleFrame = container.querySelector("#realGoogleMapFrame");

      if (mode === "google") {
        if (btnLayerGoogle) btnLayerGoogle.classList.add("active");
        if (leafletEl) leafletEl.style.display = "none";
        if (googleFrame) {
          googleFrame.style.display = "block";
          const van = activeVehiclesList.find(v => v.vehicleNo === currentVehicleNo) || activeVehiclesList[0];
          if (van && van.latitude && van.longitude) {
            googleFrame.src = buildGoogleEmbedUrl(`${van.latitude},${van.longitude}(School+Van+${van.vehicleNo})`, 16, 'm');
          }
        }
      } else {
        if (googleFrame) googleFrame.style.display = "none";
        if (leafletEl) leafletEl.style.display = "block";

        if (transportMap) {
          if (mode === "sat") {
            if (btnLayerSat) btnLayerSat.classList.add("active");
            if (osmStreetsLayer && transportMap.hasLayer(osmStreetsLayer)) transportMap.removeLayer(osmStreetsLayer);
            if (esriSatLayer && !transportMap.hasLayer(esriSatLayer)) transportMap.addLayer(esriSatLayer);
            if (esriLabelsLayer && !transportMap.hasLayer(esriLabelsLayer)) transportMap.addLayer(esriLabelsLayer);
          } else if (mode === "osm") {
            if (btnLayerOsm) btnLayerOsm.classList.add("active");
            if (esriSatLayer && transportMap.hasLayer(esriSatLayer)) transportMap.removeLayer(esriSatLayer);
            if (esriLabelsLayer && transportMap.hasLayer(esriLabelsLayer)) transportMap.removeLayer(esriLabelsLayer);
            if (osmStreetsLayer && !transportMap.hasLayer(osmStreetsLayer)) transportMap.addLayer(osmStreetsLayer);
          }
          transportMap.invalidateSize();
        }
      }
    };

    if (btnLayerSat) btnLayerSat.addEventListener("click", () => setLayerEngine("sat"));
    if (btnLayerOsm) btnLayerOsm.addEventListener("click", () => setLayerEngine("osm"));
    if (btnLayerGoogle) btnLayerGoogle.addEventListener("click", () => setLayerEngine("google"));

    // Quick Focus Actions
    const zoomToVan = () => {
      const van = activeVehiclesList.find(v => v.vehicleNo === currentVehicleNo) || activeVehiclesList[0];
      if (van && van.latitude && van.longitude) {
        if (currentActiveLayer === "google") {
          const googleFrame = container.querySelector("#realGoogleMapFrame");
          if (googleFrame) googleFrame.src = buildGoogleEmbedUrl(`${van.latitude},${van.longitude}(Van+${van.vehicleNo})`, 17, 'm');
        } else if (transportMap) {
          transportMap.setView([van.latitude, van.longitude], 17, { animate: true });
          if (vanMarker) vanMarker.openPopup();
        }
      }
    };

    const zoomToSchool = () => {
      if (currentActiveLayer === "google") {
        const googleFrame = container.querySelector("#realGoogleMapFrame");
        if (googleFrame) googleFrame.src = buildGoogleEmbedUrl(REGION_PRESETS.campus.query, 17, 'm');
      } else if (transportMap) {
        transportMap.setView([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], 17, { animate: true });
        if (schoolMarker) schoolMarker.openPopup();
      }
    };

    const fitVanAndSchool = () => {
      const van = activeVehiclesList.find(v => v.vehicleNo === currentVehicleNo) || activeVehiclesList[0];
      if (van && van.latitude && van.longitude && transportMap) {
        transportMap.fitBounds([
          [SCHOOL_COORDS.lat, SCHOOL_COORDS.lng],
          [van.latitude, van.longitude]
        ], { padding: [70, 70], maxZoom: 17 });
      }
    };

    const btnFocusTrackVan = container.querySelector("#btn_focusTrackVan");
    if (btnFocusTrackVan) btnFocusTrackVan.addEventListener("click", zoomToVan);

    const btnFooterTrackVan = container.querySelector("#btn_footerTrackVan");
    if (btnFooterTrackVan) btnFooterTrackVan.addEventListener("click", zoomToVan);

    const btnFocusCampus = container.querySelector("#btn_focusCampus");
    if (btnFocusCampus) btnFocusCampus.addEventListener("click", zoomToSchool);

    const btnFocusBoth = container.querySelector("#btn_focusBoth");
    if (btnFocusBoth) btnFocusBoth.addEventListener("click", fitVanAndSchool);

    const btnFocusCorridor = container.querySelector("#btn_focusCorridor");
    if (btnFocusCorridor) {
      btnFocusCorridor.addEventListener("click", () => {
        if (transportMap) transportMap.fitBounds(REGION_PRESETS.corridor.bounds);
      });
    }

    const btnFocusHazaribagh = container.querySelector("#btn_focusHazaribagh");
    if (btnFocusHazaribagh) {
      btnFocusHazaribagh.addEventListener("click", () => {
        if (transportMap) transportMap.setView([REGION_PRESETS.hazaribagh.lat, REGION_PRESETS.hazaribagh.lng], REGION_PRESETS.hazaribagh.zoom);
      });
    }

    const btnFocusRamgarh = container.querySelector("#btn_focusRamgarh");
    if (btnFocusRamgarh) {
      btnFocusRamgarh.addEventListener("click", () => {
        if (transportMap) transportMap.setView([REGION_PRESETS.ramgarh.lat, REGION_PRESETS.ramgarh.lng], REGION_PRESETS.ramgarh.zoom);
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
        if (autoFollow) zoomToVan();
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

    // Wire Edit Driver Modal
    const btnOpenModal = container.querySelector("#btn_openEditDriverModal");
    const modal = container.querySelector("#editDriverModal");
    const btnCloseModal = container.querySelector("#btn_closeEditDriverModal");
    const btnCancelModal = container.querySelector("#btn_cancelEditDriverModal");
    const btnSaveModal = container.querySelector("#btn_saveEditDriverModal");

    const modalVeh = container.querySelector("#modal_vehicleNo");
    const modalName = container.querySelector("#modal_driverName");
    const modalPhone = container.querySelector("#modal_driverPhone");
    const modalRoute = container.querySelector("#modal_routeName");

    if (btnOpenModal && modal) {
      btnOpenModal.addEventListener("click", () => {
        const van = activeVehiclesList.find(v => v.vehicleNo === currentVehicleNo) || {};
        if (modalVeh) modalVeh.value = van.vehicleNo || currentVehicleNo;
        if (modalName) modalName.value = (van.driverName && van.driverName !== "School Driver" && van.driverName !== "Connecting to driver...") ? van.driverName : "";
        if (modalPhone) modalPhone.value = van.driverPhone || "";
        if (modalRoute) modalRoute.value = van.routeName || "Main Campus Route";
        modal.style.display = "flex";
      });
    }

    const closeModal = () => { if (modal) modal.style.display = "none"; };
    if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener("click", closeModal);

    if (btnSaveModal) {
      btnSaveModal.addEventListener("click", async () => {
        const vNo = modalVeh.value.trim() || currentVehicleNo;
        const dName = modalName.value.trim();
        const dPhone = modalPhone.value.trim();
        const rName = modalRoute.value.trim();

        btnSaveModal.textContent = "Saving...";

        try {
          let saved = false;
          try {
            const res = await fetch("/api/transport/vehicles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vehicleNo: vNo,
                driverName: dName,
                driverPhone: dPhone,
                routeName: rName
              })
            });
            if (res.ok) saved = true;
          } catch (_) {}

          if (!saved) {
            await fetch("/api/db/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sql: `
                  INSERT INTO transport_vehicles (vehicle_no, device_id, vehicle_type, route_name, driver_name, driver_phone)
                  VALUES (?, ?, 'Van', ?, ?, ?)
                  ON CONFLICT(vehicle_no) DO UPDATE SET
                    driver_name = excluded.driver_name,
                    driver_phone = excluded.driver_phone,
                    route_name = excluded.route_name
                `,
                args: [vNo, vNo, rName || "Main Campus Route", dName || "School Driver", dPhone || ""]
              })
            });
          }

          if (typeof showToast === "function") showToast(`Driver details updated for ${vNo}!`, "success");
          closeModal();
          fetchLiveGpsData();
        } catch (e) {
          alert("Error saving driver: " + e.message);
        } finally {
          btnSaveModal.textContent = "Save Details";
        }
      });
    }

    // Initial state
    switchTab(activeTab);

    // Start Real-Time Telematics Polling (every 3.5 seconds)
    fetchLiveGpsData();
    if (pollIntervalTimer) clearInterval(pollIntervalTimer);
    pollIntervalTimer = setInterval(() => {
      if (document.getElementById("leafletRadarMap") && activeTab === "map") {
        fetchLiveGpsData();
      }
    }, 3500);
  };

  // Initialize Leaflet Map Engine with ESRI Satellite and OpenStreetMap
  function initLeafletMapEngine(container) {
    const mapDiv = container.querySelector("#leafletRadarMap");
    if (!mapDiv || typeof L === "undefined") return;

    if (transportMap) {
      transportMap.remove();
      transportMap = null;
    }

    // Create Map Instance centered between School Campus & Prem Nagar
    transportMap = L.map(mapDiv, {
      center: [SCHOOL_COORDS.lat, SCHOOL_COORDS.lng],
      zoom: 16,
      zoomControl: true,
      attributionControl: false
    });

    // 1. ESRI World Imagery (High-Resolution Satellite Layer - 100% Free, Open CORS, Zero Broken Images)
    esriSatLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "ESRI World Imagery"
    });

    // 2. ESRI World Transportation Overlay (Road Labels, NH-20 Highway & Town Names)
    esriLabelsLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19
    });

    // 3. OpenStreetMap Streets Layer (Clean Street Map)
    osmStreetsLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "OpenStreetMap"
    });

    // Add Default Satellite & Labels
    esriSatLayer.addTo(transportMap);
    esriLabelsLayer.addTo(transportMap);

    // Add School Campus Marker (Gold Campus Icon)
    schoolMarker = L.marker([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], {
      icon: createSchoolIcon(),
      zIndexOffset: 100
    }).addTo(transportMap);

    schoolMarker.bindPopup(`
      <div style="font-family:sans-serif; min-width:210px; padding:4px;">
        <div style="display:flex; align-items:center; gap:6px; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:6px;">
          <span style="font-size:20px;">🏫</span>
          <strong style="color:#0f172a; font-size:0.95rem;">Tapowan Public School</strong>
        </div>
        <div style="font-size:0.8rem; color:#475569; line-height:1.5;">
          <div><strong>Campus:</strong> Prem Nagar, Jharkhand</div>
          <div><strong>Geofence Radius:</strong> 50.0 Meters</div>
          <div><strong>Corridor:</strong> Ramgarh - Hazaribagh (NH-20)</div>
        </div>
      </div>
    `);

    // Add 50-meter Geofence Perimeter Circle around School
    geofenceCircle = L.circle([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], {
      radius: SCHOOL_COORDS.radiusMeters,
      color: "#16a34a",
      fillColor: "#22c55e",
      fillOpacity: 0.18,
      weight: 2,
      dashArray: "6, 6"
    }).addTo(transportMap);

    geofenceCircle.bindTooltip("🏫 50m School Geofence Perimeter", { permanent: false, direction: "top" });

    // Distance Connector Line (Between School Campus & Van)
    distanceLine = L.polyline([[SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], [SCHOOL_COORDS.lat, SCHOOL_COORDS.lng]], {
      color: "#f59e0b",
      weight: 2.5,
      dashArray: "6, 8",
      opacity: 0.85
    }).addTo(transportMap);

    // Breadcrumb Polyline for Historical Trail
    historyPolyline = L.polyline([], {
      color: "#0ea5e9",
      weight: 4,
      opacity: 0.85,
      lineCap: "round"
    }).addTo(transportMap);

    // Create Initial Van Marker
    vanMarker = L.marker([SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], {
      icon: createVanIcon(0, false, "Connecting...", 0, currentVehicleNo),
      zIndexOffset: 500
    }).addTo(transportMap);

    setTimeout(() => {
      if (transportMap) transportMap.invalidateSize();
    }, 250);
  }

  // Update or render Vehicle Switcher Dropdown
  function updateVehicleSelector(vehicles) {
    const wrap = document.getElementById("mapVehicleSelectorWrap");
    if (!wrap || !vehicles || !vehicles.length) return;

    let select = document.getElementById("mapVehicleSelect");
    if (!select) {
      wrap.innerHTML = `
        <select id="mapVehicleSelect" style="padding:5px 12px; font-size:0.78rem; font-weight:800; border-radius:8px; border:1.5px solid #cbd5e1; background:#ffffff; color:#0f172a; cursor:pointer;">
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
        }
      });
    }
  }

  // Fetch Live Telemetry from /api/transport/gps/live with direct DB failover
  async function fetchLiveGpsData() {
    try {
      let data = null;
      try {
        const res = await fetch("/api/transport/gps/live");
        if (res.ok) {
          data = await res.json();
        }
      } catch (_) {}

      // Fallback directly to Turso DB proxy if endpoint has any proxy latency
      if (!data || !data.ok || !data.vehicles || !data.vehicles.length) {
        try {
          const dbRes = await fetch("/api/db/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sql: `
                SELECT 
                  v.id as vehicle_id,
                  v.vehicle_no,
                  v.device_id,
                  v.vehicle_type,
                  v.route_name,
                  v.driver_name,
                  v.driver_phone,
                  v.capacity,
                  l.latitude,
                  l.longitude,
                  l.speed,
                  l.heading,
                  l.ignition,
                  l.status,
                  l.address,
                  l.updated_at
                FROM transport_vehicles v
                LEFT JOIN transport_gps_live l ON UPPER(TRIM(v.vehicle_no)) = UPPER(TRIM(l.vehicle_no))
                WHERE v.is_active = 1
                ORDER BY v.id ASC
              `,
              args: []
            })
          });
          if (dbRes.ok) {
            const dbData = await dbRes.json();
            if (dbData.rows && dbData.rows.length) {
              const now = Date.now();
              const vehicles = dbData.rows.map(r => {
                const lat = parseFloat(r.latitude ?? r.lat) || SCHOOL_COORDS.lat;
                const lng = parseFloat(r.longitude ?? r.lng ?? r.lon) || SCHOOL_COORDS.lng;
                const speed = parseFloat(r.speed) || 0;
                const lastUpdateMs = r.updated_at ? new Date(r.updated_at).getTime() : 0;
                const ageSeconds = lastUpdateMs > 0 ? Math.floor((now - lastUpdateMs) / 1000) : 99999;
                const isOnline = ageSeconds <= 600;
                const dist = getDistanceFromSchoolKm(lat, lng);
                const isAtCampus = (dist * 1000) <= 50.0;
                const st = isAtCampus ? "At Campus" : (speed > 2 ? "Moving" : (isOnline ? "Idle" : "Stationary"));
                const eta = isAtCampus ? 0 : Math.max(1, Math.round((dist / (speed > 5 ? speed : 25)) * 60));

                return {
                  vehicleNo: r.vehicle_no || "JH-02-VAN-01",
                  driverName: r.driver_name || "School Driver",
                  driverPhone: r.driver_phone || "",
                  routeName: r.route_name || "School Transit Route",
                  latitude: lat,
                  longitude: lng,
                  speed: speed,
                  heading: parseFloat(r.heading) || 0,
                  status: st,
                  isOnline: isOnline,
                  distanceFromCampusKm: dist,
                  isInsideGeofence: isAtCampus,
                  etaMinutes: eta,
                  address: r.address || (isAtCampus ? "Prem Nagar Campus, Tapowan Public School" : `En Route (${dist} km from campus)`),
                  ageSeconds: ageSeconds
                };
              });
              data = { ok: true, vehicles: vehicles };
            }
          }
        } catch (_) {}
      }

      if (!data || !data.ok || !data.vehicles || !data.vehicles.length) return;

      activeVehiclesList = data.vehicles;
      updateVehicleSelector(activeVehiclesList);

      const van = data.vehicles.find(v => v.vehicleNo === currentVehicleNo) || data.vehicles[0];
      if (!van) return;

      currentVehicleNo = van.vehicleNo;
      updateHudDisplays(van);
      updateMapMarker(van);
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
    const pillVanDriver = document.getElementById("pill_vanDriver");

    const footerVanNo = document.getElementById("footer_vanNo");
    const footerVanRoute = document.getElementById("footer_vanRoute");
    const footerVanCoords = document.getElementById("footer_vanCoords");
    const footerVanAddress = document.getElementById("footer_vanAddress");
    const footerGoogleMapsDir = document.getElementById("footer_googleMapsDir");

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
    if (hudCallBtn) {
      if (van.driverPhone && van.driverPhone !== "9876543210") {
        hudCallBtn.href = `tel:${van.driverPhone}`;
        hudCallBtn.style.color = "#2563eb";
        hudCallBtn.style.background = "#eff6ff";
        hudCallBtn.innerHTML = `📞 ${van.driverPhone} &bull; Call Driver`;
      } else if (van.driverPhone) {
        hudCallBtn.href = `tel:${van.driverPhone}`;
        hudCallBtn.style.color = "#2563eb";
        hudCallBtn.style.background = "#eff6ff";
        hudCallBtn.innerHTML = `📞 ${van.driverPhone} &bull; Call Driver`;
      } else {
        hudCallBtn.href = "javascript:void(0)";
        hudCallBtn.style.color = "#64748b";
        hudCallBtn.style.background = "#f1f5f9";
        hudCallBtn.innerHTML = `📞 No Phone Set`;
      }
    }

    if (btnOpenApp && van.latitude && van.longitude) {
      btnOpenApp.href = `https://www.google.com/maps/search/?api=1&query=${van.latitude},${van.longitude}`;
    }

    // Floating Map Sensor Pill
    if (pillVanNo) pillVanNo.textContent = van.vehicleNo;
    if (pillVanSpeed) pillVanSpeed.textContent = `${speedVal} km/h`;
    if (pillVanDist) pillVanDist.textContent = `${van.distanceFromCampusKm} km to Campus`;
    if (pillVanDriver) pillVanDriver.textContent = `Driver: ${van.driverName || 'Driver'}`;

    // Footer Location Summary
    if (footerVanNo) footerVanNo.textContent = van.vehicleNo;
    if (footerVanRoute) footerVanRoute.textContent = van.routeName || "School Route";
    if (footerVanCoords && van.latitude && van.longitude) {
      footerVanCoords.textContent = `${Number(van.latitude).toFixed(6)}° N, ${Number(van.longitude).toFixed(6)}° E`;
    }
    if (footerVanAddress) {
      footerVanAddress.textContent = van.isInsideGeofence ? "Prem Nagar Campus, Tapowan Public School" : (van.address || `${van.distanceFromCampusKm} km from Prem Nagar Campus`);
    }
    if (footerGoogleMapsDir && van.latitude && van.longitude) {
      footerGoogleMapsDir.href = `https://www.google.com/maps/dir/?api=1&destination=${van.latitude},${van.longitude}`;
    }
  }

  // Update Van Marker Position, Animated Pulsing Halo, Distance Line, and Popup
  function updateMapMarker(van) {
    if (!van || !van.latitude || !van.longitude) return;

    const lat = van.latitude;
    const lng = van.longitude;
    const speed = van.speed || 0;
    const isMoving = (van.status === "Moving");

    // Update Leaflet Map Marker
    if (transportMap && vanMarker) {
      vanMarker.setLatLng([lat, lng]);
      vanMarker.setIcon(createVanIcon(van.heading || 0, isMoving, van.status, speed, van.vehicleNo, van.driverName));

      // Update distance line connecting School Campus and Van
      if (distanceLine) {
        distanceLine.setLatLngs([[SCHOOL_COORDS.lat, SCHOOL_COORDS.lng], [lat, lng]]);
        distanceLine.setStyle({
          color: van.isInsideGeofence ? "#22c55e" : "#f59e0b",
          dashArray: van.isInsideGeofence ? null : "6, 8"
        });
      }

      // Update interactive Popup
      const popupHtml = `
        <div style="font-family:sans-serif; min-width:220px; padding:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px;">
            <strong style="color:#0f172a; font-size:1.05rem;">🚐 ${van.vehicleNo}</strong>
            <span style="font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px; background:${isMoving ? '#dcfce7' : '#e0f2fe'}; color:${isMoving ? '#15803d' : '#0369a1'};">${van.status}</span>
          </div>
          <div style="font-size:0.84rem; color:#334155; line-height:1.6;">
            <div><strong>Driver:</strong> ${van.driverName || 'School Driver'}</div>
            <div><strong>Speed:</strong> ${Math.round(speed)} km/h</div>
            <div><strong>Distance to Campus:</strong> ${van.distanceFromCampusKm} km (~${van.etaMinutes} mins)</div>
            <div><strong>Geofence:</strong> ${van.isInsideGeofence ? '<span style="color:#16a34a; font-weight:800;">Inside 50m School Perimeter</span>' : 'En Route to Campus'}</div>
            <div><strong>Location:</strong> ${van.address}</div>
          </div>
          <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
            ${van.driverPhone ? `<a href="tel:${van.driverPhone}" style="display:flex; align-items:center; justify-content:center; gap:6px; background:#2563eb; color:#fff; font-size:0.8rem; font-weight:700; text-decoration:none; padding:7px 10px; border-radius:8px;">📞 Call Driver (${van.driverPhone})</a>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:6px; background:#f1f5f9; color:#1e293b; font-size:0.78rem; font-weight:700; text-decoration:none; padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1;">🧭 Driving Directions in Google Maps</a>
          </div>
        </div>
      `;
      vanMarker.bindPopup(popupHtml);

      // On first load, automatically frame BOTH the School and the Van so the user sees everything
      if (!hasCenteredInitialVan) {
        hasCenteredInitialVan = true;
        transportMap.fitBounds([
          [SCHOOL_COORDS.lat, SCHOOL_COORDS.lng],
          [lat, lng]
        ], { padding: [70, 70], maxZoom: 17 });
      }

      // Auto-pan if enabled
      if (autoFollow) {
        transportMap.panTo([lat, lng], { animate: true, duration: 1 });
      }
    }

    // If Google iframe is currently visible, update it too
    if (currentActiveLayer === "google") {
      const iframe = document.getElementById("realGoogleMapFrame");
      if (iframe && autoFollow) {
        iframe.src = buildGoogleEmbedUrl(`${lat},${lng}(School+Van+${van.vehicleNo})`, 16, 'm');
      }
    }
  }
})();
