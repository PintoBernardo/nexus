/**
 * routers/ringgroups/index.js
 * ----------------------------
 * Ring Group management API.
 *
 * Ring groups are stored locally and can link to multiple extensions by number.
 * Administrators can manage ring groups and their member extensions via CRUD.
 *
 * Endpoints:
 *   GET    /api/ringgroups/:id                    — Get a single ring group with members
 *   POST   /api/ringgroups                        — Create ring group (requires ringgroups:write)
 *   PUT    /api/ringgroups/:id                    — Update ring group (requires ringgroups:write)
 *   DELETE /api/ringgroups/:id                    — Delete ring group (requires ringgroups:delete)
 *   POST   /api/ringgroups/:id/members/:extension — Add extension number to ring group
 *   DELETE /api/ringgroups/:id/members/:extension — Remove extension number from ring group
 *   PUT    /api/ringgroups/:id/members            — Set all members by extension numbers (replaces)
 */

const express = require("express");
const db = require("../../config/db");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * GET /api/ringgroups
 * List all ring groups with their members.
 */
router.get("/", requiresPerm("ringgroups:read"), (req, res) => {
  const groups = db.prepare("SELECT * FROM ring_groups ORDER BY name").all();
  const getMembers = db.prepare(`
    SELECT e.extension, e.display_name, e.type, rgm.priority
    FROM ring_group_members rgm
    JOIN extensions e ON e.id = rgm.extension_id
    WHERE rgm.ring_group_id = ?
    ORDER BY rgm.priority
  `);

  for (const group of groups) {
    group.members = getMembers.all(group.id);
  }

  res.json({ ok: true, count: groups.length, ringGroups: groups });
});

/**
 * GET /api/ringgroups/:id
 * Get a single ring group with its members.
 */
router.get("/:id", requiresPerm("ringgroups:read"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const group = db.prepare("SELECT * FROM ring_groups WHERE id = ?").get(id);
  if (!group) return res.status(404).json({ error: "Ring group not found" });

  group.members = db.prepare(`
    SELECT e.extension, e.display_name, e.type, rgm.priority
    FROM ring_group_members rgm
    JOIN extensions e ON e.id = rgm.extension_id
    WHERE rgm.ring_group_id = ?
    ORDER BY rgm.priority
  `).all(id);

  res.json({ ok: true, ringGroup: group });
});

/**
 * POST /api/ringgroups
 * Create a new ring group.
 * Body: { name, strategy?, description?, members? }
 * members is an array of extension numbers: ["101", "102"]
 */
