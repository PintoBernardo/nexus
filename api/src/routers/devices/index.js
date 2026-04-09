/**
 * routers/devices/index.js
 * -------------------------
 * Device (physical phones/peers) management API.
 *
 * Devices represent physical Cisco IP phones, SIP peers, or other endpoints
 * registered in the local database, tracked against phone_models.
 *
 * Endpoints:
 *   GET    /api/devices             — List all devices
 *   GET    /api/devices/:id         — Get a single device
 *   POST   /api/devices             — Create device (requires devices:write)
 *   PUT    /api/devices/:id         — Update device (requires devices:write)
 *   DELETE /api/devices/:id         — Delete device (requires devices:delete)
 *   GET    /api/devices/model/:model — All devices of a specific model
 */

const express = require("express");
const db = require("../../config/db");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

/**
 * GET /api/devices
 * List all devices with optional filter ?user_id=X or ?status=X
 */
router.get("/", requiresPerm("devices:read"), (req, res) => {
  let devices;
  if (req.query.user_id) {
    const userId = parseInt(req.query.user_id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user_id" });
    devices = db.prepare("SELECT * FROM devices WHERE user_id = ?").all(userId);
  } else if (req.query.status) {
    devices = db.prepare("SELECT * FROM devices WHERE status = ?").all(req.query.status);
  } else {
    devices = db.prepare("SELECT * FROM devices ORDER BY id").all();
  }
  res.json({ ok: true, count: devices.length, devices });
});

/**
 * GET /api/devices/:id
 * Get a single device by ID.
 */
router.get("/:id", requiresPerm("devices:read"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const dev = db.prepare("SELECT * FROM devices WHERE id = ?").get(id);
  if (!dev) return res.status(404).json({ error: "Device not found" });
  res.json({ ok: true, device: dev });
});

/**
 * GET /api/devices/model/:model
 * Get devices filtered by phone model.
 */
router.get("/model/:model", requiresPerm("devices:read"), (req, res) => {
  const devices = db.prepare("SELECT * FROM devices WHERE model = ?").all(req.params.model);
  res.json({ ok: true, count: devices.length, model: req.params.model, devices });
});

/**
 * POST /api/devices
 * Create a new device.
 * Body: { user_id, mac_address, model, ip_address?, hostname?, status?, last_registered? }
 */
router.post("/", requiresPerm("devices:write"), (req, res) => {
  const { user_id, mac_address, model, ip_address = "", hostname = "", status = "unregistered", last_registered = null } = req.body;
  if (!mac_address || !model) return res.status(400).json({ error: "Missing 'mac_address' or 'model'" });

  try {
    const result = db.prepare(
      "INSERT INTO devices (user_id, mac_address, ip_address, model, hostname, status, last_registered) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(user_id || null, mac_address.toUpperCase(), ip_address, model, hostname, status, last_registered);

    const created = db.prepare("SELECT * FROM devices WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ ok: true, device: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/devices/:id
 * Update a device.
 * Body: any subset of { user_id, mac_address, ip_address, model, hostname, status, last_registered }
 */
router.put("/:id", requiresPerm("devices:write"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const exists = db.prepare("SELECT id FROM devices WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "Device not found" });

  const { user_id, mac_address, ip_address, model, hostname, status, last_registered } = req.body;
  const updates = [];
  const values = [];
  if (user_id !== undefined) { updates.push("user_id = ?"); values.push(user_id ?? null); }
  if (mac_address !== undefined) { updates.push("mac_address = ?"); values.push(mac_address.toUpperCase()); }
  if (ip_address !== undefined) { updates.push("ip_address = ?"); values.push(ip_address); }
  if (model !== undefined) { updates.push("model = ?"); values.push(model); }
  if (hostname !== undefined) { updates.push("hostname = ?"); values.push(hostname); }
  if (status !== undefined) { updates.push("status = ?"); values.push(status); }
  if (last_registered !== undefined) { updates.push("last_registered = ?"); values.push(last_registered); }
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  if (updates.length === 1) return res.status(400).json({ error: "No fields to update" });

  try {
    db.prepare(`UPDATE devices SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    const updated = db.prepare("SELECT * FROM devices WHERE id = ?").get(id);
    res.json({ ok: true, device: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/devices/:id
 * Delete a device.
 */
router.delete("/:id", requiresPerm("devices:delete"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const result = db.prepare("DELETE FROM devices WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Device not found" });
  res.json({ ok: true, deleted: id });
});

module.exports = router;
