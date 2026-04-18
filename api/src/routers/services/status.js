/**
 * routers/services/status.js
 * --------------------------
 * Services status API — lets the phone XML frontend query which services
 * are enabled/disabled. Uses the config table.
 *
 * GET endpoints require services:read permission.
 * PUT requires services:write permission.
 *
 * Endpoints:
 *   GET    /api/services/status        — List all services with enabled state
 *   GET    /api/services/status/:name  — Get a single service's status
 *   PUT    /api/services/status/:name  — Toggle a service on/off
 */

const express = require("express");
const cfg = require("../../config/configStore");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

const AVAILABLE_SERVICES = ["directory"];

function parseBool(val) {
  if (val === undefined || val === null) return false;
  return ["1", "true", "yes", "on"].includes(String(val).toLowerCase());
}

/**
 * GET /api/services/status
 * Returns all services and their enabled state.
 * Requires services:read permission.
 */
router.get("/", requiresPerm("services:read"), (req, res) => {
  const services = AVAILABLE_SERVICES.map(name => ({
    name,
    enabled: parseBool(cfg.get(`${name}.enabled`)),
    label: cfg.get(`${name}.label`) || name
  }));
  res.json({ ok: true, count: services.length, services });
});

/**
 * GET /api/services/status/:name
 * Returns a single service's status.
 * Requires services:read permission.
 */
router.get("/:name", requiresPerm("services:read"), (req, res) => {
  const { name } = req.params;
  if (!AVAILABLE_SERVICES.includes(name)) {
    return res.status(404).json({ error: "Service not found" });
  }
  res.json({ 
    ok: true, 
    service: {
      name,
      enabled: parseBool(cfg.get(`${name}.enabled`)),
      label: cfg.get(`${name}.label`) || name
    }
  });
});

/**
 * PUT /api/services/status/:name
 * Toggle a service on or off.
 * Body: { enabled: true|false }
 * Auth: requires services:write permission.
 */
router.put("/:name", requiresPerm("services:write"), (req, res) => {
  const { name } = req.params;
  const { enabled } = req.body;

  if (!AVAILABLE_SERVICES.includes(name)) {
    return res.status(404).json({ error: "Service not found" });
  }
  if (enabled === undefined) return res.status(400).json({ error: "Missing 'enabled' field" });

  cfg.set(`${name}.enabled`, enabled ? "true" : "false", name, cfg.get(`${name}.label`) || name, "boolean");

  res.json({ 
    ok: true, 
    service: {
      name,
      enabled: parseBool(cfg.get(`${name}.enabled`)),
      label: cfg.get(`${name}.label`) || name
    }
  });
});

module.exports = router;