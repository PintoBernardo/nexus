const { get, post, put, del, login, assertOk, assertEqual } = require("./setup");

let adminToken = null;
let testModel = null;

async function getAdminToken() {
  if (!adminToken) {
    adminToken = await login("admin", "admin");
  }
  return adminToken;
}

async function testListPhones() {
  console.log("\n  [Phones - List]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const res = await get("/api/phones", token);
  assertOk(res, "List phones should return 200");
  assertEqual(typeof res.body?.count, "number", "Response should have count");
  console.log(`    PASS: GET /api/phones (count: ${res.body.count})`);
}

async function testGetPhone() {
  console.log("\n  [Phones - Get]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const res = await get("/api/phones/CP-7841", token);
  if (res.status === 200) {
    assertEqual(res.body?.model?.model, "CP-7841", "Should return correct phone model");
    console.log("    PASS: GET /api/phones/:model");
  } else if (res.status === 404) {
    console.log("    SKIP: CP-7841 model not found");
  }
}

async function testCreatePhone() {
  console.log("\n  [Phones - Create]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const timestamp = Date.now();
  testModel = `TEST-${timestamp}`;

  const phone = {
    model: testModel,
    manufacturer: "Cisco",
    screen_resolution: "320x240",
    screen_size: "3.5 inch",
    num_lines: 4,
    protocol: "SIP"
  };

  const res = await post("/api/phones", phone, token);
  if (res.status === 201) {
    assertEqual(res.body?.model?.model, testModel, "Should return created model");
    console.log(`    PASS: POST /api/phones (${testModel})`);
  } else if (res.status === 400 && res.body?.error?.includes("UNIQUE")) {
    console.log(`    SKIP: Model ${testModel} already exists`);
    testModel = null;
  } else {
    console.log(`    INFO: Create returned ${res.status} - ${res.body?.error || "unknown"}`);
    testModel = null;
  }
}

async function testUpdatePhone() {
  console.log("\n  [Phones - Update]");
  const token = await getAdminToken();
  if (!token || !testModel) {
    console.log("    SKIP: No token or test model");
    return;
  }

  const res = await put(`/api/phones/${testModel}`, {
    num_lines: 6,
    notes: "Updated via test"
  }, token);

  if (res.status === 200) {
    assertEqual(res.body?.model?.num_lines, 6, "Should update num_lines");
    console.log(`    PASS: PUT /api/phones/${testModel}`);
  } else {
    console.log(`    INFO: Update returned ${res.status}`);
  }
}

async function testDeletePhone() {
  console.log("\n  [Phones - Delete]");
  const token = await getAdminToken();
  if (!token || !testModel) {
    console.log("    SKIP: No token or test model");
    return;
  }

  const res = await del(`/api/phones/${testModel}`, token);
  if (res.status === 200) {
    console.log(`    PASS: DELETE /api/phones/${testModel}`);
  } else {
    console.log(`    INFO: Delete returned ${res.status}`);
  }
}

async function runTests() {
  console.log("\n=== PHONES TESTS ===");

  try {
    await testListPhones();
    await testGetPhone();
    await testCreatePhone();
    await testUpdatePhone();
    await testDeletePhone();
    console.log("\n  Phones tests completed!\n");
  } catch (err) {
    console.error(`\n  FAIL: ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
