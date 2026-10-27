const { createClient } = require('@libsql/client/http');

const db = createClient({
  url: 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA'
});

async function main() {
  console.log("Checking and migrating columns in students and admissions...");

  const colsToAdd = [
    { name: 'vehicleType', type: 'TEXT' },
    { name: 'transportRoute', type: 'TEXT' },
    { name: 'pickupPoint', type: 'TEXT' }
  ];

  const s = await db.execute('PRAGMA table_info(students)');
  const sNames = s.rows.map(r => r.name.toLowerCase());
  for (const col of colsToAdd) {
    if (!sNames.includes(col.name.toLowerCase())) {
      console.log(`Adding ${col.name} to students...`);
      await db.execute(`ALTER TABLE students ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added ${col.name} to students.`);
    } else {
      console.log(`students already has ${col.name}.`);
    }
  }

  const a = await db.execute('PRAGMA table_info(admissions)');
  const aNames = a.rows.map(r => r.name.toLowerCase());
  for (const col of colsToAdd) {
    if (!aNames.includes(col.name.toLowerCase())) {
      console.log(`Adding ${col.name} to admissions...`);
      await db.execute(`ALTER TABLE admissions ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added ${col.name} to admissions.`);
    } else {
      console.log(`admissions already has ${col.name}.`);
    }
  }

  console.log("Migration complete!");
}

main().catch(console.error);