router.post("/", requiresPerm("ringgroups:write"), (req, res) => {
  const { name, strategy = "ringall", description = "", members = [] } = req.body;
  if (!name) return res.status(400).json({ error: "Missing 'name'" });
  if (!["ringall", "hunt", "memoryhunt"].includes(strategy)) {
    return res.status(400).json({ error: "Invalid strategy. Must be: ringall, hunt, memoryhunt" });
  }

  const getExt = db.prepare("SELECT id FROM extensions WHERE extension = ?");

  const txn = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO ring_groups (name, strategy, description) VALUES (?, ?, ?)"
    ).run(name, strategy, description);

    const groupId = result.lastInsertRowid;
    if (Array.isArray(members) && members.length > 0) {
      const insertMember = db.prepare(
        "INSERT INTO ring_group_members (ring_group_id, extension_id, priority) VALUES (?, ?, ?)"
      );
      for (let i = 0; i < members.length; i++) {
        const ext = getExt.get(members[i]);
        if (ext) {
          insertMember.run(groupId, ext.id, i);
        }
      }
    }
  });

  try {
    txn();
    const created = db.prepare("SELECT * FROM ring_groups WHERE name = ?").get(name);
    created.members = db.prepare(`
      SELECT e.extension, e.display_name, e.type, rgm.priority
      FROM ring_group_members rgm
      JOIN extensions e ON e.id = rgm.extension_id
      WHERE rgm.ring_group_id = ?
      ORDER BY rgm.priority
    `).all(created.id);
    res.status(201).json({ ok: true, ringGroup: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/ringgroups/:id
 * Update a ring group.
 * Body: any subset of { name, strategy, description }
 */
router.put("/:id", requiresPerm("ringgroups:write"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const group = db.prepare("SELECT * FROM ring_groups WHERE id = ?").get(id);
  if (!group) return res.status(404).json({ error: "Ring group not found" });

  const { name, strategy, description } = req.body;
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (strategy !== undefined) {
    if (!["ringall", "hunt", "memoryhunt"].includes(strategy)) {
      return res.status(400).json({ error: "Invalid strategy. Must be: ringall, hunt, memoryhunt" });
    }
    updates.push("strategy = ?"); values.push(strategy);
  }
  if (description !== undefined) { updates.push("description = ?"); values.push(description); }
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  if (updates.length === 1) return res.status(400).json({ error: "No fields to update" });

  try {
    db.prepare(`UPDATE ring_groups SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    const updated = db.prepare("SELECT * FROM ring_groups WHERE id = ?").get(id);
    res.json({ ok: true, ringGroup: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/ringgroups/:id
 * Delete a ring group.
 */
router.delete("/:id", requiresPerm("ringgroups:delete"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const result = db.prepare("DELETE FROM ring_groups WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Ring group not found" });
  res.json({ ok: true, deleted: id });
});

// ─── Member Management (by extension number) ─────────────────────────────────

/**
 * POST /api/ringgroups/:id/members/:extension
 * Add an extension number to a ring group.
 */
router.post("/:id/members/:extension", requiresPerm("ringgroups:write"), (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  const extension = req.params.extension;
  if (isNaN(groupId)) return res.status(400).json({ error: "Invalid ring group ID" });

  const group = db.prepare("SELECT id FROM ring_groups WHERE id = ?").get(groupId);
  if (!group) return res.status(404).json({ error: "Ring group not found" });

  const ext = db.prepare("SELECT id, extension, display_name FROM extensions WHERE extension = ?").get(extension);
  if (!ext) return res.status(404).json({ error: `Extension '${extension}' not found` });

  try {
    db.prepare("INSERT INTO ring_group_members (ring_group_id, extension_id, priority) VALUES (?, ?, 0)").run(groupId, ext.id);
    res.json({ ok: true, message: `Extension ${ext.extension} added to ring group`, ringGroupId: groupId, extension: ext.extension });
  } catch {
    res.status(400).json({ error: `Extension ${ext.extension} already in this ring group` });
  }
});

/**
 * DELETE /api/ringgroups/:id/members/:extension
 * Remove an extension number from a ring group.
 */
router.delete("/:id/members/:extension", requiresPerm("ringgroups:write"), (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  const extension = req.params.extension;
  if (isNaN(groupId)) return res.status(400).json({ error: "Invalid ring group ID" });

  const ext = db.prepare("SELECT id FROM extensions WHERE extension = ?").get(extension);
  if (!ext) return res.status(404).json({ error: `Extension '${extension}' not found` });

  const result = db.prepare("DELETE FROM ring_group_members WHERE ring_group_id = ? AND extension_id = ?").run(groupId, ext.id);
  if (result.changes === 0) return res.status(404).json({ error: `Extension ${extension} not in this ring group` });
  res.json({ ok: true, message: `Extension ${extension} removed from ring group`, ringGroupId: groupId, extension });
});

/**
 * PUT /api/ringgroups/:id/members
 * Set all members for a ring group by extension numbers (replaces existing members).
 * Body: { members: ["101", "102", "103"] }
 */
router.put("/:id/members", requiresPerm("ringgroups:write"), (req, res) => {
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) return res.status(400).json({ error: "Invalid ID" });

  const group = db.prepare("SELECT id FROM ring_groups WHERE id = ?").get(groupId);
  if (!group) return res.status(404).json({ error: "Ring group not found" });

  if (!Array.isArray(req.body.members)) {
    return res.status(400).json({ error: "Missing 'members' array. Send extension numbers: [\"101\", \"102\"]" });
  }

  const getExt = db.prepare("SELECT id, extension FROM extensions WHERE extension = ?");

  const txn = db.transaction(() => {
    db.prepare("DELETE FROM ring_group_members WHERE ring_group_id = ?").run(groupId);
    const insert = db.prepare("INSERT INTO ring_group_members (ring_group_id, extension_id, priority) VALUES (?, ?, ?)");
    for (let i = 0; i < req.body.members.length; i++) {
      const ext = getExt.get(req.body.members[i]);
      if (ext) {
        insert.run(groupId, ext.id, i);
      }
    }
  });

  try {
    txn();
    const members = db.prepare(`
      SELECT e.extension, e.display_name, e.type, rgm.priority
      FROM ring_group_members rgm
      JOIN extensions e ON e.id = rgm.extension_id
      WHERE rgm.ring_group_id = ?
      ORDER BY rgm.priority
    `).all(groupId);
    res.json({ ok: true, count: members.length, members });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
