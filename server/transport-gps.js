// server/transport-gps.js
// Real-Time Hardware GPS Tracking & Vehicle Telematics Engine for Tapowan Public School

const express = require("express");
const router = express.Router();
const { db, runRaw } = require("./db-sqlite");

// Campus Anchor Coordinates (Tapowan Public School, Prem Nagar)
const SCHOOL_COORDS = {
  lat: 23.8209682,
  lng: 85.5119629,
  name: "Tapowan Public School (Prem Nagar)",
  radiusMeters: 50.0
};

// Haversine Distance in Kilometers
function getDistanceFromSchoolKm(lat, lng) {
  if (!lat || !lng) return 0;
  const R = 6371; // Earth radius in km
  const dLat = (lat - SCHOOL_COORDS.lat) * (Math.PI / 180);
  const dLng = (lng - SCHOOL_COORDS.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(SCHOOL_COORDS.lat * (Math.PI / 180)) *
    Math.cos(lat * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Estimate ETA in minutes (avg 30 km/h in school zone)
function computeEtaMinutes(distanceKm, speedKmH) {
  if (distanceKm <= 0.05) return 0; // Inside campus
  const effectiveSpeed = (speedKmH && speedKmH > 5) ? speedKmH : 25;
  const hours = distanceKm / effectiveSpeed;
  return Math.max(1, Math.round(hours * 60));
}

// In-memory throttle for history logging (max 1 point every 10 seconds per vehicle)
const lastHistoryLogged = new Map();

// ----------------------------------------------------
// 1. GET /api/transport/gps/live
// Returns all active vehicles with live coordinates & telemetry
// ----------------------------------------------------
router.get("/gps/live", async (req, res) => {
  try {
    const q = `
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
        l.altitude,
        l.accuracy,
        l.ignition,
        l.battery,
        l.status as raw_status,
        l.address,
        l.updated_at
      FROM transport_vehicles v
      LEFT JOIN transport_gps_live l ON UPPER(TRIM(v.vehicle_no)) = UPPER(TRIM(l.vehicle_no))
      WHERE v.is_active = 1
      ORDER BY v.id ASC
    `;
    const result = await runRaw(q);
    const rows = result.rows || [];

    const now = Date.now();
    const vehicles = rows.map(r => {
      const lat = parseFloat(r.latitude ?? r.lat) || SCHOOL_COORDS.lat;
      const lng = parseFloat(r.longitude ?? r.lng ?? r.lon) || SCHOOL_COORDS.lng;
      const speed = parseFloat(r.speed) || 0;
      const heading = parseFloat(r.heading) || 0;

      let lastUpdateMs = 0;
      if (r.updated_at) {
        lastUpdateMs = new Date(r.updated_at).getTime();
      }
      const ageSeconds = lastUpdateMs > 0 ? Math.floor((now - lastUpdateMs) / 1000) : 99999;

      // Real-time status determination
      let status = "Stationary";
      let isOnline = false;
      if (ageSeconds <= 90) {
        isOnline = true;
        status = speed > 2 ? "Moving" : "Idle";
      } else if (ageSeconds <= 600) {
        isOnline = true;
        status = "Idle";
      } else {
        isOnline = false;
        status = "Offline";
      }

      const distanceKm = getDistanceFromSchoolKm(lat, lng);
      const isInsideGeofence = (distanceKm * 1000) <= SCHOOL_COORDS.radiusMeters;
      if (isInsideGeofence) {
        status = "At Campus";
      }

      const etaMins = isInsideGeofence ? 0 : computeEtaMinutes(distanceKm, speed);

      return {
        vehicleNo: r.vehicle_no || "JH-02-VAN-01",
        deviceId: r.device_id || "",
        vehicleType: r.vehicle_type || "Van",
        routeName: r.route_name || "School Transit Route",
        driverName: r.driver_name || "School Driver",
        driverPhone: r.driver_phone || "",
        capacity: r.capacity || 20,
        latitude: lat,
        longitude: lng,
        speed: speed,
        heading: heading,
        ignition: r.ignition || (isOnline ? "ON" : "OFF"),
        battery: parseFloat(r.battery) || 100,
        status: status,
        isOnline: isOnline,
        distanceFromCampusKm: distanceKm,
        isInsideGeofence: isInsideGeofence,
        etaMinutes: etaMins,
        address: r.address || (isInsideGeofence ? "Tapowan Public School Campus" : `En Route (~${distanceKm} km to school)`),
        lastUpdated: r.updated_at || new Date().toISOString(),
        ageSeconds: ageSeconds
      };
    });

    res.json({
      ok: true,
      schoolAnchor: SCHOOL_COORDS,
      vehicles: vehicles,
      count: vehicles.length,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in /api/transport/gps/live:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------
// 2. POST & GET /api/transport/gps/update
// Universal Ingestion Webhook for Hardware GPS Trackers (SinoTrack, Coban, AIS-140, OsmAnd, Mobile)
// ----------------------------------------------------
const handleGpsUpdate = async (req, res) => {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}) };

    // Flexible key resolution across multiple tracker manufacturer formats
    const vehicleNoRaw = payload.vehicleNo || payload.vehicle_no || payload.id || payload.deviceId || payload.device_id || payload.imei || payload.trackerId || "JH-02-VAN-01";
    const vehicleNo = String(vehicleNoRaw).trim();

    const latRaw = payload.lat || payload.latitude;
    const lngRaw = payload.lng || payload.lon || payload.longitude;

    if (latRaw == null || lngRaw == null) {
      return res.status(400).json({ ok: false, error: "Missing latitude or longitude parameters" });
    }

    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: "Invalid latitude/longitude coordinates" });
    }

    // Speed (auto-convert knots or m/s if indicated)
    let speed = parseFloat(payload.speed || payload.spd || 0);
    if (payload.unit === "knots" || payload.unit === "kn") {
      speed = speed * 1.852;
    } else if (payload.unit === "mps") {
      speed = speed * 3.6;
    }
    speed = Math.max(0, parseFloat(speed.toFixed(1)));

    const heading = parseFloat(payload.heading || payload.bearing || payload.direction || payload.course || 0);
    const altitude = parseFloat(payload.altitude || payload.alt || 0);
    const accuracy = parseFloat(payload.accuracy || payload.acc || 5);
    const ignition = (String(payload.ignition || payload.acc_status || payload.power || "ON").toUpperCase() === "OFF") ? "OFF" : "ON";
    const battery = Math.min(100, Math.max(0, parseFloat(payload.battery || payload.batt || 95)));

    const distanceKm = getDistanceFromSchoolKm(lat, lng);
    const isAtCampus = (distanceKm * 1000) <= SCHOOL_COORDS.radiusMeters;
    const status = isAtCampus ? "At Campus" : (speed > 2 ? "Moving" : "Idle");

    // 1. Ensure vehicle exists in registry & update driver details if provided
    const driverName = String(payload.driverName || payload.driver_name || "").trim();
    const driverPhone = String(payload.driverPhone || payload.driver_phone || "").trim();

    if (driverName || driverPhone) {
      await runRaw(`
        UPDATE transport_vehicles
        SET driver_name = CASE WHEN ? != '' THEN ? ELSE driver_name END,
            driver_phone = CASE WHEN ? != '' THEN ? ELSE driver_phone END
        WHERE UPPER(TRIM(vehicle_no)) = UPPER(TRIM(?))
      `, [driverName, driverName, driverPhone, driverPhone, vehicleNo]).catch(() => {});
    }

    await runRaw(`
      INSERT INTO transport_vehicles (vehicle_no, device_id, vehicle_type, route_name, driver_name, driver_phone)
      VALUES (?, ?, 'Van', 'Main Campus Route', ?, ?)
      ON CONFLICT(vehicle_no) DO UPDATE SET
        driver_name = CASE WHEN excluded.driver_name IS NOT NULL AND excluded.driver_name != '' AND excluded.driver_name != 'School Driver' THEN excluded.driver_name ELSE transport_vehicles.driver_name END,
        driver_phone = CASE WHEN excluded.driver_phone IS NOT NULL AND excluded.driver_phone != '' THEN excluded.driver_phone ELSE transport_vehicles.driver_phone END
    `, [vehicleNo, payload.deviceId || vehicleNo, driverName || 'School Driver', driverPhone || '']).catch(() => {});

    // 2. UPSERT into transport_gps_live
    await runRaw(`
      INSERT INTO transport_gps_live (
        vehicle_no, device_id, latitude, longitude, speed, heading, altitude, accuracy, ignition, battery, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(vehicle_no) DO UPDATE SET
        device_id = COALESCE(excluded.device_id, transport_gps_live.device_id),
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        speed = excluded.speed,
        heading = excluded.heading,
        altitude = excluded.altitude,
        accuracy = excluded.accuracy,
        ignition = excluded.ignition,
        battery = excluded.battery,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `, [vehicleNo, payload.deviceId || vehicleNo, lat, lng, speed, heading, altitude, accuracy, ignition, battery, status]);

    // 3. Log into history trail (throttled to 1 point per 10s per vehicle)
    const nowMs = Date.now();
    const lastLog = lastHistoryLogged.get(vehicleNo) || 0;
    if (nowMs - lastLog >= 10000 || speed > 5) {
      lastHistoryLogged.set(vehicleNo, nowMs);
      await runRaw(`
        INSERT INTO transport_gps_history (vehicle_no, latitude, longitude, speed, heading, recorded_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [vehicleNo, lat, lng, speed, heading]).catch(() => {});
    }

    res.json({
      ok: true,
      message: "GPS telemetry updated successfully",
      vehicleNo: vehicleNo,
      latitude: lat,
      longitude: lng,
      speed: speed,
      status: status,
      distanceFromCampusKm: distanceKm
    });
  } catch (err) {
    console.error("Error in GPS update handler:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

router.post("/gps/update", handleGpsUpdate);
router.get("/gps/update", handleGpsUpdate);

// ----------------------------------------------------
// 3. GET /api/transport/gps/history
// Returns today's breadcrumb trail for route polyline rendering
// ----------------------------------------------------
router.get("/gps/history", async (req, res) => {
  try {
    const vehicleNo = String(req.query.vehicleNo || "JH-02-VAN-01").trim();
    const limit = Math.min(500, Math.max(10, parseInt(req.query.limit, 10) || 200));

    const q = `
      SELECT latitude, longitude, speed, heading, recorded_at
      FROM transport_gps_history
      WHERE UPPER(TRIM(vehicle_no)) = UPPER(TRIM(?))
      ORDER BY id ASC
      LIMIT ?
    `;
    const result = await runRaw(q, [vehicleNo, limit]);
    const trail = (result.rows || []).map(r => ({
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      speed: parseFloat(r.speed) || 0,
      heading: parseFloat(r.heading) || 0,
      time: r.recorded_at
    }));

    res.json({
      ok: true,
      vehicleNo: vehicleNo,
      count: trail.length,
      trail: trail
    });
  } catch (err) {
    console.error("Error in /api/transport/gps/history:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------
// 4. POST /api/transport/gps/simulate
// Live Test Simulation along Barhi - Prem Nagar corridor to Tapowan School
// ----------------------------------------------------
let activeSimulationTimer = null;
router.post("/gps/simulate", async (req, res) => {
  try {
    const vehicleNo = String(req.body.vehicleNo || "JH-02-VAN-01").trim();

    // 12 Waypoints starting from Barhi Chowk moving toward Tapowan Public School Prem Nagar
    const WAYPOINTS = [
      { lat: 23.834500, lng: 85.503200, speed: 38, heading: 145 },
      { lat: 23.832200, lng: 85.505400, speed: 42, heading: 140 },
      { lat: 23.830100, lng: 85.507100, speed: 36, heading: 135 },
      { lat: 23.827800, lng: 85.508800, speed: 32, heading: 130 },
      { lat: 23.825500, lng: 85.510100, speed: 28, heading: 125 },
      { lat: 23.823400, lng: 85.511200, speed: 24, heading: 120 },
      { lat: 23.822100, lng: 85.511700, speed: 20, heading: 110 },
      { lat: 23.821400, lng: 85.511900, speed: 15, heading: 100 },
      { lat: 23.8209682, lng: 85.5119629, speed: 0, heading: 90 } // Tapowan Campus
    ];

    if (activeSimulationTimer) clearInterval(activeSimulationTimer);
    let step = 0;

    // Immediately push waypoint 0
    const wp0 = WAYPOINTS[0];
    await runRaw(`
      INSERT INTO transport_gps_live (vehicle_no, device_id, latitude, longitude, speed, heading, ignition, battery, status, updated_at)
      VALUES (?, 'SIM-VAN', ?, ?, ?, ?, 'ON', 96, 'Moving', CURRENT_TIMESTAMP)
      ON CONFLICT(vehicle_no) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        speed = excluded.speed,
        heading = excluded.heading,
        ignition = excluded.ignition,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `, [vehicleNo, wp0.lat, wp0.lng, wp0.speed, wp0.heading]);

    activeSimulationTimer = setInterval(async () => {
      step++;
      if (step >= WAYPOINTS.length) {
        clearInterval(activeSimulationTimer);
        activeSimulationTimer = null;
        return;
      }
      const pt = WAYPOINTS[step];
      const isLast = (step === WAYPOINTS.length - 1);
      const st = isLast ? "At Campus" : "Moving";

      await runRaw(`
        UPDATE transport_gps_live
        SET latitude = ?, longitude = ?, speed = ?, heading = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE UPPER(TRIM(vehicle_no)) = UPPER(TRIM(?))
      `, [pt.lat, pt.lng, pt.speed, pt.heading, st, vehicleNo]).catch(() => {});

      await runRaw(`
        INSERT INTO transport_gps_history (vehicle_no, latitude, longitude, speed, heading, recorded_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [vehicleNo, pt.lat, pt.lng, pt.speed, pt.heading]).catch(() => {});
    }, 4000);

    res.json({
      ok: true,
      message: `Started live test simulation for ${vehicleNo} along Barhi-Prem Nagar corridor to Tapowan Campus (9 waypoints, 4s interval).`,
      waypointsCount: WAYPOINTS.length
    });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------
// 5. GET & POST /api/transport/vehicles
// Manage fleet registry
// ----------------------------------------------------
router.get("/vehicles", async (req, res) => {
  try {
    const result = await runRaw("SELECT * FROM transport_vehicles ORDER BY id ASC");
    res.json({ ok: true, vehicles: result.rows || [] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/vehicles", async (req, res) => {
  try {
    const { vehicleNo, deviceId, vehicleType, routeName, driverName, driverPhone, capacity } = req.body || {};
    if (!vehicleNo) return res.status(400).json({ ok: false, error: "Vehicle No is required" });

    await runRaw(`
      INSERT INTO transport_vehicles (vehicle_no, device_id, vehicle_type, route_name, driver_name, driver_phone, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(vehicle_no) DO UPDATE SET
        device_id = excluded.device_id,
        vehicle_type = excluded.vehicle_type,
        route_name = excluded.route_name,
        driver_name = excluded.driver_name,
        driver_phone = excluded.driver_phone,
        capacity = excluded.capacity
    `, [vehicleNo.trim(), deviceId || vehicleNo.trim(), vehicleType || "Van", routeName || "", driverName || "", driverPhone || "", parseInt(capacity, 10) || 20]);

    res.json({ ok: true, message: `Vehicle ${vehicleNo} saved successfully` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
