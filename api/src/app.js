/**
 * app.js
 * ------
 * Nexus Unified Communications — Express backend entry point.
 */

const express = require("express");
const path = require("path");
const readline = require("readline");
const cfg = require("./config/configStore");
const db = require("./config/db");
const { requiresPerm } = require("./middleware/auth");
const syncService = require("./services/sync");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(require("./middleware/logger"));

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "Hello World, this is Nexus." });
});

// ─── Public Routes ───────────────────────────────────────────────────────────

// Health check — /api/health
const healthRouter = require("./routers/system/health");
app.use("/api", healthRouter);

// Auth — login at /api/login, verify at /api/auth/verify
const authRouter = require("./routers/auth/index");
app.use("/api/auth", authRouter);

// Login shortcut at /api/login
const auth = require("./services/auth");
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }
  try {
    const result = await auth.login(username, password);
    res.json({ ok: true, token: result.token, profile: result.profile });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// ─── Authenticated - Any User ────────────────────────────────────────────────
const meRouter = require("./routers/me/index");
app.use("/api/me", meRouter);

// ─── Protected Routes ────────────────────────────────────────────────────────

// Services status — GET requires services:read, PUT requires services:write
const servicesStatusRouter = require("./routers/services/status");
app.use("/api/services/status", requiresPerm("services:read"), servicesStatusRouter);

// Directory Service — PIN-based auth (no JWT)
const servicesDirRouter = require("./routers/services/directory");
app.use("/api/services/directory", servicesDirRouter);

// Extensions
const extensionsRouter = require("./routers/extensions/index");
app.use("/api/extensions", requiresPerm("extensions:read"), extensionsRouter);

// Devices
const devicesRouter = require("./routers/devices/index");
app.use("/api/devices", requiresPerm("devices:read"), devicesRouter);

// Phones
const phonesRouter = require("./routers/phones/index");
app.use("/api/phones", requiresPerm("devices:read"), phonesRouter);

// Ring Groups
const ringgroupsRouter = require("./routers/ringgroups/index");
app.use("/api/ringgroups", requiresPerm("ringgroups:read"), ringgroupsRouter);

// FreePBX
const freepbxRouter = require("./routers/freepbx/index");
app.use("/api/freepbx", requiresPerm("freepbx:read"), freepbxRouter);

// AMI
const amiRouter = require("./routers/ami/index");
app.use("/api/ami", requiresPerm("ami:read"), amiRouter);

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// Admin - System (notifications)
const notifyRouter = require("./routers/notify/index");
app.use("/api/admin/system/notifications", notifyRouter);

// Admin - System (config)
const configRouter = require("./routers/config/index");
app.use("/api/admin/system/config", configRouter);

// Admin - System (database)
const dbRouter = require("./routers/db/index");
app.use("/api/admin/system/database", dbRouter);

// Admin - Auth & Users (users, roles, sessions)
const adminAuthRouter = require("./routers/admin/auth");
app.use("/api/admin/auth", adminAuthRouter);

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (res.headersSent) return;
  console.error(`[error] ${err.stack}`);
  res.status(err.status || 500).json({ error: "Internal server error", message: err.message });
});

async function promptInitialSync() {
  const freepbxEnabled = cfg.getBool("freepbx.enabled");
  if (!freepbxEnabled) {
    syncService.startPeriodicSync();
    return;
  }

  const promptOnStartup = cfg.getBool("sync.prompt_on_startup");
  const extDefault = cfg.get("sync.default.extensions", "no");
  const rgDefault = cfg.get("sync.default.ringgroups", "no");

  if (!promptOnStartup) {
    console.log(`[sync] Using default sync mode: extensions=${extDefault}, ringgroups=${rgDefault}`);
    if (extDefault !== "no" || rgDefault !== "no") {
      try {
        const results = await syncService.runSync(extDefault, rgDefault);
        console.log("[sync] Initial sync completed:", JSON.stringify(results));
      } catch (err) {
        console.error("[sync] Initial sync failed:", err.message);
      }
    }
    syncService.startPeriodicSync();
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (text) => new Promise((resolve) => rl.question(text, resolve));
  const timeout = (ms, defVal) => new Promise((resolve) => setTimeout(() => resolve(defVal), ms));

  console.log("\n=========================================");
  console.log("  FreePBX Sync Setup");
  console.log("=========================================");
  console.log("Options: yes, yes_add_only, no, yes_delete_only");
  console.log("(will use config default if no input after 10s)");
  console.log("");

  const extPromise = question(`Extensions sync mode [${extDefault}]: `);
  const extResult = await Promise.race([extPromise, timeout(10000, extDefault)]);
  const extMode = extResult?.trim() || extDefault;

  const rgPromise = question(`Ring groups sync mode [${rgDefault}]: `);
  const rgResult = await Promise.race([rgPromise, timeout(10000, rgDefault)]);
  const rgMode = rgResult?.trim() || rgDefault;

  rl.close();

  cfg.set("sync.default.extensions", extMode, "sync", "Default extension sync mode");
  cfg.set("sync.default.ringgroups", rgMode, "sync", "Default ringgroup sync mode");

  if (extMode !== "no" || rgMode !== "no") {
    console.log(`\nSyncing with: extensions=${extMode}, ringgroups=${rgMode}`);
    try {
      const results = await syncService.runSync(extMode, rgMode);
      console.log("[sync] Initial sync completed:", JSON.stringify(results));
    } catch (err) {
      console.error("[sync] Initial sync failed:", err.message);
    }
  } else {
    console.log("\nNo sync configured (mode: no)");
  }

  syncService.startPeriodicSync();
}

// ─── Start ────────────────────────────────────────────────────────────────────
const HOST = cfg.get("server.host", "0.0.0.0");
const PORT = cfg.getNumber("server.port", 8000);

app.listen(PORT, HOST, async () => {
  console.log("=========================================");
  console.log("  Nexus Unified Communications | Backend");
  console.log("  Version: 1.0.0");
  console.log(`  Server: http://${HOST}:${PORT}`);
  console.log("=========================================");

  if (process.env.NEXUS_SKIP_INITIAL_SYNC === "true") {
    syncService.startPeriodicSync();
  } else {
    promptInitialSync();
  }
});

module.exports = app;
