const { createClient } = require("@libsql/client/http");
require("dotenv").config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\//i, "https://"),
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  const ids = [333, 334, 335, 336, 338, 346];
  console.log("Merging 6 identical duplicate receipts:", ids);
  for (const id of ids) {
    await client.execute({
      sql: "UPDATE fees SET status = 'Merged', balance = '0' WHERE id = ?",
      args: [id]
    });
  }
  const check = await client.execute("SELECT id, admissionno, studentname, month, paidamount, status FROM fees WHERE id IN (330, 333, 334, 335, 336, 337, 338, 345, 346)");
  console.log("Verification of merged rows:");
  console.log(check.rows);
}

main().catch(console.error);
