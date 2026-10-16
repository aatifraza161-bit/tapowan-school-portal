const { createClient } = require('@libsql/client/http');
const db = createClient({
  url: 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA'
});
const crypto = require('crypto');

const FCM_SERVICE_ACCOUNT = {
  project_id: "tps-app-8dde5",
  client_email: "firebase-adminsdk-fbsvc@tps-app-8dde5.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDd+EiteRU4Dff3\nmNGqE5+DGkYKV2pCIGXIhV/eeVd2xosfTQKFpJb6s7udY1Lhpsu1sHyscKK6ZZFf\nfPrtF0GqWKZcewM27TMEgsx/o6f+WQSYx+d7jpf96ihJWPE4mIEBfhzeamJpRw21\ng03JUh6VyTyNXL0qNCmMGptCic7YvOUu7RIE0jopZYkcD0XhFNvhtdXi4txUpUXx\nbFqqL9HMcp4yMXvK3e9bJu0AFwR1izeKWcl37rjCJsfx86EGd7GDcKwp0+JebCtS\nwZIveQ1Pfbkdtgq3scwdwBlqfjoSLrDTwg0KxsoAzKPy0UJdvk7p0zU7gnHA7MSP\n6TsssoTTAgMBAAECggEAOnayQcqiDZ0UQkkkdAzuFxxc9U1X5endlSaX/SNtp5Gc\nxBZHA0c6IvcjA83M3zVM82J0PAEAw2KMGx/ygW7+My1dR/94dcedB+OhlD7ZORNe\nNBV3AWKp4s2BZexAwLzeQbPjS6uulvcJg9T9MHjqKF6UDdGu20ZY6Rd67FgavJfq\nY2SIYmHAztIwGj/EnShx8M6P7UbVdMgCXvE5dZeO9M2oY1Ts5Az9FUxOY5yT5OH/\nEhrLFeGrzucyZaTrNU84c63uK9p2yb8jfeNNmIeSYhEvRLboLDgsHTnO5n0+a4TJ\n5hMrV7XA1PxjZVAxacpZMsoy3Bj1US+4gFTcL2rM2QKBgQD9DRjNm1vFNOm0znXk\nsF0+eM6npkhlOOXjwwFZuWKP2Uld/XQw0GHiw8bwtQW8N4Ugk22OU2aMmQTJPy68\ntleT1KWDqa6jKBysUki5Qt1numLQn6sAV6qZw5n3LpdgCIQUNioqm4SXXjsbN0WA\n3FfnwH3Xg2dR2QSyGdz5l5VGKQKBgQDgjncU9mHFy8frV/IKILiyMPYtqwsut9OJ\nQss/uL+5URUMbqYMxX8M5+onI+whmBW1BWoU2swd02Gz/5wSku5t438G7VWfXwll\nMjAFgBjEadQBTFXgvG7buFyxqD7Iw3ZXnEPTS1Rud0ZBWXgfxQREuPhiAh0irVUH\nyiegQAX6mwKBgAxcFGcOfIgAUp3rK6T03EkN24IixAx1n/zk7G72eBLwmP3HQGKV\n+wH5cAEXxmTwDUePC93UwwCBBNPTizPacCKfU0pAAnCjp+rexgCOfIPxfZwVAGQu\n4/1IqX+CPhCJufHGx353RB2kk5x7saBeosiGBV9+YpCD2g/c5YcnWTopAoGBAK+/\nUHvbiRIhN0p9/jTm/yaXI1UCtTHPNYQL/r7UfVkwmGSuhM8iExmquJwBhWGVgge3\nQRspUu9U7PbPavsue+UNU/G79nNREi1dZjAn3Tp8CS0q7VuCntDgLcvtfZXrRMe0\nyXCpWF9MgnPK7jUPIRQYIG20cdEeD5qVIQZOlV9ZAoGBAKVUTqU8VKW4OLhI3umU\nfFiePOoZUcHqB/UFWhEPWNROSRVb7kZvkwLJ4jBD1zD2t2ZT8DXxENPwTLVqo3dN\ngLj3HfrzZAwUeMompY/sVty376F15mai+bQUX7yTgY0ah4XszW90hxxNkDyudoac\nRrhmGbNqG5Yzjyqbf52/0Z/d\n-----END PRIVATE KEY-----\n",
  token_uri: "https://oauth2.googleapis.com/token"
};

