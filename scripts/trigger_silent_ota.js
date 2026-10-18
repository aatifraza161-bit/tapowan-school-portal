const https = require('https');

const payload = JSON.stringify({
  bundleUrl: 'https://tapowan-school.vercel.app/bundles/index.android.bundle',
  bundleVersionCode: '353',
  bundleVersion: '3.3.4',
  force: 'true',
  forceDownload: 'true'
});

const options = {
  hostname: 'tapowan-school.vercel.app',
  port: 443,
  path: '/api/admin/ota/broadcast-push',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('Sending silent OTA broadcast push to devices...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      console.log('Response:', JSON.stringify(JSON.parse(body), null, 2));
    } catch (e) {
      console.log('Raw Response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(payload);
req.end();
