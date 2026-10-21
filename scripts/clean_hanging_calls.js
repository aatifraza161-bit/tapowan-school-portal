require('dotenv').config();
const { db } = require('../server/db-sqlite');
async function clean() {
  const r1 = await db.execute("UPDATE app_voice_calls SET status = 'ended', updated_at = CURRENT_TIMESTAMP WHERE status IN ('ringing', 'connected') AND caller_role = 'automated_fee_ivr'");
  const r2 = await db.execute("UPDATE app_ivr_call_logs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE status IN ('ringing', 'connected')");
  console.log('Cleaned voice calls:', r1);
  console.log('Cleaned ivr logs:', r2);
}
clean();
