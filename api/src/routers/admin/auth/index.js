/**
 * routers/admin/auth/index.js
 * --------------------------
 * Admin auth management - users, roles, sessions, database CRUD.
 * 
 * All endpoints require admin permissions.
 */

const express = require("express");
const router = express.Router();

const auth = require("../../../services/auth");
const tokens = require("../../../services/tokens");
const db = require("../../../config/db");
const { requiresPerm } = require("../../../middleware/auth");

// ─── Users ───────────────────────────────────────────────────────────────────

router.post("/register", requiresPerm("users:write"), async (req, res) => {
  const { username, email, password, firstName, lastName, phone, role } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "Missing username, email, or password" });
  try {
    const user = await auth.createUser({
      username, email, password,
      firstName: firstName || "", lastName: lastName || "",
      phone: phone || "", role: role || "user"
    });
    const token = auth.issueToken(user);
    res.status(201).json({ ok: true, message: "User created", user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/users", requiresPerm("users:read"), (req, res) => {
  res.json({ ok: true, users: auth.getAllUsers() });
});

router.get("/users/:id", requiresPerm("users:read"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const user = db.prepare("SELECT id, username, email, first_name, last_name, phone, role, suspended FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true, user });
});

router.put("/users/:id", requiresPerm("users:write"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const { role, suspended } = req.body;
  if (role === undefined && suspended === undefined) return res.status(400).json({ error: "Missing role or suspended" });
  try {
    res.json(auth.updateUser(id, role || "user", suspended === undefined ? false : suspended));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/users/:id", requiresPerm("users:delete"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  try {
    res.json(auth.deleteUser(req.user.id, id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/users/:id/suspend", requiresPerm("users:delete"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  try {
    res.json(auth.suspendUser(req.user.id, id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/users/:id/unsuspend", requiresPerm("users:delete"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  try {
    res.json(auth.unsuspendUser(id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// User extensions/devices linking
router.get("/users/:id/extensions", requiresPerm("users:read"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const exts = db.prepare("SELECT * FROM extensions WHERE user_id = ?").all(id);
  res.json({ ok: true, count: exts.length, extensions: exts });
});

router.get("/users/:id/devices", requiresPerm("users:read"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const devs = db.prepare("SELECT * FROM devices WHERE user_id = ?").all(id);
  res.json({ ok: true, count: devs.length, devices: devs });
});

router.post("/users/:id/extensions/:extId", requiresPerm("users:write"), (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const extId = parseInt(req.params.extId, 10);
  if (isNaN(userId) || isNaN(extId)) return res.status(400).json({ error: "Invalid ID" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const ext = db.prepare("SELECT id FROM extensions WHERE id = ?").get(extId);
  if (!ext) return res.status(404).json({ error: "Extension not found" });
  db.prepare("UPDATE extensions SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId, extId);
  res.json({ ok: true, message: "Extension linked to user", userId, extensionId: extId });
});

router.delete("/users/:id/extensions/:extId", requiresPerm("users:write"), (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const extId = parseInt(req.params.extId, 10);
  if (isNaN(userId) || isNaN(extId)) return res.status(400).json({ error: "Invalid ID" });
  const result = db.prepare("UPDATE extensions SET user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?").run(extId, userId);
  if (result.changes === 0) return res.status(404).json({ error: "Extension not linked to this user" });
  res.json({ ok: true, message: "Extension unlinked", extensionId: extId });
});

router.post("/users/:id/devices/:devId", requiresPerm("users:write"), (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const devId = parseInt(req.params.devId, 10);
  if (isNaN(userId) || isNaN(devId)) return res.status(400).json({ error: "Invalid ID" });
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const dev = db.prepare("SELECT id FROM devices WHERE id = ?").get(devId);
  if (!dev) return res.status(404).json({ error: "Device not found" });
  db.prepare("UPDATE devices SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(userId, devId);
  res.json({ ok: true, message: "Device linked to user", userId, deviceId: devId });
});

router.delete("/users/:id/devices/:devId", requiresPerm("users:write"), (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const devId = parseInt(req.params.devId, 10);
  if (isNaN(userId) || isNaN(devId)) return res.status(400).json({ error: "Invalid ID" });
  const result = db.prepare("UPDATE devices SET user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?").run(devId, userId);
  if (result.changes === 0) return res.status(404).json({ error: "Device not linked to this user" });
  res.json({ ok: true, message: "Device unlinked", deviceId: devId });
});

router.post("/users/:id/revoke-all-tokens", requiresPerm("users:write"), (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid ID" });
  if (req.user.id === userId) return res.status(400).json({ error: "Cannot revoke your own tokens" });
  const result = tokens.revokeAll(userId);
  res.json(result);
});

// ─── Roles ────────────────────────────────────────────────────────────────────

router.get("/roles", requiresPerm("roles:read"), (req, res) => {
  const roles = db.prepare("SELECT * FROM roles").all();
  const permStmt = db.prepare("SELECT permission FROM role_permissions WHERE role = ?");
  for (const role of roles) {
    role.permissions = permStmt.all(role.name).map(p => p.permission);
  }
  res.json({ ok: true, roles });
});

router.post("/roles", requiresPerm("roles:write"), (req, res) => {
  const { name, label = "", description = "" } = req.body;
  if (!name) return res.status(400).json({ error: "Missing 'name'" });
  try {
    db.prepare("INSERT INTO roles (name, label, description) VALUES (?, ?, ?)").run(name, label, description);
    res.status(201).json({ ok: true, role: { name, label, description } });
  } catch {
    res.status(400).json({ error: "Role already exists" });
  }
});

router.put("/roles/:name", requiresPerm("roles:write"), (req, res) => {
  const { label, description } = req.body;
  if (label === undefined && description === undefined) return res.status(400).json({ error: "Missing 'label' or 'description'" });
  const fields = [];
  const values = [];
  if (label !== undefined) { fields.push("label = ?"); values.push(label); }
  if (description !== undefined) { fields.push("description = ?"); values.push(description); }
  values.push(req.params.name);
  try {
    db.prepare(`UPDATE roles SET ${fields.join(", ")} WHERE name = ?`).run(...values);
    res.json({ ok: true, message: "Role updated", name: req.params.name });
  } catch {
    res.status(404).json({ error: "Role not found" });
  }
});

router.delete("/roles/:name", requiresPerm("roles:write"), (req, res) => {
  if (req.params.name === "admin") return res.status(400).json({ error: "Cannot delete admin role" });
  const result = db.prepare("DELETE FROM roles WHERE name = ?").run(req.params.name);
  if (result.changes === 0) return res.status(404).json({ error: "Role not found" });
  res.json({ ok: true, deleted: req.params.name });
});

router.post("/roles/:name/perms", requiresPerm("roles:write"), (req, res) => {
  const { permission } = req.body;
  if (!permission) return res.status(400).json({ error: "Missing 'permission' in body" });
  try {
    db.prepare("INSERT INTO role_permissions (role, permission) VALUES (?, ?)").run(req.params.name, permission);
    res.json({ ok: true, role: req.params.name, permission });
  } catch {
    res.status(400).json({ error: "Permission already exists for this role" });
  }
});

router.delete("/roles/:name/perms/:permission", requiresPerm("roles:write"), (req, res) => {
  const result = db.prepare("DELETE FROM role_permissions WHERE role = ? AND permission = ?").run(req.params.name, req.params.permission);
  if (result.changes === 0) return res.status(404).json({ error: "Permission not found for role" });
  res.json({ ok: true, deleted: { role: req.params.name, permission: req.params.permission } });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

router.get("/sessions/all", requiresPerm("users:read"), (req, res) => {
  res.json({ ok: true, sessions: tokens.listActive() });
});

router.post("/tokens/cleanup", requiresPerm("users:write"), (req, res) => {
  res.json({ ok: true, ...tokens.cleanup() });
});

// ─── Database CRUD ────────────────────────────────────────────────────────────

function validateTable(table) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error("Invalid table name");
  }
  return table;
}

router.get("/database/tables", requiresPerm("db:read"), (req, res) => {
  try {
    const tables = db.getTables();
    res.json({ ok: true, tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/database/:table/schema", requiresPerm("db:read"), (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const schema = db.prepare(`PRAGMA table_info(${table})`).all();
    res.json({ ok: true, table, schema });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/database/:table", requiresPerm("db:read"), (req, res) => {
  try {
    const table = req.params.table;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    validateTable(table);

    const searchFields = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "limit" && key !== "offset") {
        searchFields[key] = value;
      }
    }

    let rows;
    if (Object.keys(searchFields).length > 0) {
      const conditions = Object.keys(searchFields).map(k => `"${k}" LIKE ?`).join(" AND ");
      const values = Object.values(searchFields).map(v => `%${v}%`);
      rows = db.prepare(`SELECT * FROM ${table} WHERE ${conditions} LIMIT ? OFFSET ?`).all(...values, limit, offset);
    } else {
      rows = db.prepare(`SELECT * FROM ${table} LIMIT ? OFFSET ?`).all(limit, offset);
    }

    res.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/database/:table/:id", requiresPerm("db:read"), (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: "Row not found", id });

    res.json({ ok: true, row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/database/:table", requiresPerm("db:write"), (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body is empty" });
    }

    const table = req.params.table;
    validateTable(table);
    const columns = Object.keys(data);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(data);
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
    const result = db.prepare(sql).run(...values);
    res.status(201).json({ ok: true, id: result.lastInsertRowid, changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/database/:table/:id", requiresPerm("db:write"), (req, res) => {
  try {
    const table = req.params.table;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body is empty" });
    }

    validateTable(table);
    const columns = Object.keys(data).filter(c => c !== "id");
    if (columns.length === 0) return res.status(400).json({ error: "No valid fields to update" });
    const setClause = columns.map(c => `"${c}" = ?`).join(", ");
    const values = [...columns.map(c => data[c]), id];
    const result = db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values);
    if (result.changes === 0) return res.status(404).json({ error: "Row not found", table, id });

    res.json({ ok: true, changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/database/:table/:id", requiresPerm("db:write"), (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    if (result.changes === 0) return res.status(404).json({ error: "Row not found", table, id });

    res.json({ ok: true, deleted: { table, id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
