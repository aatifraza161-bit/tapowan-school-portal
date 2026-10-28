// scripts/make_school_data_dynamic.js
// Makes all school data, transport areas, villages, receipts, and GPS coordinates
// dynamically fetched from the database (settings table / getSchoolMeta) for multi-tenant school support.

const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../public/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Dynamic getVillageList
const oldVillageIdx = content.indexOf('function getVillageList() {');
if (oldVillageIdx !== -1) {
  const endVillageIdx = content.indexOf('function saveCustomVillage(', oldVillageIdx);
  if (endVillageIdx !== -1) {
    const newVillageCode = `function getVillageList() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("tps_custom_villages") || "[]"); } catch(e){}
  const store = (typeof getStore === "function") ? getStore() : {};
  const fromStudents = (store.students || []).map(s => s.village || s.address).filter(Boolean);
  const fromAdmissions = (store.admissions || []).map(a => a.village).filter(Boolean);
  const schoolMeta = (typeof window.getSchoolMeta === "function") ? window.getSchoolMeta() : {};
  const fromSettings = Array.isArray(schoolMeta.villages) && schoolMeta.villages.length ? schoolMeta.villages : (schoolMeta.city ? [schoolMeta.city] : []);
  return Array.from(new Set([...fromSettings, ...saved, ...fromStudents, ...fromAdmissions].map(v => String(v).trim()))).filter(Boolean).sort();
}

`;
    content = content.substring(0, oldVillageIdx) + newVillageCode + content.substring(endVillageIdx);
    console.log('1. Replaced getVillageList with dynamic DB-driven resolver');
  }
}

// 2. Dynamic getTransportAreaList
const oldTransIdx = content.indexOf('function getTransportAreaList() {');
if (oldTransIdx !== -1) {
  const endTransIdx = content.indexOf('function saveCustomTransportArea(', oldTransIdx);
  if (endTransIdx !== -1) {
    const newTransCode = `function getTransportAreaList() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("tps_custom_transport_areas") || "[]"); } catch(e){}
  const store = (typeof getStore === "function") ? getStore() : {};
  const fromStudents = (store.students || []).map(s => s.transportArea).filter(Boolean);
  const fromAdmissions = (store.admissions || []).map(a => a.transportArea).filter(Boolean);
  const fromRoutes = (store.transport || []).map(t => t.pickupPoint || t.routeName).filter(Boolean);
  const schoolMeta = (typeof window.getSchoolMeta === "function") ? window.getSchoolMeta() : {};
  const fromSettings = Array.isArray(schoolMeta.transportAreas) ? schoolMeta.transportAreas : [];
  const defaults = ["None / Not Availed"];
  return Array.from(new Set([...defaults, ...fromSettings, ...saved, ...fromStudents, ...fromAdmissions, ...fromRoutes].map(t => String(t).trim()))).filter(Boolean);
}

`;
    content = content.substring(0, oldTransIdx) + newTransCode + content.substring(endTransIdx);
    console.log('2. Replaced getTransportAreaList with dynamic DB-driven resolver');
  }
}

// 3. Dynamic getPrevSchoolList
content = content.replace(
  'const defaults = ["Tapowan Public School", "St. Xavier School", "DAV Public School", "Kendriya Vidyalaya", "Government Primary School", "Saraswati Shishu Mandir"];',
  'const schoolMeta = (typeof window.getSchoolMeta === "function") ? window.getSchoolMeta() : {}; const curSchoolName = schoolMeta.name || "School"; const defaults = [curSchoolName, "St. Xavier School", "DAV Public School", "Kendriya Vidyalaya", "Government Primary School", "Saraswati Shishu Mandir"];'
);

// 4. Replace hardcoded ID card generator values
content = content.replace(
  /const schoolName\s*=\s*'Tapowan Public School';\s*const schoolAddr\s*=\s*'Prem Nagar, Tapin North';\s*const schoolDist\s*=\s*'Ramgarh\(JH\)';\s*const schoolPhone\s*=\s*'8757744973';/,
  `const _schoolMeta = (typeof window.getSchoolMeta === "function") ? window.getSchoolMeta() : {};
  const schoolName  = _schoolMeta.name || 'School ERP';
  const schoolAddr  = _schoolMeta.address || _schoolMeta.campus || '';
  const schoolDist  = _schoolMeta.city || '';
  const schoolPhone = _schoolMeta.phone || '';`
);

// 5. Replace hardcoded school name and address in receipt / slip templates
content = content.split('const schoolName = "Tapowan Public School";').join('const _schoolMeta = (typeof window.getSchoolMeta === "function") ? window.getSchoolMeta() : {}; const schoolName = _schoolMeta.name || "School ERP";');
content = content.split('Prem Nagar Tapin North, Ramgarh(JH)').join('${(typeof window.getSchoolMeta === "function" ? (window.getSchoolMeta().address || window.getSchoolMeta().city) : "") || ""}');

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Done updating public/app.js!');

// Update transport_gps_module.js to dynamically fetch school coordinates & name
const gpsModulePath = path.join(__dirname, '../public/transport_gps_module.js');
if (fs.existsSync(gpsModulePath)) {
  let gpsContent = fs.readFileSync(gpsModulePath, 'utf8');

  gpsContent = gpsContent.replace(
    /const SCHOOL_COORDS = \{[\s\S]*?radiusMeters:\s*50\.0\s*\};/,
    `function getSchoolAnchor() {
    const meta = (typeof window.getSchoolMeta === "function") ? window.getSchoolMeta() : {};
    return {
      lat: Number(meta.latitude) || 23.8209682,
      lng: Number(meta.longitude) || 85.5119629,
      name: meta.name || "School Campus",
      address: meta.address || meta.campus || "Main Campus",
      radiusMeters: Number(meta.radiusMeters) || 50.0
    };
  }
  const SCHOOL_COORDS = getSchoolAnchor();`
  );

  fs.writeFileSync(gpsModulePath, gpsContent, 'utf8');
  console.log('Done updating public/transport_gps_module.js with dynamic getSchoolAnchor()!');
}
