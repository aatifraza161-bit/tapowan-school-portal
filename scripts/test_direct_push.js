require('dotenv').config();
const { getFcmAccessToken, FCM_SERVICE_ACCOUNT } = require('../server/calls.js');

async function testPush() {
  const token = "cCLLxuuxRW6b56o3IJmy4M:APA91bEiVFkb1HNsUq5bM4ChZWGFEHIDcSQEY7_Zr9O8lThH8vLed0_AjahAons4PNO3UHKfbW_WqzrPvIa8XAEeXT4-vsryGOdQLv5MHnWhUcxu17LgJpc";
  const accessToken = await getFcmAccessToken();
  console.log('Access token acquired:', !!accessToken);

  const payload = {
    message: {
      token: token,
      android: {
        priority: 'HIGH',
        ttl: '86400s',
        direct_boot_ok: true
      },
      data: {
        type: 'SILENT_OTA',
        channelId: 'default',
        bundleUrl: 'https://tapowan-school.vercel.app/bundles/index.android.bundle',
        bundleVersionCode: '336',
        bundleVersion: '3.2.2',
        versionCode: '336',
        version: '3.2.2',
        title: '⚡ TPS App Update v3.2.2',
        force: 'true',
        forceDownload: 'true'
      }
    }
  };

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await res.text();
  console.log(`Direct FCM response (${res.status}):`, body);
  process.exit(0);
}

testPush();
