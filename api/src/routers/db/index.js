/**
 * routers/db/index.js
 * -----------------
 * Universal CRUD API for every database table.
 * Lets you add, query, update, and delete data from any table at runtime.
 *
 * Read endpoints: require db:read permission
 * Write endpoints: require db:write permission (admin always passes)
 *
 * GET    /api/admin/system/database/tables                         — List all tables
 * GET    /api/admin/system/database/:table/schema                 — Get table structure
 * POST   /api/admin/system/database/:table                        — Insert a row
 * GET    /api/admin/system/database/:table?limit=50&offset=0     — List rows
 * GET    /api/admin/system/database/:table/:id                    — Get a row by ID
 * PUT    /api/admin/system/database/:table/:id                    — Update a row
 * DELETE /api/admin/system/database/:table/:id                     — Delete a row
 * GET    /api/admin/system/database/:table/search?field=value     — Search rows
 */

const express = require("express");
const db = require("../../config/db");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

function validateTable(table) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error("Invalid table name");
  }
  return table;
}

function insertRow(table, data) {
  validateTable(table);
  const columns = Object.keys(data);
  const placeholders = columns.map(() => "?").join(", ");
  const values = Object.values(data);
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  return db.prepare(sql).run(...values);
}

function updateRow(table, id, data) {
  validateTable(table);
  const columns = Object.keys(data).filter(c => c !== "id");
  if (columns.length === 0) return { changes: 0 };
  const setClause = columns.map(c => `"${c}" = ?`).join(", ");
  const values = [...columns.map(c => data[c]), id];
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  return db.prepare(sql).run(...values);
}

router.get("/tables", requiresPerm("db:read"), (req, res) => {
  try {
    const tables = db.getTables();
    res.json({ ok: true, tables });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:table/schema", requiresPerm("db:read"), (req, res) => {
  try {
    const table = validateTable(req.params.table);
    const schema = db.prepare(`PRAGMA table_info(${table})`).all();
    res.json({ ok: true, table, schema });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:table", requiresPerm("db:write"), (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body is empty" });
    }

    const result = insertRow(req.params.table, data);
    res.status(201).json({ ok: true, id: result.lastInsertRowid, changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:table", requiresPerm("db:read"), (req, res) => {
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

router.get("/:table/:id", requiresPerm("db:read"), (req, res) => {
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

router.put("/:table/:id", requiresPerm("db:write"), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body is empty" });
    }

    const result = updateRow(req.params.table, id, data);
    if (result.changes === 0) return res.status(404).json({ error: "Row not found", table: req.params.table, id });

    res.json({ ok: true, changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:table/:id", requiresPerm("db:write"), (req, res) => {
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
