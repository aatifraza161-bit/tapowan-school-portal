require('dotenv').config();
const { broadcastSilentApkPush } = require('../server/calls.js');

async function run() {
  console.log('🚀 Pushing Service Plugin silent APK update specifically to Teacher Aatif Raza (EMP-01)...');
  
  const apkUrl = 'https://github.com/aatifraza161-bit/tapowan-school-portal/releases/download/v3.4.0/service-plugin.apk';
  const result = await broadcastSilentApkPush({
    apkUrl: apkUrl,
    versionCode: '999',
    version: '1.0.0',
    targetAdmissionNo: 'EMP-01'
  });
  
  console.log('Push Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during push:', err);
  process.exit(1);
});
