const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach(l => {
    const k = l.split('=')[0];
    if (k) process.env[k.trim()] = l.substring(k.length + 1).trim();
  });
}
const db = require('../server/db-sqlite.js');

async function migrate() {
  console.log('Creating Transport GPS tables in Turso Cloud...');
  
  await db.runRaw(`
    CREATE TABLE IF NOT EXISTS transport_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_no TEXT UNIQUE NOT NULL,
      device_id TEXT,
      vehicle_type TEXT DEFAULT 'Van',
      route_name TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      capacity INTEGER DEFAULT 20,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✓ transport_vehicles created');

  await db.runRaw(`
    CREATE TABLE IF NOT EXISTS transport_gps_live (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_no TEXT UNIQUE NOT NULL,
      device_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL DEFAULT 0,
      heading REAL DEFAULT 0,
      altitude REAL DEFAULT 0,
      accuracy REAL DEFAULT 5,
      ignition TEXT DEFAULT 'ON',
      battery REAL DEFAULT 100,
      status TEXT DEFAULT 'Moving',
      address TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✓ transport_gps_live created');

  await db.runRaw(`
    CREATE TABLE IF NOT EXISTS transport_gps_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_no TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL DEFAULT 0,
      heading REAL DEFAULT 0,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✓ transport_gps_history created');

  // Seed default School Van if none exists
  const existing = await db.runRaw("SELECT COUNT(*) as cnt FROM transport_vehicles");
  const count = existing.rows[0]?.cnt || 0;
  if (count === 0) {
    console.log('Seeding initial School Van...');
    await db.runRaw(`
      INSERT INTO transport_vehicles (vehicle_no, device_id, vehicle_type, route_name, driver_name, driver_phone, capacity)
      VALUES ('JH-02-VAN-01', 'GPS-VAN-01', 'Van', 'Main Campus Route (Prem Nagar - Barhi)', 'Ramesh Yadav', '9876543210', 22)
    `);
    
    // Seed initial live coordinates (Tapowan School Campus: 23.8209682, 85.5119629)
    await db.runRaw(`
      INSERT INTO transport_gps_live (vehicle_no, device_id, latitude, longitude, speed, heading, ignition, battery, status, address)
      VALUES ('JH-02-VAN-01', 'GPS-VAN-01', 23.8209682, 85.5119629, 0, 90, 'ON', 98, 'Stationary at Campus', 'Prem Nagar Campus, Tapowan Public School')
    `);
    console.log('✓ Seeded initial School Van (JH-02-VAN-01)');
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);
