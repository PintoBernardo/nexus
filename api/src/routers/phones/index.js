/**
 * routers/phones/index.js
 * -----------------------
 * Phone model catalog management API.
 *
 * Phone models define the specifications of supported Cisco IP phones
 * (screen, line keys, protocol, expansion modules, etc.).
 * Devices reference phone_models via the model column.
 *
 * Endpoints:
 *   GET    /api/phones          — List all phone models
 *   GET    /api/phones/:model   — Get a specific phone model
 *   POST   /api/phones          — Create phone model (requires devices:write)
 *   PUT    /api/phones/:model   — Update phone model (requires devices:write)
 *   DELETE /api/phones/:model   — Delete phone model (requires devices:write)
 */

const express = require("express");
const db = require("../../config/db");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

/**
 * GET /api/phones
 * List all phone models, optionally filtered by ?manufacturer=Cisco
 */
router.get("/", requiresPerm("devices:read"), (req, res) => {
  let models;
  if (req.query.manufacturer) {
    models = db.prepare("SELECT * FROM phone_models WHERE manufacturer = ?").all(req.query.manufacturer);
  } else if (req.query.protocol) {
    models = db.prepare("SELECT * FROM phone_models WHERE protocol = ?").all(req.query.protocol);
  } else {
    models = db.prepare("SELECT * FROM phone_models ORDER BY model").all();
  }
  res.json({ ok: true, count: models.length, models });
});

/**
 * GET /api/phones/:model
 * Get a specific phone model.
 */
router.get("/:model", requiresPerm("devices:read"), (req, res) => {
  const model = db.prepare("SELECT * FROM phone_models WHERE model = ?").get(req.params.model);
  if (!model) return res.status(404).json({ error: "Phone model not found" });
  res.json({ ok: true, model });
});

/**
 * POST /api/phones
 * Create a phone model entry.
 * Body: { model, manufacturer?, screen_resolution?, screen_size?, screen_color?, num_lines?, num_softkeys?, num_line_keys?, expansion_module?, has_wifi?, has_poe?, has_bluetooth?, usb_ports?, network_ports?, form_factor?, protocol?, notes? }
 */
router.post("/", requiresPerm("devices:write"), (req, res) => {
  const {
    model, manufacturer = "Cisco", screen_resolution = "", screen_size = "",
    screen_color = "", num_lines = 0, num_softkeys = 0, num_line_keys = 0,
    expansion_module = "none", has_wifi = 0, has_poe = 0, has_bluetooth = 0,
    usb_ports = 0, network_ports = 1, form_factor = "", protocol = "sccp", notes = ""
  } = req.body;

  if (!model) return res.status(400).json({ error: "Missing 'model'" });

  try {
    db.prepare(`
      INSERT INTO phone_models (model, manufacturer, screen_resolution, screen_size, screen_color,
        num_lines, num_softkeys, num_line_keys, expansion_module, has_wifi, has_poe, has_bluetooth,
        usb_ports, network_ports, form_factor, protocol, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(model, manufacturer, screen_resolution, screen_size, screen_color,
      num_lines, num_softkeys, num_line_keys, expansion_module, has_wifi ? 1 : 0, has_poe ? 1 : 0,
      has_bluetooth ? 1 : 0, usb_ports, network_ports, form_factor, protocol, notes);

    const created = db.prepare("SELECT * FROM phone_models WHERE model = ?").get(model);
    res.status(201).json({ ok: true, model: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/phones/:model
 * Update a phone model's specs.
 */
router.put("/:model", requiresPerm("devices:write"), (req, res) => {
  const { manufacturer, screen_resolution, screen_size, screen_color,
    num_lines, num_softkeys, num_line_keys, expansion_module, has_wifi,
    has_poe, has_bluetooth, usb_ports, network_ports, form_factor, protocol, notes } = req.body;

  const updates = [];
  const values = [];
  if (manufacturer !== undefined) { updates.push("manufacturer = ?"); values.push(manufacturer); }
  if (screen_resolution !== undefined) { updates.push("screen_resolution = ?"); values.push(screen_resolution); }
  if (screen_size !== undefined) { updates.push("screen_size = ?"); values.push(screen_size); }
  if (screen_color !== undefined) { updates.push("screen_color = ?"); values.push(screen_color); }
  if (num_lines !== undefined) { updates.push("num_lines = ?"); values.push(num_lines); }
  if (num_softkeys !== undefined) { updates.push("num_softkeys = ?"); values.push(num_softkeys); }
  if (num_line_keys !== undefined) { updates.push("num_line_keys = ?"); values.push(num_line_keys); }
  if (expansion_module !== undefined) { updates.push("expansion_module = ?"); values.push(expansion_module); }
  if (has_wifi !== undefined) { updates.push("has_wifi = ?"); values.push(has_wifi ? 1 : 0); }
  if (has_poe !== undefined) { updates.push("has_poe = ?"); values.push(has_poe ? 1 : 0); }
  if (has_bluetooth !== undefined) { updates.push("has_bluetooth = ?"); values.push(has_bluetooth ? 1 : 0); }
  if (usb_ports !== undefined) { updates.push("usb_ports = ?"); values.push(usb_ports); }
  if (network_ports !== undefined) { updates.push("network_ports = ?"); values.push(network_ports); }
  if (form_factor !== undefined) { updates.push("form_factor = ?"); values.push(form_factor); }
  if (protocol !== undefined) { updates.push("protocol = ?"); values.push(protocol); }
  if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }

  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

  values.push(req.params.model);
  try {
    db.prepare(`UPDATE phone_models SET ${updates.join(", ")} WHERE model = ?`).run(...values);
    const updated = db.prepare("SELECT * FROM phone_models WHERE model = ?").get(req.params.model);
    res.json({ ok: true, model: updated });
  } catch {
    res.status(404).json({ error: "Phone model not found" });
  }
});

/**
 * DELETE /api/phones/:model
 * Delete a phone model. Fails if any devices reference it (ON DELETE RESTRICT).
 */
router.delete("/:model", requiresPerm("devices:write"), (req, res) => {
  const result = db.prepare("DELETE FROM phone_models WHERE model = ?").run(req.params.model);
  if (result.changes === 0) return res.status(404).json({ error: "Phone model not found" });
  res.json({ ok: true, deleted: req.params.model });
});

module.exports = router;
