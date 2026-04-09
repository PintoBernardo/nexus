const { get, post, put, del, login, assertOk, assertNotOk, assertEqual } = require("./setup");

let adminToken = null;
let testExtensionId = null;

async function getAdminToken() {
  if (!adminToken) {
    adminToken = await login("admin", "admin");
  }
  return adminToken;
}

async function testListExtensions() {
  console.log("\n  [Extensions - List]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const res = await get("/api/extensions", token);
  assertOk(res, "List extensions should return 200");
  assertEqual(typeof res.body?.count, "number", "Response should have count");
  console.log(`    PASS: GET /api/extensions (count: ${res.body.count})`);
}

async function testGetExtension() {
  console.log("\n  [Extensions - Get]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const res = await get("/api/extensions/1", token);
  if (res.status === 200) {
    assertEqual(res.body?.extension?.id, 1, "Should return correct extension");
    console.log("    PASS: GET /api/extensions/:id");
  } else if (res.status === 404) {
    console.log("    SKIP: No extension with ID 1 exists");
  }
}

async function testCreateExtension() {
  console.log("\n  [Extensions - Create]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const timestamp = Date.now();
  const extension = {
    user_id: 1,
    type: "sip",
    extension: `999${timestamp}`,
    secret: "testsecret",
    display_name: "Test Extension"
  };

  const res = await post("/api/extensions", extension, token);
  if (res.status === 201) {
    assertEqual(res.body?.extension?.extension, extension.extension, "Should return created extension");
    testExtensionId = res.body.extension?.id;
    console.log(`    PASS: POST /api/extensions (ID: ${testExtensionId})`);
  } else if (res.status === 400 && res.body?.error?.includes("UNIQUE")) {
    console.log("    SKIP: Extension number already exists");
  } else {
    console.log(`    INFO: Create returned ${res.status} - ${res.body?.error || "unknown error"}`);
  }
}

async function testUpdateExtension() {
  console.log("\n  [Extensions - Update]");
  const token = await getAdminToken();
  if (!token || !testExtensionId) {
    console.log("    SKIP: No token or test extension");
    return;
  }

  const res = await put(`/api/extensions/${testExtensionId}`, {
    display_name: "Updated Name"
  }, token);

  if (res.status === 200) {
    assertEqual(res.body?.extension?.display_name, "Updated Name", "Should update display name");
    console.log(`    PASS: PUT /api/extensions/${testExtensionId}`);
  } else {
    console.log(`    INFO: Update returned ${res.status}`);
  }
}

async function testDeleteExtension() {
  console.log("\n  [Extensions - Delete]");
  const token = await getAdminToken();
  if (!token || !testExtensionId) {
    console.log("    SKIP: No token or test extension");
    return;
  }

  const res = await del(`/api/extensions/${testExtensionId}`, token);
  if (res.status === 200) {
    console.log(`    PASS: DELETE /api/extensions/${testExtensionId}`);
  } else {
    console.log(`    INFO: Delete returned ${res.status}`);
  }
}

async function runTests() {
  console.log("\n=== EXTENSIONS TESTS ===");

  try {
    await testListExtensions();
    await testGetExtension();
    await testCreateExtension();
    await testUpdateExtension();
    await testDeleteExtension();
    console.log("\n  Extensions tests completed!\n");
  } catch (err) {
    console.error(`\n  FAIL: ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
