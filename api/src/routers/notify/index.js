/**
 * routers/notify/index.js
 * -----------------------
 * Notification management API.
 *
 * Notifications are system-generated messages (sync mismatches, connection errors,
 * startup warnings) stored in-memory with type-based filtering and a web-accessible
 * endpoint for viewing them from the terminal or UI.
 *
 * Types: error, warning, info, sync
 *
 * Endpoints:
 *   GET    /api/admin/system/notifications             — List all notifications (or ?type=X for filter)
 *   GET    /api/admin/system/notifications/summary     — Count of notifications by type
 *   DELETE /api/admin/system/notifications/:id         — Dismiss a single notification
 *   DELETE /api/admin/system/notifications?type=X     — Dismiss all notifications of a type
 *   DELETE /api/admin/system/notifications/all         — Dismiss all notifications
 */

const express = require("express");
const notify = require("../../services/notifications");
const { requiresPerm } = require("../../middleware/auth");
const router = express.Router();

router.get("/", requiresPerm("system:read"), (req, res) => {
  const type = req.query.type;
  if (type) {
    const filtered = notify.filterByType(type);
    return res.json({ ok: true, type, count: filtered.length, notifications: filtered });
  }
  const all = notify.all();
  res.json({ ok: true, count: all.length, notifications: all });
});

router.get("/summary", requiresPerm("system:read"), (req, res) => {
  res.json({ ok: true, ...notify.summary() });
});

router.delete("/all", requiresPerm("system:write"), (req, res) => {
  res.json(notify.dismissAll());
});

router.delete("/", requiresPerm("system:write"), (req, res) => {
  const type = req.query.type;
  if (type) return res.json(notify.dismissByType(type));
  return res.json(notify.dismissAll());
});

router.delete("/:id", requiresPerm("system:write"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  res.json(notify.dismiss(id));
});

module.exports = router;
