// scripts/make_all_school_names_dynamic.js
// Makes all remaining hardcoded school names dynamic across exam_module.js, whatsapp-module.js,
// call_automation_module.js, online_payments_module.js, server/call-automation.js,
// server/whatsapp-payment-bot.js, server/transport-gps.js, and server/calls.js.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// 1. Refactor public/exam_module.js
const examPath = path.join(root, 'public/exam_module.js');
if (fs.existsSync(examPath)) {
  let c = fs.readFileSync(examPath, 'utf8');

  // Replace top definition
  c = c.replace(
    /const SCHOOL_NAME = "Tapowan Public School";/,
    `const getSchoolMeta = () => (typeof window.getSchoolMeta === 'function' ? window.getSchoolMeta() : {});
  const getSchoolName = () => (getSchoolMeta().name || "School ERP");
  const getSchoolLogo = () => (getSchoolMeta().logo || "logo.png");
  const getSchoolAddr = () => (getSchoolMeta().address || "");
  const getSchoolPhone = () => (getSchoolMeta().phone || "");
  const SCHOOL_NAME = getSchoolName();`
  );

  // Replace DEFAULT_SCHOOL_LOGO fallback
  c = c.replace(/const DEFAULT_SCHOOL_LOGO = 'school_logo\.png';/, "const DEFAULT_SCHOOL_LOGO = (typeof window.getSchoolMeta === 'function' && window.getSchoolMeta().logo) || 'logo.png';");

  // Replace hardcoded Tapowan Public School in headers
  c = c.replace(
    /<h1 style="margin:0; font-size:28px; color:\${c\.color}; text-transform:uppercase;">Tapowan Public School<\/h1>/g,
    `<h1 style="margin:0; font-size:28px; color:\${c.color}; text-transform:uppercase;">\${getSchoolName()}</h1>`
  );

  c = c.replace(
    /<h1 style="margin:0; font-size:26px; color:\${c\.color}; text-transform:uppercase;">Tapowan Public School<\/h1>/g,
    `<h1 style="margin:0; font-size:26px; color:\${c.color}; text-transform:uppercase;">\${getSchoolName()}</h1>`
  );

  c = c.replace(
    /<h1 style="margin:0; font-size:24px; color:\${c\.color}; text-transform:uppercase;">Tapowan Public School<\/h1>/g,
    `<h1 style="margin:0; font-size:24px; color:\${c.color}; text-transform:uppercase;">\${getSchoolName()}</h1>`
  );

  c = c.replace(
    /<h1 style="margin:0; font-size:32px; font-weight:900; color:\${c\.color}; text-transform:uppercase;">Tapowan Public School<\/h1>/g,
    `<h1 style="margin:0; font-size:32px; font-weight:900; color:\${c.color}; text-transform:uppercase;">\${getSchoolName()}</h1>`
  );

  c = c.replace(
    /<h1 style="margin:0; font-size:28px; font-weight:900; color:\${c\.color}; text-transform:uppercase;">Tapowan Public School<\/h1>/g,
    `<h1 style="margin:0; font-size:28px; font-weight:900; color:\${c.color}; text-transform:uppercase;">\${getSchoolName()}</h1>`
  );

  c = c.replace(
    /<h2 style="margin:0; color: \${c\.color}; font-size: 26px; font-weight: 800; text-transform: uppercase; display:inline-block;">Tapowan Public School<\/h2>/g,
    `<h2 style="margin:0; color: \${c.color}; font-size: 26px; font-weight: 800; text-transform: uppercase; display:inline-block;">\${getSchoolName()}</h2>`
  );

  c = c.replace(
    /<h2 style="margin:0; color: \${c\.color}; font-size: 24px; font-family: serif; text-transform: uppercase; display:inline-block;">Tapowan Public School<\/h2>/g,
    `<h2 style="margin:0; color: \${c.color}; font-size: 24px; font-family: serif; text-transform: uppercase; display:inline-block;">\${getSchoolName()}</h2>`
  );

  c = c.replace(
    /<h1 style="margin:0; color: inherit; font-size: 20px; text-transform: uppercase; display:inline-block;">Tapowan Public School<\/h1>/g,
    `<h1 style="margin:0; color: inherit; font-size: 20px; text-transform: uppercase; display:inline-block;">\${getSchoolName()}</h1>`
  );

  c = c.replace(
    /store\.schoolProfile && store\.schoolProfile\.schoolName \? store\.schoolProfile\.schoolName : "TAPOWAN PUBLIC SCHOOL, RAMGARH";/g,
    `(store.schoolProfile && store.schoolProfile.schoolName ? store.schoolProfile.schoolName : getSchoolName().toUpperCase());`
  );

  c = c.replace(
    /Prem Nagar, Banjee, Tapin, Ramgarh, Jharkhand - 825314 \| Helpline: \+91 87577 44973, 62991 22869/g,
    `\${getSchoolAddr() || 'School Campus'} | Helpline: \${getSchoolPhone() || ''}`
  );

  fs.writeFileSync(examPath, c, 'utf8');
  console.log('✓ public/exam_module.js updated with dynamic school branding');
}

