/**
 * routers/config/index.js
 * -----------------------
 * CRUD API for the Nexus config system.
 *
 * All settings in Nexus are stored in the database and cached in memory.
 * These endpoints let you read, create, update, and delete any setting
 * without touching code or restarting the server.
 *
 * GET    /api/config          — List all settings (optionally ?group=XXX)
 * GET    /api/config/:key     — Get a specific setting
 * PUT    /api/config/:key     — Create or update a setting
 * DELETE /api/config/:key     — Delete a setting
 * POST   /api/config/reload   — Force reload cache from database
 */

const express = require("express");
const cfg = require("../../config/configStore");
const router = express.Router();

/**
 * GET /api/config
 * List every setting, or filter by group with ?group=freepbx
 */
router.get("/", (req, res) => {
  const group = req.query.group;
  res.json(cfg.all(group));
});

/**
 * GET /api/config/:key
 * Return a single setting by its key (e.g. "freepbx.api_url")
 */
router.get("/:key", (req, res) => {
  const entry = cfg.raw(req.params.key);
  if (!entry) return res.status(404).json({ error: "Config key not found", key: req.params.key });
  res.json(entry);
});

/**
 * PUT /api/config/:key
 * Create or update a setting.
 *
 * Body: { value, group?, label?, type? }
 *   value  (required) — the new value
 *   group  (optional)  — logical group, defaults to "general"
 *   label  (optional)  — human-readable description
 *   type   (optional)  — one of: string, number, boolean, secret
 */
router.put("/:key", (req, res) => {
  const { value, group, label, type } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: "Missing 'value' in request body" });
  }
  cfg.set(req.params.key, value, group || "general", label || "", type || "string");
  res.json({ ok: true, key: req.params.key, value, group: group || "general" });
});

/**
 * DELETE /api/config/:key
 * Remove a setting by key.
 */
router.delete("/:key", (req, res) => {
  const entry = cfg.raw(req.params.key);
  if (!entry) return res.status(404).json({ error: "Config key not found", key: req.params.key });
  cfg.del(req.params.key);
  res.json({ ok: true, deleted: req.params.key });
});

/**
 * POST /api/config/reload
 * Force a full reload of the config cache from the database.
 */
router.post("/reload", (req, res) => {
  const result = cfg.reload();
  res.json({ ok: true, ...result });
});

module.exports = router;
