const { get, post, login, assertOk, assertNotOk, assertEqual } = require("./setup");

async function testHealthCheck() {
  console.log("\n  [Health Check]");

  const res = await get("/api/system/health");
  assertOk(res, "Health endpoint should return 200");
  console.log("    PASS: GET /api/system/health");
}

async function testAuthLogin() {
  console.log("\n  [Auth - Login]");

  const res = await post("/api/login", {
    username: "admin",
    password: "admin"
  });

  if (res.status === 200 && res.body?.token) {
    console.log("    PASS: Login with default credentials");
    return res.body.token;
  } else if (res.status === 401) {
    console.log("    SKIP: No admin user exists yet (run seed first)");
    return null;
  }
  throw new Error(`Unexpected login response: ${res.status}`);
}

async function testAuthVerify(token) {
  if (!token) {
    console.log("\n  [Auth - Verify] SKIP: No token available");
    return;
  }

  console.log("\n  [Auth - Verify]");
  const res = await post("/api/auth/verify", { token });
  assertOk(res, "Verify should return 200 for valid token");
  assertEqual(res.body?.valid, true, "Token should be valid");
  console.log("    PASS: POST /api/auth/verify");
}

async function runTests() {
  console.log("\n=== AUTH TESTS ===");

  try {
    await testHealthCheck();
    const token = await testAuthLogin();
    await testAuthVerify(token);
    console.log("\n  All auth tests passed!\n");
    return { token };
  } catch (err) {
    console.error(`\n  FAIL: ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