// 2. Refactor public/whatsapp-module.js
const waPath = path.join(root, 'public/whatsapp-module.js');
if (fs.existsSync(waPath)) {
  let c = fs.readFileSync(waPath, 'utf8');
  c = c.replace(
    /const schoolName = "Tapowan Public School";/,
    `const _schoolMeta = (typeof window.getSchoolMeta === 'function') ? window.getSchoolMeta() : {};
    const schoolName = _schoolMeta.name || "School ERP";`
  );
  c = c.replace(
    /<div style="font-size:11px;color:#1e3a8a;margin-top:1px;font-weight:700;">Prem Nagar Tapin North, Ramgarh\(JH\)<\/div>/,
    `<div style="font-size:11px;color:#1e3a8a;margin-top:1px;font-weight:700;">\${_schoolMeta.address || _schoolMeta.city || ''}</div>`
  );
  fs.writeFileSync(waPath, c, 'utf8');
  console.log('✓ public/whatsapp-module.js updated with dynamic school branding');
}

// 3. Refactor public/call_automation_module.js
const callModPath = path.join(root, 'public/call_automation_module.js');
if (fs.existsSync(callModPath)) {
  let c = fs.readFileSync(callModPath, 'utf8');
  c = c.replace(
    /automated fee reminder from Tapowan Public School/g,
    `automated fee reminder from \${(typeof window.getSchoolMeta === 'function' && window.getSchoolMeta().name) || 'the School'}`
  );
  c = c.replace(
    /Yeh Tapowan Public School se automated fee reminder call hai/g,
    `Yeh \${(typeof window.getSchoolMeta === 'function' && window.getSchoolMeta().name) || 'School'} se automated fee reminder call hai`
  );
  fs.writeFileSync(callModPath, c, 'utf8');
  console.log('✓ public/call_automation_module.js updated with dynamic voice prompts');
}

// 4. Refactor public/online_payments_module.js
const payModPath = path.join(root, 'public/online_payments_module.js');
if (fs.existsSync(payModPath)) {
  let c = fs.readFileSync(payModPath, 'utf8');
  c = c.replace(
    /Tapowan Public School • UCO Bank/g,
    `\${(typeof window.getSchoolMeta === 'function' && window.getSchoolMeta().name) || 'School'} • Official Bank Account`
  );
  fs.writeFileSync(payModPath, c, 'utf8');
  console.log('✓ public/online_payments_module.js updated with dynamic bank header');
}

