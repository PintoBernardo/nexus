/**
 * services/index.js
 * -----------------
 * Standalone Cisco IP Phone Services Server — main entry point.
 *
 * This is a separate Express server that serves CiscoIPPhone XML directly
 * to phones. It does NOT live inside the API. It calls the API internally
 * to get data, then wraps it in XML.
 *
 * Architecture:
 *   Each phone service has its own folder under services/<name>/index.js
 *   and mounts as an Express router at /services/<name>/*.
 *
 *   /services/directory/*       — Personal + Corporate directory
 *   /services/quality-report/*  — Quality reports (future)
 *   /services/problem-report/*  — Problem reports (future)
 *
 * Phones hit these URLs directly. The server calls the JSON API
 * at /api/services/* for data.
 *
 * Service enable/disable is controlled by the services_status DB table.
 * The backend reads this table and the frontend requests /api/services/status
 * to know what to display.
 *
 * Run standalone:  npm run services
 * Run with API:    npm run start:all
 * Or:              node services/index.js
 */

const express = require("express");
const http = require("http");
const cfg = require("../api/src/config/configStore");

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.urlencoded({ extended: false }));

// ─── Mount Service Routers ────────────────────────────────────────────────────

// Directory service (personal + corporate)
const directoryRouter = require("./directory");
app.use("/services/directory", directoryRouter);

// Future services mount here:
// const qualityReportRouter = require("./quality-report");
// app.use("/services/quality-report", qualityReportRouter);

// const problemReportRouter = require("./problem-report");
// app.use("/services/problem-report", problemReportRouter);

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = cfg.getNumber("services.port", 8001);
const HOST = cfg.get("services.host", "0.0.0.0");
const API_BASE = `http://127.0.0.1:${process.env.NEXUS_API_PORT || cfg.getNumber("server.port", 8000)}`;

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log("=========================================");
  console.log("  Nexus Unified Communications | Phone Services");
  console.log(`  Server: http://${HOST}:${PORT}`);
  console.log(`  API:    ${API_BASE}`);
  console.log("=========================================");
});
