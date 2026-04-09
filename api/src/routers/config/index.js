/**
 * routers/config/index.js
 * -----------------------
 * CRUD API for the Nexus config system.
 *
 * All settings in Nexus are stored in the database and cached in memory.
 * These endpoints let you read, create, update, and delete any setting
 * without touching code or restarting the server.
 *
 * GET    /api/admin/system/config          — List all settings (optionally ?group=XXX)
 * GET    /api/admin/system/config/:key     — Get a specific setting
 * PUT    /api/admin/system/config/:key     — Create or update a setting
 * DELETE /api/admin/system/config/:key     — Delete a setting
 * POST   /api/admin/system/config/reload   — Force reload cache from database
 */

const express = require("express");
const cfg = require("../../config/configStore");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

router.get("/", requiresPerm("configs:read"), (req, res) => {
  const group = req.query.group;
  res.json(cfg.all(group));
});

router.get("/:key", requiresPerm("configs:read"), (req, res) => {
  const entry = cfg.raw(req.params.key);
  if (!entry) return res.status(404).json({ error: "Config key not found", key: req.params.key });
  res.json(entry);
});

router.put("/:key", requiresPerm("configs:write"), (req, res) => {
  const { value, group, label, type } = req.body;
  if (value === undefined) {
    return res.status(400).json({ error: "Missing 'value' in request body" });
  }
  cfg.set(req.params.key, value, group || "general", label || "", type || "string");
  res.json({ ok: true, key: req.params.key, value, group: group || "general" });
});

router.delete("/:key", requiresPerm("configs:write"), (req, res) => {
  const entry = cfg.raw(req.params.key);
  if (!entry) return res.status(404).json({ error: "Config key not found", key: req.params.key });
  cfg.del(req.params.key);
  res.json({ ok: true, deleted: req.params.key });
});

router.post("/reload", requiresPerm("configs:write"), (req, res) => {
  const result = cfg.reload();
  res.json({ ok: true, ...result });
});

module.exports = router;
