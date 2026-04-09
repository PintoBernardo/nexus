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
 */

const express = require("express");
const fpbx = require("../../services/freepbx");
const cfg = require("../../config/configStore");
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

module.exports = router;
