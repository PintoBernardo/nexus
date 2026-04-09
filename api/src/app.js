/**
 * app.js
 * ------
 * Nexus Unified Communications — Express backend entry point.
 */

const express = require("express");
const path = require("path");
const cfg = require("./config/configStore");
const db = require("./config/db");
const { requiresPerm } = require("./middleware/auth");

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
app.use("/api/services/directory", requiresPerm("services:read"), servicesDirRouter);

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

// ─── Start ────────────────────────────────────────────────────────────────────
const HOST = cfg.get("server.host", "0.0.0.0");
const PORT = cfg.getNumber("server.port", 8000);

app.listen(PORT, HOST, () => {
  console.log("=========================================");
  console.log("  Nexus Unified Communications | Backend");
  console.log("  Version: 1.0.0");
  console.log(`  Server: http://${HOST}:${PORT}`);
  console.log("=========================================");
});

module.exports = app;
