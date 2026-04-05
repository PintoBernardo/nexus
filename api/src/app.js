/**
 * app.js
 * ------
 * Nexus Unified Communications — Express backend entry point.
 *
 * Router structure:
 *   /api/system/*    — health, status
 *   /api/config/*    — read/write all database settings
 *   /api/freepbx/*   — FreePBX GraphQL API proxy
 *   /api/ami/*       — Asterisk Manager Interface commands
 *
 * To run:
 *   Production:  npm start
 *   Development:  npm run dev  (auto-restart on file changes)
 *
 * To seed default settings:
 *   npm run seed
 */

const express = require("express");
const path = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────
const cfg = require("./config/configStore");

// ─── Create Express app ───────────────────────────────────────────────────────
const app = express();

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use(require("./middleware/logger"));

// ─── Routers ──────────────────────────────────────────────────────────────────

// System — health, status
const systemRouter = require("./routers/system/health");
app.use("/api/system", systemRouter);

// Config — read/write all settings
const configRouter = require("./routers/config/index");
app.use("/api/config", configRouter);

// FreePBX — extensions, OAuth token
const freepbxRouter = require("./routers/freepbx/index");
app.use("/api/freepbx", freepbxRouter);

// AMI — Asterisk Manager Interface
const amiRouter = require("./routers/ami/index");
app.use("/api/ami", amiRouter);

// ─── Static file serving ──────────────────────────────────────────────────────

// Serve frontend static files
app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")));

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(`[error] ${err.stack}`);
  res.status(err.status || 500).json({
    error: "Internal server error",
    message: err.message
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────

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
