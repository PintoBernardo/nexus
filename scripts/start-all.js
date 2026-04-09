/**
 * scripts/start-all.js
 * --------------------
 * Starts both the Nexus API server and the Phone Services server
 * in the same process. Both servers run concurrently.
 *
 * Run: npm run start:all
 */

const { fork } = require("child_process");
const path = require("path");

console.log("=========================================");
console.log("  Nexus Unified Communications");
console.log("  Starting API + Phone Services...");
console.log("=========================================");
console.log("");

// Start the API server
const apiPath = path.join(__dirname, "..", "api", "src", "app.js");
const apiProcess = fork(apiPath, { stdio: "inherit" });

apiProcess.on("error", (err) => {
  console.error("[start-all] API process error:", err.message);
  shutdown();
});

apiProcess.on("exit", (code) => {
  console.log(`[start-all] API process exited with code ${code}`);
  shutdown();
});

// Start the Phone Services server
const servicesPath = path.join(__dirname, "..", "services", "index.js");
const servicesProcess = fork(servicesPath, { stdio: "inherit" });

servicesProcess.on("error", (err) => {
  console.error("[start-all] Services process error:", err.message);
  shutdown();
});

servicesProcess.on("exit", (code) => {
  console.log(`[start-all] Services process exited with code ${code}`);
  shutdown();
});

// Graceful shutdown — kill both processes on Ctrl+C
function shutdown() {
  if (apiProcess) apiProcess.kill();
  if (servicesProcess) servicesProcess.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
