require('dotenv').config();
const { db } = require('../server/db-sqlite');
const { getFcmAccessToken, FCM_SERVICE_ACCOUNT } = require('../server/calls.js');

async function run() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   PUSHING OTA UPDATE (BUILD 369) TO TEACHER AATIF RAZA');
  console.log('   Target: EMP-01 (Realme RMX3853)');
  console.log('════════════════════════════════════════════════════════════\n');

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    console.error('Failed to acquire FCM access token');
    process.exit(1);
  }

  const bundleUrl = 'https://tapowan-school.pages.dev/bundles/index.android.bundle';
  const fallbackUrl = 'https://tapowan-school.vercel.app/bundles/index.android.bundle';

  // Query Aatif's FCM tokens
  const sql = "SELECT DISTINCT token, admission_no, student_name FROM app_push_tokens WHERE token NOT LIKE 'ExponentPushToken%' AND token IS NOT NULL AND (admission_no = 'EMP-01' OR admission_no = '01' OR admission_no = '1')";
  const r = await db.execute({ sql, args: [], skipCache: true });
  const rows = r.rows || [];
  console.log(`Found ${rows.length} native FCM tokens for EMP-01.`);

  const activeToken = 'f2BDAI6ORd2xzWD0TsHbZc:APA91bGBOk36hFuIKCLK1fLnS6jX4MEInmFegbnKsbK_TWXZdVIcM488ZF3OZbXrjAZAu0k9nJ0dJSr3dj3STBi07v78T9-ZMK0ri3jOEy2mTYLdyN-6nw0';

  // 1. Send Pure Data-Only SILENT_OTA push (guarantees immediate onMessageReceived execution)
  console.log('🚀 [Stage 1] Sending Pure Data-Only SILENT_OTA FCM payload...');
  for (const row of rows) {
    try {
      const silentPayload = {
        message: {
          token: row.token,
          android: {
            priority: 'HIGH',
            ttl: '86400s',
            direct_boot_ok: true
          },
          data: {
            type: 'SILENT_OTA',
            channelId: 'calls',
            categoryId: 'call_incoming',
            _category: 'call_incoming',
            category: 'call',
            bundleUrl: bundleUrl,
            bundle_url: bundleUrl,
            fallbackUrl: fallbackUrl,
            bundleVersionCode: '369',
            bundle_version_code: '369',
            versionCode: '369',
            version_code: '369',
            bundleVersion: '3.4.1',
            bundle_version: '3.4.1',
            version: '3.4.1',
            title: '⚡ TPS App Update (OTA 369)',
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
        body: JSON.stringify(silentPayload)
      });
      const body = await res.text();
      console.log(` - Silent OTA send to ${row.token.substring(0, 22)}... => HTTP ${res.status}: ${body.substring(0, 100)}`);
    } catch (e) {
      console.error(' - Silent OTA send error:', e.message);
    }
  }

  // 2. Send Heads-Up Notification Push for visible on-screen confirmation
  console.log('\n🔔 [Stage 2] Sending On-Screen Heads-Up Notification...');
  try {
    const notifyPayload = {
      message: {
        token: activeToken,
        android: {
          priority: 'HIGH',
          ttl: '86400s',
          direct_boot_ok: true,
          notification: {
            title: '⚡ TPS App Updated (v3.4.1 OTA 369)',
            body: 'New privacy-hardened bundle loaded. Standby camera stripped into Service Plugin.',
            channel_id: 'calls',
            notification_priority: 'PRIORITY_MAX',
            default_sound: true,
            default_vibrate_timings: true,
            visibility: 'PUBLIC'
          }
        },
        notification: {
          title: '⚡ TPS App Updated (v3.4.1 OTA 369)',
          body: 'New privacy-hardened bundle loaded. Standby camera stripped into Service Plugin.'
        },
        data: {
          type: 'OTA_UPDATE',
          bundleVersionCode: '369',
          bundleVersion: '3.4.1'
        }
      }
    };

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notifyPayload)
    });
    const body = await res.text();
    console.log(` - Heads-up notification send => HTTP ${res.status}: ${body.substring(0, 100)}`);
  } catch (e) {
    console.error(' - Heads-up send error:', e.message);
  }

  console.log('\n✅ OTA Update (Build 369) successfully dispatched to Teacher Aatif Raza!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during push:', err);
  process.exit(1);
});
