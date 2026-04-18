/**
 * routers/freepbx/index.js
 * -----------------------
 * FreePBX API integration endpoints.
 *
 * Proxies requests to the FreePBX GraphQL API. All credentials
 * and URLs are read from the database config system.
 *
 * GET    /api/freepbx/extensions  — Fetch all extensions from FreePBX
 * GET    /api/freepbx/token       — Force-refresh OAuth token
 * POST   /api/freepbx/sync        — Sync extensions/ringgroups from FreePBX
 */

const express = require("express");
const fpbx = require("../../services/freepbx");
const cfg = require("../../config/configStore");
const syncService = require("../../services/sync");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

/**
 * GET /api/freepbx/extensions
 * Returns the list of extensions from FreePBX.
 */
router.get("/extensions", async (req, res) => {
  // Check if FreePBX integration is enabled in config
  if (!cfg.getBool("freepbx.enabled")) {
    return res.status(503).json({ error: "FreePBX integration is disabled", hint: "Set freepbx.enabled = true in config" });
  }

  try {
    const extensions = await fpbx.getExtensions();
    res.json({ ok: true, count: extensions.length, extensions });
  } catch (err) {
    console.error("[freepbx] Error fetching extensions:", err.message);
    res.status(500).json({ error: "Failed to fetch extensions", detail: err.message });
  }
});

/**
 * GET /api/freepbx/token
 * Force-gets a fresh OAuth token from FreePBX.
 * Useful for testing connectivity.
 */
router.get("/token", async (req, res) => {
  if (!cfg.getBool("freepbx.enabled")) {
    return res.status(503).json({ error: "FreePBX integration is disabled" });
  }

  try {
    fpbx.invalidateToken();
    const token = await fpbx.getToken();
    res.json({ ok: true, token: token.substring(0, 20) + "..." });
  } catch (err) {
    res.status(500).json({ error: "Failed to get token", detail: err.message });
  }
});

/**
 * GET /api/freepbx/ringgroups
 * Returns the list of ring groups from FreePBX.
 */
router.get("/ringgroups", async (req, res) => {
  if (!cfg.getBool("freepbx.enabled")) {
    return res.status(503).json({ error: "FreePBX integration is disabled", hint: "Set freepbx.enabled = true in config" });
  }

  try {
    const ringgroups = await fpbx.getRingGroups();
    res.json({ ok: true, count: ringgroups.length, ringgroups });
  } catch (err) {
    console.error("[freepbx] Error fetching ring groups:", err.message);
    res.status(500).json({ error: "Failed to fetch ring groups", detail: err.message });
  }
});

/**
 * POST /api/freepbx/sync
 * Sync extensions and/or ringgroups from FreePBX to local DB.
 * Body: {
 *   extensions: "yes" | "yes_add_only" | "yes_delete_only" | "no",
 *   ringgroups: "yes" | "yes_add_only" | "yes_delete_only" | "no"
 * }
 * Defaults to config values if not provided.
 */
router.post("/sync", requiresPerm("sync:write"), async (req, res) => {
  if (!cfg.getBool("freepbx.enabled")) {
    return res.status(503).json({ error: "FreePBX integration is disabled" });
  }

  const extMode = req.body.extensions || cfg.get("sync.default.extensions", "no");
  const rgMode = req.body.ringgroups || cfg.get("sync.default.ringgroups", "no");

  try {
    const results = await syncService.runSync(extMode, rgMode);
    syncService.recordSyncSelection();
    res.json({ ok: true, message: "Sync completed", results });
  } catch (err) {
    console.error("[freepbx] Sync error:", err.message);
    res.status(500).json({ error: "Sync failed", detail: err.message });
  }
});

module.exports = router;
