/**
 * db.js
 * -----
 * SQLite database connection and schema management using better-sqlite3.
 *
 * This module is the single source of truth for the database layer.
 * It creates the database file if it doesn't exist, manages the
 * `configs` table, and applies any future schema migrations
 * automatically on startup.
 *
 * Schema versioning:
 *   The `schema_version` key in the `configs` table tracks the
 *   current database version. Each migration bumps the version
 *   number and only runs if the current version is below the target.
 *
 * Tables:
 *   configs — key/value store for all Nexus settings
 *     key    TEXT PRIMARY KEY  — unique identifier (e.g. "freepbx.api_url")
 *     value  TEXT              — current value
 *     "group" TEXT             — logical group (e.g. "database", "freepbx", "ami")
 *     label  TEXT              — human-readable description
 *     "type" TEXT              — data type hint: "string"|"number"|"boolean"|"secret"
 *
 * Usage:
 *   const db = require("./config/db");
 *   // db is a ready-to-use Database instance
 */

const Database = require("better-sqlite3");
const path = require("path");

// Database file lives in the project root
const DB_PATH = path.join(__dirname, "..", "..", "..", "nexus.db");

// Open (or create) the database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Foreign keys enforcement
db.pragma("foreign_keys = ON");

// ─── Schema migrations ────────────────────────────────────────────────────────
// Each migration is a function that runs once when the version is below its target.
// Add new migrations here, incrementing the version number.

const MIGRATIONS = [
  // Migration 1: Create the configs table (initial schema)
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS configs (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        "group" TEXT NOT NULL DEFAULT 'general',
        label  TEXT NOT NULL DEFAULT '',
        "type" TEXT NOT NULL DEFAULT 'string'
      )
    `);
  }

  // Migration 2: (add future migrations here, e.g. phone_extensions, tftp_configs, etc.)
  // Migration 3: ...
];

/**
 * Apply all pending migrations that haven't been run yet.
 * Reads the current version from the configs table (defaulting to 0),
 * then runs each migration in order until the schema is up to date.
 */
function applyMigrations() {
  // If the configs table doesn't exist yet, create it first so we can track versions
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='configs'"
  ).get();

  if (!tableExists) {
    // Run migration 1 to create configs
    MIGRATIONS[0]();
  }

  // Read current schema version (stored as a special config key)
  let versionStmt;
  try {
    versionStmt = db.prepare("SELECT value FROM configs WHERE key = '_schema_version'").get();
  } catch {
    // configs table likely doesn't exist yet — force first migration
    MIGRATIONS[0]();
    versionStmt = db.prepare("SELECT value FROM configs WHERE key = '_schema_version'").get();
  }

  const currentVersion = versionStmt ? parseInt(versionStmt.value, 10) : 0;

  const setVersion = db.prepare(
    "INSERT OR REPLACE INTO configs (key, value, \"group\", label, \"type\") VALUES (@key, @value, @group, @label, @type)"
  );

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    console.log(`[db] Applying migration ${i + 1}...`);
    MIGRATIONS[i]();
    setVersion.run({
      key: "_schema_version",
      value: String(i + 1),
      group: "_system",
      label: "Database schema version",
      type: "number"
    });
  }

  if (currentVersion >= MIGRATIONS.length) {
    console.log(`[db] Schema is up to date (version ${MIGRATIONS.length})`);
  } else {
    console.log(`[db] Migrations complete: version ${currentVersion} -> ${MIGRATIONS.length}`);
  }
}

// Run all migrations on startup
applyMigrations();

module.exports = db;
