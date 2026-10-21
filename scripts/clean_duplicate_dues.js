const { createClient } = require("@libsql/client/http");
require("dotenv").config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\//i, "https://"),
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  console.log("=== STARTING DUE MANAGEMENT CLEANUP & NORMALIZATION ===");

  // 1. Check current status
  const beforeRes = await client.execute("SELECT id, admissionno, particulars, month, balance, status FROM dueManagement");
  const beforeRows = beforeRes.rows;
  let beforeBal = 0;
  const beforeStatusMap = {};
  for (const r of beforeRows) {
    beforeBal += (parseFloat(r.balance) || 0);
    const s = r.status || "NULL";
    beforeStatusMap[s] = (beforeStatusMap[s] || 0) + 1;
  }
  console.log(`Before: ${beforeRows.length} total rows, ₹${beforeBal.toFixed(2)} total balance.`);
  console.log("Before statuses:", beforeStatusMap);

  // 2. Identify the 63 extra duplicates
  const groups = new Map();
  for (const r of beforeRows) {
    const key = [
      (r.admissionno || "").toString().trim().toLowerCase(),
      (r.particulars || "").toString().trim().toLowerCase(),
      (r.month || "").toString().trim().toLowerCase()
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const extraIds = [];
  let phantomBal = 0;
  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      list.sort((a, b) => Number(a.id) - Number(b.id));
      for (let i = 1; i < list.length; i++) {
        extraIds.push(list[i].id);
        phantomBal += (parseFloat(list[i].balance) || 0);
      }
    }
  }

  console.log(`Identified ${extraIds.length} extra duplicate records (Phantom Balance: ₹${phantomBal.toFixed(2)})`);
  if (extraIds.length !== 63) {
    throw new Error(`Expected exactly 63 extra records, found ${extraIds.length}! Aborting.`);
  }

  // 3. Batch delete the 63 extra records
  console.log("Executing deletion of 63 extra duplicate due records...");
  const deleteBatch = extraIds.map(id => ({
    sql: "DELETE FROM dueManagement WHERE id = ?",
    args: [id]
  }));
  await client.batch(deleteBatch, "write");
  console.log("Deletion completed successfully.");

  // 4. Normalize status from 'Unpaid' -> 'Pending'
  console.log("Normalizing due status from 'Unpaid' to 'Pending'...");
  const updateRes = await client.execute(
    "UPDATE dueManagement SET status = 'Pending' WHERE LOWER(TRIM(status)) IN ('unpaid', 'due')"
  );
  console.log(`Updated ${updateRes.rowsAffected} rows to 'Pending'.`);

  // 5. Verify final counts & balance
  const afterRes = await client.execute("SELECT id, balance, status FROM dueManagement");
  const afterRows = afterRes.rows;
  let afterBal = 0;
  const afterStatusMap = {};
  for (const r of afterRows) {
    afterBal += (parseFloat(r.balance) || 0);
    const s = r.status || "NULL";
    afterStatusMap[s] = (afterStatusMap[s] || 0) + 1;
  }

  console.log("\n=== VERIFICATION RESULTS ===");
  console.log(`After Total Rows: ${afterRows.length} (Expected: ${beforeRows.length - 63} = 4040)`);
  console.log(`After Total Balance: ₹${afterBal.toFixed(2)} (Expected: ₹12,92,361.00)`);
  console.log("After statuses:", afterStatusMap);

  if (Math.round(afterBal) === 1292361 && afterRows.length === 4040) {
    console.log("SUCCESS! Exact match with expected figures.");
  } else {
    console.warn("WARNING: Balance or count differs from expected.");
  }
}

main().catch(err => {
  console.error("FATAL ERROR during cleanup:", err);
  process.exit(1);
});
