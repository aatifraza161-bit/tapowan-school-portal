const cp = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = process.env.VERCEL_TOKEN;
const scope = 'team_RIEJELsbTBWNRmUOxDnr4RpG';

if (!token) {
  console.error('ERROR: VERCEL_TOKEN environment variable is required.');
  process.exit(1);
}

console.log('Deploying Tapowan Public School to Vercel Production...');
cp.execSync(`npx vercel deploy --prod --yes --token ${token} --scope ${scope}`, { stdio: 'inherit' });
console.log('✅ Deployment Complete!');
