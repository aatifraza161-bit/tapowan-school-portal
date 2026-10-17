require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { broadcastSilentApkPush } = require("../server/calls");

async function run() {
  console.log("------------------------------------------------------------");
  console.log("   TPS HIGH-PRIORITY SILENT FULL APK PUSH DISPATCHER");
  console.log("------------------------------------------------------------");
  const target = process.argv[2] || null;
  console.log("?? APK Version:        v3.2.6 (Code 343)");
  console.log("?? APK URL:            https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk");
  console.log(`?? Target:             ${target ? `Specific Account: ${target}` : "ALL Devices"}`);
  console.log("------------------------------------------------------------\n");

  try {
    const result = await broadcastSilentApkPush({
      apkUrl: "https://github.com/aatifraza161-bit/tapowan-school-portal/releases/latest/download/TPS-Original-App.apk",
      versionCode: "343",
      version: "3.2.6",
      targetAdmissionNo: target
    });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error running broadcastSilentApkPush:", err);
  }
}

run();
