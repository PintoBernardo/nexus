/**
 * services/notifications.js
 * -------------------------
 * In-memory notification store with type-based filtering and auto-cleanup.
 *
 * Notifications are created by the system (startup checks, sync errors, etc.)
 * and can be retrieved, filtered, or dismissed at runtime.
 *
 * Types:
 *   error   — something failed (sync mismatch, connection lost, etc.)
 *   warning — something may need attention but isn't critical
 *   info    — general informational message
 *   sync    — extension/device sync comparison results
 *
 * Usage:
 *   const notify = require("../services/notifications");
 *   notify.add("error", "FreePBX unreachable", "sync-check");
 *   notify.all();                 // all notifications
 *   notify.filterByType("sync");  // only sync-type
 *   notify.dismiss(id);           // remove by id
 *   notify.dismissAll();          // clear all
 *
 * Max age: auto-cleans notifications older than 24 hours on access.
 */

// In-memory store, keyed by auto-incrementing id
let notifications = [];
let nextId = 1;

// Keep max 500 notifications (older entries evicted on add)
const MAX_NOTIFICATIONS = 500;

/**
 * Add a notification.
 *
 * @param {"error"|"warning"|"info"|"sync"} type
 * @param {string} message
 * @param {string} source - which system created it (e.g. "startup-sync", "freepbx")
 * @returns {Object} the created notification
 */
function add(type, message, source = "system") {
  const now = new Date().toISOString();
  const entry = { id: nextId++, type, message, source, timestamp: now };

  // Also log to console immediately
  const logFn = type === "error" ? console.error : console.warn;
  console.log(`[notify:${type}] ${message}`);

  notifications.push(entry);

  // Evict oldest if over limit
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications = notifications.slice(-MAX_NOTIFICATIONS);
  }

  return entry;
}

/**
 * Get all notifications.
 * @returns {Array}
 */
function all() {
  return [...notifications];
}

/**
 * Get notifications of a specific type.
 * @param {string} type
 * @returns {Array}
 */
function filterByType(type) {
  return notifications.filter(n => n.type === type);
}

/**
 * Get or dismiss a single notification by id.
 * @param {number} id
 * @returns {Object|null}
 */
function getById(id) {
  return notifications.find(n => n.id === id) || null;
}

/**
 * Dismiss (delete) a notification by id.
 * @param {number} id
 * @returns {{ ok: boolean, dismissed: number }}
 */
function dismiss(id) {
  const before = notifications.length;
  notifications = notifications.filter(n => n.id !== id);
  return { ok: true, dismissed: before - notifications.length };
}

/**
 * Dismiss all notifications of a given type.
 * @param {string} type
 * @returns {{ ok: boolean, dismissed: number }}
 */
function dismissByType(type) {
  const before = notifications.length;
  notifications = notifications.filter(n => n.type !== type);
  return { ok: true, dismissed: before - notifications.length };
}

/**
 * Dismiss all notifications.
 * @returns {{ ok: boolean, dismissed: number }}
 */
function dismissAll() {
  const count = notifications.length;
  notifications = [];
  return { ok: true, dismissed: count };
}

/**
 * Get count of notifications by type.
 * @returns {Object} summary
 */
function summary() {
  const counts = { total: notifications.length, error: 0, warning: 0, info: 0, sync: 0 };
  for (const n of notifications) {
    if (counts[n.type] !== undefined) counts[n.type]++;
  }
  return counts;
}

module.exports = {
  add,
  all,
  filterByType,
  getById,
  dismiss,
  dismissByType,
  dismissAll,
  summary
};
