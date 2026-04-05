/**
 * configStore.js
 * --------------
 * Database-driven config system with in-memory cache.
 *
 * All settings are stored in the `configs` SQLite table.
 * An in-memory cache avoids hitting the DB on every read,
 * but the cache can be invalidated at any time when a setting
 * changes.
 *
 * Usage:
 *   const cfg = require("./config/configStore");
 *
 *   // Read a value (cached)
 *   cfg.get("freepbx.api_url")
 *
 *   // Read with a default fallback
 *   cfg.get("ami.port", 5038)
 *
 *   // Parse as number, boolean, or JSON
 *   cfg.getNumber("database.pool_size")
 *   cfg.getBool("freepbx.enabled")
 *   cfg.getJson("phone_services.softkeys")
 *
 *   // Reload everything from DB (bypass cache)
 *   cfg.reload()
 *
 *   // Invalidate a single key or the whole cache
 *   cfg.invalidate("freepbx.api_url")
 *   cfg.invalidateAll()
 */

const db = require("./db");

// Prepare statements once — reused for the lifetime of the process
const stmtGet = db.prepare('SELECT value FROM "configs" WHERE "key" = ?');
const stmtAll = db.prepare('SELECT * FROM "configs" ORDER BY "group", "key"');
const stmtSet = db.prepare(
  'INSERT INTO "configs" ("key", value, "group", label, "type") VALUES (@key, @value, @group, @label, @type) ' +
  'ON CONFLICT("key") DO UPDATE SET value = @value'
);
const stmtDelete = db.prepare('DELETE FROM "configs" WHERE "key" = ?');

// ─── In-memory cache ──────────────────────────────────────────────────────────
let cache = new Map();

/**
 * Load all config rows from DB into the cache.
 * Called at startup and whenever full reload is needed.
 */
function loadAll() {
  const rows = stmtAll.all();
  cache = new Map();
  for (const row of rows) {
    cache.set(row.key, row);
  }
  return cache.size;
}

/**
 * Get the raw config object for a key.
 * Returns { value, group, label, type } or undefined.
 */
function raw(key) {
  if (!cache.has(key)) {
    // Cache miss — fetch from DB directly
    const row = stmtGet.get(key);
    if (row) {
      cache.set(key, row);
    }
    return row;
  }
  return cache.get(key);
}

/**
 * Get the value of a config key as a string.
 * Returns `fallback` if the key doesn't exist.
 */
function get(key, fallback = undefined) {
  const entry = raw(key);
  return entry ? entry.value : fallback;
}

/**
 * Get the value parsed as a number (float).
 * Returns `fallback` if the key doesn't exist or parsing fails.
 */
function getNumber(key, fallback = undefined) {
  const entry = raw(key);
  if (!entry) return fallback;
  const num = parseFloat(entry.value);
  return isNaN(num) ? fallback : num;
}

/**
 * Get the value parsed as a boolean.
 * Truthy values: "1", "true", "yes", "on" (case-insensitive).
 */
function getBool(key, fallback = false) {
  const entry = raw(key);
  if (!entry) return fallback;
  return ["1", "true", "yes", "on"].includes(entry.value.toLowerCase());
}

/**
 * Get the value parsed as JSON.
 * Useful for arrays or nested objects stored as JSON strings.
 */
function getJson(key, fallback = undefined) {
  const entry = raw(key);
  if (!entry) return fallback;
  try {
    return JSON.parse(entry.value);
  } catch {
    return fallback;
  }
}

/**
 * Set (or update) a config value in both the DB and the cache.
 * If label or type are not provided, they default to blank / "string".
 */
function set(key, value, group = "general", label = "", type = "string") {
  stmtSet.run({
    key,
    value: String(value),
    group,
    label,
    type
  });
  // Update cache immediately
  cache.set(key, { key, value: String(value), group, label, type });
}

/**
 * Delete a config key from both DB and cache.
 */
function del(key) {
  stmtDelete.run(key);
  cache.delete(key);
}

/**
 * Get all config entries, optionally filtered by group.
 */
function all(group) {
  const rows = stmtAll.all();
  if (group) {
    return rows.filter(r => r.group === group);
  }
  return rows;
}

/**
 * Reload everything from DB — bypasses the cache entirely
 * and repopulates it.
 */
function reload() {
  const count = loadAll();
  return { count };
}

/**
 * Invalidate the cache for a specific key (next read hits the DB).
 */
function invalidate(key) {
  cache.delete(key);
}

/**
 * Clear the entire cache (next read hits the DB for everything).
 */
function invalidateAll() {
  cache.clear();
}

// Load all settings at startup
const initialCount = loadAll();
console.log(`[config] Loaded ${initialCount} settings from nexus.db`);

module.exports = {
  get,
  getNumber,
  getBool,
  getJson,
  set,
  del,
  all,
  raw,
  reload,
  invalidate,
  invalidateAll
};