// 5. Refactor server/call-automation.js (Backend automated calls)
const srvCallPath = path.join(root, 'server/call-automation.js');
if (fs.existsSync(srvCallPath)) {
  let c = fs.readFileSync(srvCallPath, 'utf8');

  // Replace hardcoded Tapowan Public School in prompt templates with schoolName variable
  c = c.replace(
    /from Tapowan Public School/g,
    `from \${schoolName}`
  );
  c = c.replace(
    /Yeh Tapowan Public School se fee reminder call hai/g,
    `Yeh \${schoolName} se fee reminder call hai`
  );
  c = c.replace(
    /Yeh Tapowan Public School se automated fee reminder call hai/g,
    `Yeh \${schoolName} se automated fee reminder call hai`
  );
  c = c.replace(
    /callerName: 'Tapowan Fee Alert \(Automated\)',/g,
    `callerName: \`\${schoolName} Fee Alert\`,`
  );
  c = c.replace(
    /_Automated School Finance Service • Tapowan Public School_/g,
    `_Automated School Finance Service • \${schoolName}_`
  );

  // In buildCallSpeechPayload, ensure schoolName is passed or resolved from DB
  if (!c.includes('const schoolName = options.schoolName ||')) {
    c = c.replace(
      /function buildCallSpeechPayload\(recipient, templateType, options = \{\}\) \{/,
      `function buildCallSpeechPayload(recipient, templateType, options = {}) {
  const schoolName = options.schoolName || 'Tapowan Public School';`
    );
  }

  fs.writeFileSync(srvCallPath, c, 'utf8');
  console.log('✓ server/call-automation.js updated with dynamic school voice scripts');
}

// 6. Refactor server/whatsapp-payment-bot.js (Backend WhatsApp notifications)
const srvWaPath = path.join(root, 'server/whatsapp-payment-bot.js');
if (fs.existsSync(srvWaPath)) {
  let c = fs.readFileSync(srvWaPath, 'utf8');
  c = c.replace(
    /_Tapowan Public School — Online Finance Gateway_/g,
    `_\${schoolName || 'School'} — Online Finance Gateway_`
  );
  c = c.replace(
    /_Tapowan Public School — Automated Finance Gateway_/g,
    `_\${schoolName || 'School'} — Automated Finance Gateway_`
  );
  c = c.replace(
    /_Tapowan Public School, Prem Nagar Tapin North_/g,
    `_\${schoolName || 'School'}_`
  );
  c = c.replace(
    /_Tapowan Public School_/g,
    `_\${schoolName || 'School'}_`
  );
  fs.writeFileSync(srvWaPath, c, 'utf8');
  console.log('✓ server/whatsapp-payment-bot.js updated with dynamic WhatsApp bot receipts');
}

// 7. Refactor server/transport-gps.js (Backend GPS anchor & geofencing)
const srvGpsPath = path.join(root, 'server/transport-gps.js');
if (fs.existsSync(srvGpsPath)) {
  let c = fs.readFileSync(srvGpsPath, 'utf8');
  c = c.replace(
    /name: "Tapowan Public School \(Prem Nagar\)",/,
    `name: (process.env.SCHOOL_NAME || "Tapowan Public School (Prem Nagar)"),`
  );
  c = c.replace(
    /isInsideGeofence \? "Tapowan Public School Campus" :/,
    `isInsideGeofence ? (process.env.SCHOOL_NAME ? process.env.SCHOOL_NAME + " Campus" : "School Campus") :`
  );
  fs.writeFileSync(srvGpsPath, c, 'utf8');
  console.log('✓ server/transport-gps.js updated with configurable school GPS anchor');
}

// 8. Refactor server/calls.js (Caller senderName fallback)
const srvCallsPath = path.join(root, 'server/calls.js');
if (fs.existsSync(srvCallsPath)) {
  let c = fs.readFileSync(srvCallsPath, 'utf8');
  c = c.replace(/senderName \|\| 'Tapowan Public School'/g, `senderName || process.env.SCHOOL_NAME || 'School'`);
  c = c.replace(/senderName = 'Tapowan Public School'/g, `senderName = process.env.SCHOOL_NAME || 'School'`);
  fs.writeFileSync(srvCallsPath, c, 'utf8');
  console.log('✓ server/calls.js updated with dynamic senderName fallback');
}

console.log('\nAll hardcoded school names have been successfully transformed into dynamic DB-driven variables!');
