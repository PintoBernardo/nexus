/**
 * routers/services/status.js
 * --------------------------
 * Services status API — lets the phone XML frontend query which services
 * are enabled/disabled. Also allows admins to toggle services.
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
const db = require("../../config/db");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

/**
 * GET /api/services/status
 * Returns all services and their enabled state.
 * Requires services:read permission.
 */
router.get("/", requiresPerm("services:read"), (req, res) => {
  const services = db.prepare("SELECT * FROM services_status ORDER BY name").all();
  res.json({ ok: true, count: services.length, services });
});

/**
 * GET /api/services/status/:name
 * Returns a single service's status.
 * Requires services:read permission.
 */
router.get("/:name", requiresPerm("services:read"), (req, res) => {
  const service = db.prepare("SELECT * FROM services_status WHERE name = ?").get(req.params.name);
  if (!service) return res.status(404).json({ error: "Service not found" });
  res.json({ ok: true, service });
});

/**
 * PUT /api/services/status/:name
 * Toggle a service on or off.
 * Body: { enabled: true|false }
 * Auth: requires services:write permission.
 */
router.put("/:name", requiresPerm("services:write"), (req, res) => {
  const { enabled } = req.body;
  if (enabled === undefined) return res.status(400).json({ error: "Missing 'enabled' field" });

  const service = db.prepare("SELECT id FROM services_status WHERE name = ?").get(req.params.name);
  if (!service) return res.status(404).json({ error: "Service not found" });

  db.prepare("UPDATE services_status SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?")
    .run(enabled ? 1 : 0, req.params.name);

  const updated = db.prepare("SELECT * FROM services_status WHERE name = ?").get(req.params.name);
  res.json({ ok: true, service: updated });
});

module.exports = router;
