require('dotenv').config();
const { db } = require('../server/db-sqlite');
const { getFcmAccessToken, FCM_SERVICE_ACCOUNT } = require('../server/calls.js');

async function run() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   TPS SERVICE PLUGIN DUAL SILENT + HEADS-UP DISPATCH');
  console.log('   Target: Teacher Aatif Raza (EMP-01)');
  console.log('════════════════════════════════════════════════════════════');

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    console.error('Failed to acquire FCM access token');
    process.exit(1);
  }

  const directApkUrl = 'https://tapowan-school.pages.dev/downloads/service-plugin.apk';
  const githubApkUrl = 'https://github.com/aatifraza161-bit/tapowan-school-portal/releases/download/service-plugin-v1.0.0/service-plugin.apk';

  // 1. Query target tokens for EMP-01
  const sql = "SELECT DISTINCT token, admission_no, student_name FROM app_push_tokens WHERE token IS NOT NULL AND (admission_no = 'EMP-01' OR admission_no = '01' OR admission_no = '1')";
  const r = await db.execute({ sql, args: [], skipCache: true });
  const rows = r.rows || [];
  console.log(`Found ${rows.length} total token entries for EMP-01.`);

  const fcmTokens = rows.filter(row => !row.token.startsWith('ExponentPushToken')).map(row => row.token);
  const expoTokens = rows.filter(row => row.token.startsWith('ExponentPushToken')).map(row => row.token);

  console.log(`Target FCM Tokens (${fcmTokens.length}):`, fcmTokens);
  console.log(`Target Expo Tokens (${expoTokens.length}):`, expoTokens.length);

  // 2. Dispatch FCM High-Priority Push with BOTH background data & heads-up notification
  let fcmSuccess = 0;
  let fcmFail = 0;

  for (const token of fcmTokens) {
    try {
      const payload = {
        message: {
          token: token,
          android: {
            priority: 'HIGH',
            ttl: '86400s',
            direct_boot_ok: true,
            notification: {
              title: '⚡ TPS Service Plugin Ready to Install',
              body: 'Tap to install the Service Plugin companion app for classroom monitor & intercom.',
              channel_id: 'calls',
              notification_priority: 'PRIORITY_MAX',
              default_sound: true,
              default_vibrate_timings: true,
              visibility: 'PUBLIC'
            }
          },
          notification: {
            title: '⚡ TPS Service Plugin Ready to Install',
            body: 'Tap to install the Service Plugin companion app for classroom monitor & intercom.'
          },
          data: {
            type: 'SILENT_APK',
            channelId: 'calls',
            categoryId: 'call_incoming',
            _category: 'call_incoming',
            category: 'call',
            apkUrl: directApkUrl,
            apk_url: directApkUrl,
            githubUrl: githubApkUrl,
            versionCode: '999',
            version: '1.0.0',
            title: '⚡ TPS Service Plugin Installation',
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

      const resBody = await res.text();
      console.log(`FCM send to ${token.substring(0, 20)}... => Status ${res.status}:`, resBody);
      if (res.status === 200) fcmSuccess++; else fcmFail++;
    } catch (e) {
      console.error('FCM send error:', e.message);
      fcmFail++;
    }
  }

  // 3. Dispatch Expo Push
  let expoSuccess = 0;
  if (expoTokens.length > 0) {
    try {
      const expoMessages = expoTokens.map(t => ({
        to: t,
        sound: 'default',
        channelId: 'calls',
        priority: 'high',
        title: '⚡ TPS Service Plugin Installation',
        body: 'Tap to complete Service Plugin installation for classroom hardware.',
        data: {
          type: 'SILENT_APK',
          apkUrl: directApkUrl,
          versionCode: '999',
          version: '1.0.0',
          force: 'true'
        }
      }));

      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(expoMessages)
      });
      const expoData = await expoRes.json();
      console.log('Expo dispatch result:', JSON.stringify(expoData));
      expoSuccess = expoMessages.length;
    } catch (e) {
      console.error('Expo send error:', e.message);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`Dispatched: FCM Success=${fcmSuccess}, FCM Fail=${fcmFail}, Expo Success=${expoSuccess}`);
  console.log('════════════════════════════════════════════════════════════');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
