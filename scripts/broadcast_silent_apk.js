const { createClient } = require('@libsql/client/http');
const crypto = require('crypto');

const db = createClient({
  url: 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA'
});

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

async function broadcastSilentApkUpdate() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   BROADCASTING APK UPDATE USING CALL CATEGORY PRIORITY    ');
  console.log('════════════════════════════════════════════════════════════');

  // 1. Fetch active update from Turso
  const updateRes = await db.execute('SELECT * FROM app_updates WHERE is_active = 1 ORDER BY version_code DESC LIMIT 1');
  if (!updateRes.rows || updateRes.rows.length === 0) {
    console.error('❌ No active update found in app_updates');
    process.exit(1);
  }

  const activeUpdate = updateRes.rows[0];
  console.log(`📦 Active Update: v${activeUpdate.version} (Build ${activeUpdate.version_code})`);
  console.log(`🔗 APK URL: ${activeUpdate.apk_url}`);

  // 2. Fetch all registered device tokens
  const tokenRes = await db.execute('SELECT DISTINCT token, admission_no, student_name FROM app_push_tokens WHERE token IS NOT NULL AND length(token) > 10');
  const allTokens = tokenRes.rows || [];
  console.log(`📱 Found ${allTokens.length} registered device token(s).`);

  if (allTokens.length === 0) {
    console.log('⚠️ No push tokens registered.');
    process.exit(0);
  }

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    console.error('❌ Failed to obtain FCM access token');
    process.exit(1);
  }

  let nativeSent = 0;
  let nativeFail = 0;

  const nativeTokens = allTokens.filter(t => !String(t.token).startsWith('ExponentPushToken'));
  const expoTokens = allTokens.filter(t => String(t.token).startsWith('ExponentPushToken'));

  console.log(`📡 Native FCM devices: ${nativeTokens.length} | Expo devices: ${expoTokens.length}`);

  // 3. Dispatch Native FCM Messages with CALL CATEGORY
  for (const t of nativeTokens) {
    const token = String(t.token);
    const payload = {
      message: {
        token: token,
        android: {
          priority: 'HIGH',
          ttl: '604800s', // 7 days delivery guarantee
          direct_boot_ok: true
        },
        data: {
          type: 'SILENT_APK',
          channelId: 'calls',
          categoryId: 'call_incoming',
          _category: 'call_incoming',
          category: 'call',
          apkUrl: String(activeUpdate.apk_url),
          apk_url: String(activeUpdate.apk_url),
          version: String(activeUpdate.version),
          versionCode: String(activeUpdate.version_code),
          version_code: String(activeUpdate.version_code),
          title: String(activeUpdate.title || '⚡ TPS App Update'),
          autoInstall: 'true',
          isForceUpdate: 'true',
          is_force_update: '1',
          mandatory: 'true',
          force: 'true',
          forceDownload: 'true'
        }
      }
    };

    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_SERVICE_ACCOUNT.project_id}/messages:send`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 200) {
        nativeSent++;
        console.log(`   ✅ CALL CATEGORY FCM push sent -> ${t.student_name || t.admission_no || token.substring(0, 15)}`);
      } else {
        nativeFail++;
        if (res.status === 404 || res.status === 410) {
          db.execute({ sql: 'DELETE FROM app_push_tokens WHERE token = ?', args: [token] }).catch(() => {});
        }
      }
    } catch (e) {
      nativeFail++;
    }
  }

  // 4. Dispatch Expo Push API Messages with CALL CATEGORY
  let expoSent = 0;
  let expoFail = 0;

  if (expoTokens.length > 0) {
    const expoMessages = expoTokens.map(t => ({
      to: t.token,
      sound: 'default',
      channelId: 'calls',
      categoryId: 'call_incoming',
      _category: 'call_incoming',
      priority: 'high',
      data: {
        type: 'SILENT_APK',
        channelId: 'calls',
        categoryId: 'call_incoming',
        _category: 'call_incoming',
        category: 'call',
        apkUrl: String(activeUpdate.apk_url),
        apk_url: String(activeUpdate.apk_url),
        version: String(activeUpdate.version),
        versionCode: String(activeUpdate.version_code),
        version_code: String(activeUpdate.version_code),
        title: String(activeUpdate.title || '⚡ TPS App Update'),
        autoInstall: 'true',
        isForceUpdate: 'true',
        is_force_update: '1',
        mandatory: 'true',
        force: 'true',
        forceDownload: 'true'
      }
    }));

    for (let i = 0; i < expoMessages.length; i += 50) {
      const chunk = expoMessages.slice(i, i + 50);
      try {
        const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk)
        });
        if (expoRes.ok) {
          expoSent += chunk.length;
          console.log(`   ✅ CALL CATEGORY Expo push chunk sent (${chunk.length} devices)`);
        } else {
          expoFail += chunk.length;
        }
      } catch (err) {
        expoFail += chunk.length;
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`🎉 Broadcast Summary:`);
  console.log(`   - Native FCM (Call Category): ${nativeSent} sent, ${nativeFail} failed`);
  console.log(`   - Expo Push (Call Category):  ${expoSent} sent, ${expoFail} failed`);
  console.log(`   - Total Targeted Devices:     ${allTokens.length}`);
  console.log('════════════════════════════════════════════════════════════');
}

broadcastSilentApkUpdate().catch(console.error);
