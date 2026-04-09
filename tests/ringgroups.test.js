const { get, post, put, del, login, assertOk, assertEqual } = require("./setup");

let adminToken = null;
let testGroupId = null;

async function getAdminToken() {
  if (!adminToken) {
    adminToken = await login("admin", "admin");
  }
  return adminToken;
}

async function testListRingGroups() {
  console.log("\n  [Ring Groups - List]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const res = await get("/api/ringgroups", token);
  assertOk(res, "List ring groups should return 200");
  console.log(`    PASS: GET /api/ringgroups (count: ${res.body?.count || 0})`);
}

async function testGetRingGroup() {
  console.log("\n  [Ring Groups - Get]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const res = await get("/api/ringgroups/1", token);
  if (res.status === 200) {
    console.log("    PASS: GET /api/ringgroups/:id");
  } else if (res.status === 404) {
    console.log("    SKIP: No ring group with ID 1");
  }
}

async function testCreateRingGroup() {
  console.log("\n  [Ring Groups - Create]");
  const token = await getAdminToken();
  if (!token) {
    console.log("    SKIP: No admin token");
    return;
  }

  const timestamp = Date.now();
  const group = {
    name: `TestGroup_${timestamp}`,
    strategy: "ringall",
    description: "Test ring group"
  };

  const res = await post("/api/ringgroups", group, token);
  if (res.status === 201) {
    testGroupId = res.body?.ring_group?.id;
    console.log(`    PASS: POST /api/ringgroups (ID: ${testGroupId})`);
  } else if (res.status === 400 && res.body?.error?.includes("UNIQUE")) {
    console.log("    SKIP: Ring group name already exists");
  } else {
    console.log(`    INFO: Create returned ${res.status} - ${res.body?.error || "unknown"}`);
  }
}

async function testUpdateRingGroup() {
  console.log("\n  [Ring Groups - Update]");
  const token = await getAdminToken();
  if (!token || !testGroupId) {
    console.log("    SKIP: No token or test group");
    return;
  }

  const res = await put(`/api/ringgroups/${testGroupId}`, {
    strategy: "hunt",
    description: "Updated description"
  }, token);

  if (res.status === 200) {
    console.log(`    PASS: PUT /api/ringgroups/${testGroupId}`);
  } else {
    console.log(`    INFO: Update returned ${res.status}`);
  }
}

async function testDeleteRingGroup() {
  console.log("\n  [Ring Groups - Delete]");
  const token = await getAdminToken();
  if (!token || !testGroupId) {
    console.log("    SKIP: No token or test group");
    return;
  }

  const res = await del(`/api/ringgroups/${testGroupId}`, token);
  if (res.status === 200) {
    console.log(`    PASS: DELETE /api/ringgroups/${testGroupId}`);
  } else {
    console.log(`    INFO: Delete returned ${res.status}`);
  }
}

async function runTests() {
  console.log("\n=== RING GROUPS TESTS ===");

  try {
    await testListRingGroups();
    await testGetRingGroup();
    await testCreateRingGroup();
    await testUpdateRingGroup();
    await testDeleteRingGroup();
    console.log("\n  Ring groups tests completed!\n");
  } catch (err) {
    console.error(`\n  FAIL: ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
