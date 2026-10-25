require('dotenv').config();
const { broadcastSilentOtaPush } = require('../server/calls.js');

async function run() {
  console.log('🚀 Pushing Silent OTA Update (Bundle Code 369) specifically to Teacher Aatif Raza (EMP-01)...');

  const bundleUrl = 'https://tapowan-school.pages.dev/bundles/index.android.bundle';
  const result = await broadcastSilentOtaPush({
    bundleUrl: bundleUrl,
    bundleVersionCode: '369',
    bundleVersion: '3.4.1',
    targetAdmissionNo: 'EMP-01'
  });

  console.log('Push Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during OTA push:', err);
  process.exit(1);
});
