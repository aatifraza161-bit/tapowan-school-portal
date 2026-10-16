const { createClient } = require('@libsql/client/http');

const client = createClient({
  url: 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA'
});

async function publishUpdate() {
  console.log('Publishing v3.2.0 (Build 332) to app_updates...');
  await client.execute('UPDATE app_updates SET is_active = 0');
  
  const notes = '⚡ Official TPS Build v3.2.0: Biometric Fingerprint Attendance with Phone Biometric Sensor & Mantra MFS100 / Morpho USB Optical Scanner RD Service integration, automated roster advancement, and live quality scoring.';

  const res = await client.execute({
    sql: `INSERT INTO app_updates (version, version_code, apk_url, title, release_notes, is_force_update, is_active, target_audience, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      '3.2.0',
      332,
      'https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk',
      '⚡ TPS App Update v3.2.0',
      notes,
      1,
      1,
      'all',
      new Date().toISOString()
    ]
  });

  console.log('✅ Inserted into app_updates:', res);

  const active = await client.execute('SELECT * FROM app_updates WHERE is_active = 1 ORDER BY version_code DESC LIMIT 1');
  console.log('Active update in Turso:', JSON.stringify(active.rows, null, 2));
}

publishUpdate().catch(err => {
  console.error('Publish error:', err);
  process.exit(1);
});
