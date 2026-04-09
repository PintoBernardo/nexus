const { get, assertOk, assertEqual } = require("./setup");

async function testHealthEndpoint() {
  console.log("\n  [Health Endpoint]");

  const res = await get("/api/health");
  assertOk(res, "Health endpoint should return 200");
  assertEqual(res.body?.status, "online", "Health status should be online");
  console.log("    PASS: GET /api/health");
}

async function testRootEndpoint() {
  console.log("\n  [Root Endpoint]");

  const res = await get("/");
  assertOk(res, "Root should return 200");
  console.log("    PASS: GET /");
}

async function test404Handler() {
  console.log("\n  [404 Handler]");

  const res = await get("/api/nonexistent");
  assertEqual(res.status, 404, "Nonexistent route should return 404");
  console.log("    PASS: Nonexistent route returns 404");
}

async function runTests() {
  console.log("\n=== HEALTH & SYSTEM TESTS ===");

  try {
    await testHealthEndpoint();
    await testRootEndpoint();
    await test404Handler();
    console.log("\n  All health tests passed!\n");
  } catch (err) {
    console.error(`\n  FAIL: ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
