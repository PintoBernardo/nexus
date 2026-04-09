/**
 * routers/extensions/index.js
 * ---------------------------
 * Extension management API.
 *
 * Extensions represent phone lines (SIP/PJSIP/SCCP) stored in the local database.
 * List by user_id only — no bulk list. Get individual extensions by ID.
 *
 * Endpoints:
 *   GET    /api/extensions?user_id=X  — List extensions for a user
 *   GET    /api/extensions/:id        — Get a single extension
 *   POST   /api/extensions            — Create extension (requires extensions:write)
 *   PUT    /api/extensions/:id        — Update extension (requires extensions:write)
 *   DELETE /api/extensions/:id        — Delete extension (requires extensions:delete)
 */

const express = require("express");
const db = require("../../config/db");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * GET /api/extensions
 * List all extensions. Optional `?user_id=X` filters by user.
 */
router.get("/", requiresPerm("extensions:read"), (req, res) => {
  let extensions;
  if (req.query.user_id) {
    const userId = parseInt(req.query.user_id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user_id" });
    extensions = db.prepare("SELECT * FROM extensions WHERE user_id = ?").all(userId);
  } else {
    extensions = db.prepare("SELECT * FROM extensions ORDER BY id").all();
  }
  res.json({ ok: true, count: extensions.length, extensions });
});

/**
 * GET /api/extensions/:id
 * Get a single extension by ID.
 */
router.get("/:id", requiresPerm("extensions:read"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const ext = db.prepare("SELECT * FROM extensions WHERE id = ?").get(id);
  if (!ext) return res.status(404).json({ error: "Extension not found" });
  res.json({ ok: true, extension: ext });
});

/**
 * POST /api/extensions
 * Create a new phone extension in the local database.
 * Body: { user_id, type ("sip"|"sccp"|"pjsip"), extension, secret?, display_name?, context?, enabled? }
 */
router.post("/", requiresPerm("extensions:write"), (req, res) => {
  const { user_id, type, extension, secret = "", display_name = "", context = "from-internal", enabled = 1 } = req.body;
  if (!type || !extension) return res.status(400).json({ error: "Missing 'type' or 'extension'" });
  if (!["sip", "sccp", "pjsip"].includes(type)) return res.status(400).json({ error: "Invalid type. Must be: sip, sccp, pjsip" });

  try {
    const result = db.prepare(
      "INSERT INTO extensions (user_id, type, extension, secret, display_name, context, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(user_id || null, type, extension, secret, display_name, context, enabled ? 1 : 0);

    const created = db.prepare("SELECT * FROM extensions WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ ok: true, extension: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/extensions/:id
 * Update an extension.
 * Body: any subset of { user_id, type, extension, secret, display_name, context, enabled }
 */
router.put("/:id", requiresPerm("extensions:write"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const ext = db.prepare("SELECT * FROM extensions WHERE id = ?").get(id);
  if (!ext) return res.status(404).json({ error: "Extension not found" });

  const { user_id, type, extension, secret, display_name, context, enabled } = req.body;
  const updates = [];
  const values = [];
  if (user_id !== undefined) { updates.push("user_id = ?"); values.push(user_id ?? null); }
  if (type !== undefined) { updates.push("type = ?"); values.push(type); }
  if (extension !== undefined) { updates.push("extension = ?"); values.push(extension); }
  if (secret !== undefined) { updates.push("secret = ?"); values.push(secret); }
  if (display_name !== undefined) { updates.push("display_name = ?"); values.push(display_name); }
  if (context !== undefined) { updates.push("context = ?"); values.push(context); }
  if (enabled !== undefined) { updates.push("enabled = ?"); values.push(enabled ? 1 : 0); }
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  if (updates.length === 1) return res.status(400).json({ error: "No fields to update" });

  try {
    const result = db.prepare(`UPDATE extensions SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    const updated = db.prepare("SELECT * FROM extensions WHERE id = ?").get(id);
    res.json({ ok: true, extension: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/extensions/:id
 * Delete an extension.
 */
router.delete("/:id", requiresPerm("extensions:delete"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const result = db.prepare("DELETE FROM extensions WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Extension not found" });
  res.json({ ok: true, deleted: id });
});

module.exports = router;