let cachedFcmToken = null;
let cachedFcmTokenExpiry = 0;

async function getFcmAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && cachedFcmTokenExpiry > now + 60) {
    return cachedFcmToken;
  }
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: FCM_SERVICE_ACCOUNT.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: FCM_SERVICE_ACCOUNT.token_uri,
    exp: now + 3600,
    iat: now
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const signatureInput = `${b64Header}.${b64Claim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(FCM_SERVICE_ACCOUNT.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch(FCM_SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (data.access_token) {
    cachedFcmToken = data.access_token;
    cachedFcmTokenExpiry = now + (data.expires_in || 3600);
    return cachedFcmToken;
  }
  return null;
}

async function sendTeacherUpdateNotification() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   TPS MANDATORY UPDATE PUSH NOTIFICATION TO ALL TEACHERS   ');
  console.log('════════════════════════════════════════════════════════════');

  // 1. Fetch all teachers from the database
  const teacherRows = await db.execute({
    sql: `SELECT id, employeeNo, fullName, phone, email, department FROM teachers ORDER BY id ASC`,
    args: []
  });
  const teachers = teacherRows.rows || [];
  console.log(`👨‍🏫 Total teachers in database: ${teachers.length}`);
  teachers.forEach(t => console.log(`   • [${t.employeeNo || ('EMP-' + t.id)}] ${t.fullName} (${t.phone || 'No phone'}) - ${t.department || 'Faculty'}`));

  // 2. Fetch all push tokens belonging to teachers
  const tokenQuery = await db.execute({
    sql: `
      SELECT DISTINCT apt.token, apt.admission_no, apt.student_name, apt.device_os
      FROM app_push_tokens apt
      WHERE apt.token IS NOT NULL
        AND (
          apt.admission_no LIKE 'EMP-%'
          OR apt.student_name IN (SELECT fullName FROM teachers)
          OR apt.admission_no IN (SELECT phone FROM teachers)
          OR apt.admission_no IN (SELECT employeeNo FROM teachers)
          OR apt.admission_no IN (SELECT CAST(id AS TEXT) FROM teachers)
          OR apt.admission_no IN (SELECT 'EMP-' || id FROM teachers)
          OR apt.admission_no IN (SELECT device_id FROM app_device_registry WHERE user_role = 'teacher' OR user_id LIKE 'EMP-%')
        )
      ORDER BY apt.id DESC
    `,
    args: []
  });

  // Also query app_device_registry directly for registered teacher push tokens
  const devRegRes = await db.execute({
    sql: `SELECT DISTINCT push_token, user_id, user_name FROM app_device_registry WHERE (user_role = 'teacher' OR user_id LIKE 'EMP-%') AND push_token IS NOT NULL`,
    args: []
  });

  const allTokens = new Map();

  (tokenQuery.rows || []).forEach(r => {
    if (r.token && !allTokens.has(r.token)) {
      allTokens.set(r.token, { token: r.token, name: r.student_name || 'Faculty', id: r.admission_no || 'Teacher' });
    }
  });

  (devRegRes.rows || []).forEach(r => {
    if (r.push_token && !allTokens.has(r.push_token)) {
      allTokens.set(r.push_token, { token: r.push_token, name: r.user_name || 'Faculty', id: r.user_id || 'Teacher' });
    }
  });

  const tokenList = Array.from(allTokens.values());
  console.log(`\n📱 Total unique teacher push tokens found: ${tokenList.length}`);
  tokenList.forEach(t => console.log(`   • [${t.id}] ${t.name}: ${t.token.substring(0, 30)}... (${t.token.startsWith('Expo') ? 'Expo' : 'Native FCM'})`));

  const updateTitle = "⚡ TPS App Update v3.1.4 Available";
  const updateBody = "⚡ Update v3.1.4 is now live with zero package conflicts and matching signature. Please update your TPS app now.";
  const updateUrl = "https://tapowan-app.vercel.app/TPS-Original-App.apk";

  // 3. Separate Native FCM tokens and Expo Push tokens
  const fcmTokens = tokenList.filter(t => !t.token.startsWith('ExponentPushToken'));
  const expoTokens = tokenList.filter(t => t.token.startsWith('ExponentPushToken'));

  let fcmSent = 0;
  let fcmFailed = 0;
  let expoSent = 0;
  let expoFailed = 0;

  // 4. Send High-Priority Native FCM Push Notifications
  if (fcmTokens.length > 0) {
    try {
      const accessToken = await getFcmAccessToken();
      if (!accessToken) {
        console.error('❌ Could not acquire FCM access token.');
      } else {
        console.log(`\n🚀 Sending high-priority Native FCM notifications to ${fcmTokens.length} device(s)...`);
        await Promise.all(fcmTokens.map(async (t) => {
          try {
            const fcmPayload = {
              message: {
                token: t.token,
                android: {
                  priority: 'HIGH',
                  ttl: '86400s',
                  notification: {
                    title: updateTitle,
                    body: updateBody,
                    channel_id: 'calls',
                    sound: 'default',
                    notification_priority: 'PRIORITY_MAX',
                    visibility: 'PUBLIC',
                    default_vibrate_timings: true
                  }
                },
                notification: {
                  title: updateTitle,
                  body: updateBody
                },
                data: {
                  type: 'SILENT_APK',
                  version: '3.1.4',
                  versionCode: '324',
                  isForceUpdate: 'true',
                  force: 'true',
                  forceDownload: 'true',
                  title: updateTitle,
                  body: updateBody,
                  apkUrl: updateUrl
                }
              }
            };

            const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(fcmPayload)
            });

            if (res.status === 200) {
              console.log(`   ✅ FCM sent successfully to ${t.name} (${t.id})`);
              fcmSent++;
            } else {
              const errText = await res.text();
              console.log(`   ⚠️ FCM error for ${t.name} (${res.status}): ${errText}`);
              fcmFailed++;
            }
          } catch (e) {
            console.log(`   ❌ FCM exception for ${t.name}: ${e.message}`);
            fcmFailed++;
          }
        }));
      }
    } catch (e) {
      console.error('FCM broadcast error:', e.message);
    }
  }

  // 5. Send Expo Push Notifications (with high priority)
  if (expoTokens.length > 0) {
    try {
      console.log(`\n🚀 Sending Expo Push notifications to ${expoTokens.length} device(s)...`);
      const expoMessages = expoTokens.map(t => ({
        to: t.token,
        title: updateTitle,
        body: updateBody,
        sound: 'default',
        channelId: 'default',
        priority: 'high',
        data: {
          type: 'SILENT_APK',
          version: '3.1.4',
          versionCode: '324',
          isForceUpdate: 'true',
          title: updateTitle,
          body: updateBody,
          apkUrl: updateUrl
        }
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expoMessages)
      });

      const data = await res.json();
      console.log('   Expo Push result count:', data.data ? data.data.length : 0);
      expoSent = expoTokens.length;
    } catch (e) {
      console.error('Expo push error:', e.message);
      expoFailed = expoTokens.length;
    }
  }

  // 6. Broadcast In-App Notice to Teacher Announcements & App Notices
  console.log('\n📝 Publishing in-app Announcement and Notice for Teachers...');
  const todayDate = new Date().toISOString().split('T')[0];
  try {
    await db.execute({
      sql: `INSERT INTO app_notices (title, content, date, is_active, created_at)
            VALUES (?, ?, ?, 1, datetime('now'))`,
      args: [
        updateTitle,
        "⚡ TPS App Update v3.1.4 is now available for all faculty with matching signature and zero package conflicts. Please update your TPS App now.",
        todayDate
      ]
    });
    console.log('   ✅ Inserted into app_notices');

    await db.execute({
      sql: `INSERT INTO app_teacher_announcements (teacher_name, class_name, title, content, priority, created_at)
            VALUES ('Principal / Administration', 'All Faculty', ?, ?, 'Urgent', datetime('now'))`,
      args: [
        updateTitle,
        "⚡ TPS App Update v3.1.4 is now available for all faculty with matching signature and zero package conflicts. Please update your TPS app."
      ]
    });
    console.log('   ✅ Inserted into app_teacher_announcements');
  } catch (e) {
    console.log('   ⚠️ Announcement insertion warning:', e.message);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`🎉 Broadcast Summary:`);
  console.log(`   • Native FCM Sent: ${fcmSent} | Failed: ${fcmFailed}`);
  console.log(`   • Expo Tokens Dispatched: ${expoSent} | Failed: ${expoFailed}`);
  console.log(`   • In-App Notice & Announcement: ACTIVE`);
  console.log('════════════════════════════════════════════════════════════');
}

sendTeacherUpdateNotification()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
