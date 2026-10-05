/**
 * TPS Silent Background OTA Push Dispatcher
 * Usage:
 *   node scripts/push_silent_ota.js                  (Broadcasts latest bundle to ALL devices)
 *   node scripts/push_silent_ota.js EMP-04           (Sends specifically to Nicky Kumari)
 *   node scripts/push_silent_ota.js 053/18           (Sends specifically to Shivam Modi)
 */

const fs = require('fs');
const path = require('path');

const versionJsonPath = path.join(__dirname, '../public/bundles/version.json');
let versionInfo = { bundleVersion: '2.4.59', bundleVersionCode: 199, bundleUrl: 'https://tapowan-school.vercel.app/bundles/index.android.bundle' };

try {
  if (fs.existsSync(versionJsonPath)) {
    versionInfo = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  }
} catch (e) {}

const target = process.argv[2] || null;

async function run() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   TPS SILENT BACKGROUND OTA PUSH DISPATCHER');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`📦 Bundle Version:     v${versionInfo.bundleVersion} (Code ${versionInfo.bundleVersionCode})`);
  console.log(`🔗 Bundle URL:         ${versionInfo.bundleUrl}`);
  console.log(`🎯 Target:             ${target ? `Specific Account: ${target}` : 'ALL Devices'}`);
  console.log('────────────────────────────────────────────────────────────\n');

  try {
    const res = await fetch('https://tapowan-school.vercel.app/api/admin/ota/broadcast-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundleUrl: versionInfo.bundleUrl,
        bundleVersionCode: String(versionInfo.bundleVersionCode),
        bundleVersion: versionInfo.bundleVersion,
        targetAdmissionNo: target
      })
    });

    const result = await res.json();
    console.log('API Response Status:', res.status);
    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.ok) {
      console.log(`\n✅ High-priority silent FCM push dispatched to ${result.totalTargeted || 0} device(s)!`);
      console.log('📱 Connected devices will download and install the new JS bundle in the background without opening the app.');
    } else {
      console.log('\n❌ Push failed:', result.error || result.message);
    }
  } catch (err) {
    console.error('Network error calling broadcast endpoint:', err.message);
  }
}

run();
