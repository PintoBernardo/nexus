const { runTests: authTests } = require("./auth.test");
const { runTests: extensionsTests } = require("./extensions.test");
const { runTests: phonesTests } = require("./phones.test");
const { runTests: ringgroupsTests } = require("./ringgroups.test");
const { runTests: healthTests } = require("./health.test");

async function runAllTests() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║       NEXUS API TEST SUITE             ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("\nMake sure the API is running on http://localhost:8000");
  console.log("Run 'npm run seed' first to create admin user if needed.\n");

  try {
    await healthTests();
    await authTests();
    await extensionsTests();
    await phonesTests();
    await ringgroupsTests();

    console.log("╔════════════════════════════════════════╗");
    console.log("║  ALL TESTS COMPLETED SUCCESSFULLY     ║");
    console.log("╚════════════════════════════════════════╝\n");
    process.exit(0);
  } catch (err) {
    console.error(`\nTest suite failed: ${err.message}\n`);
    process.exit(1);
  }
}

runAllTests();
