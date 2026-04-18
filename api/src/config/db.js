/**
 * db.js
 * -----
 * SQLite database connection and schema management using better-sqlite3.
 *
 * This module is the single source of truth for the database layer.
 * It creates the database file if it doesn't exist, manages the
 * `configs` table, and applies schema migrations automatically on startup.
 *
 * Schema versioning:
 *   The `_schema_version` key in the `configs` table tracks the
 *   current database version. Each migration bumps the version
 *   number and only runs if the current version is below the target.
 *
 * Tables:
 *   configs         — key/value store for all Nexus settings
 *   users           — auth system (admin/user roles, SSO-ready)
 *   extensions      — phone extensions tied to users (sip/sccp/pjsip)
 *   devices         — physical phone devices tied to users
 *   phone_models    — Cisco phone model specifications
 *
 * Usage:
 *   const db = require("./config/db");
 *   // db is a ready-to-use Database instance
 *
 * Adding data without dropping the DB:
 *   Use the /api/db/* endpoints to CRUD any table at runtime.
 *   Or use the seed.js helpers — data is inserted via SQL, not migrations.
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
// Add new migrations at any point in the array, incrementing the index.

const MIGRATIONS = [
  // ── Migration 1: configs table ───────────────────────────────────────────
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
  },

  // ── Migration 2: users table ─────────────────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        username    TEXT NOT NULL UNIQUE,
        email       TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        first_name  TEXT DEFAULT '',
        last_name   TEXT DEFAULT '',
        phone       TEXT DEFAULT '',
        role        TEXT NOT NULL DEFAULT 'user',
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  // ── Migration 3: extensions table ────────────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS extensions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('sip', 'sccp', 'pjsip')),
        extension   TEXT NOT NULL UNIQUE,
        secret      TEXT DEFAULT '',
        display_name TEXT DEFAULT '',
        context     TEXT NOT NULL DEFAULT 'from-internal',
        enabled     INTEGER NOT NULL DEFAULT 1,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ext_user ON extensions(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ext_extension ON extensions(extension)`);
  },

  // ── Migration 4: devices table ───────────────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL,
        mac_address     TEXT NOT NULL UNIQUE,
        ip_address      TEXT DEFAULT '',
        model           TEXT NOT NULL,
        hostname        TEXT DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'unregistered',
        last_registered DATETIME,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (model) REFERENCES phone_models(model) ON DELETE RESTRICT
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_dev_user ON devices(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_dev_mac ON devices(mac_address)`);
  },

  // ── Migration 5: phone_models table ──────────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS phone_models (
        model             TEXT PRIMARY KEY,
        manufacturer      TEXT NOT NULL DEFAULT 'Cisco',
        screen_resolution TEXT DEFAULT '',
        screen_size       TEXT DEFAULT '',
        screen_color      TEXT DEFAULT '',
        num_lines         INTEGER DEFAULT 0,
        num_softkeys      INTEGER DEFAULT 0,
        num_line_keys     INTEGER DEFAULT 0,
        expansion_module  TEXT NOT NULL DEFAULT 'none',
        has_wifi          INTEGER NOT NULL DEFAULT 0,
        has_poe           INTEGER NOT NULL DEFAULT 0,
        has_bluetooth     INTEGER NOT NULL DEFAULT 0,
        usb_ports         INTEGER NOT NULL DEFAULT 0,
        network_ports     INTEGER NOT NULL DEFAULT 1,
        form_factor       TEXT DEFAULT '',
        protocol          TEXT DEFAULT 'sccp',
        notes             TEXT DEFAULT ''
      )
    `);
  },

  // ── Migration 6: roles table ─────────────────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        name        TEXT PRIMARY KEY,
        label       TEXT NOT NULL DEFAULT '',
        description TEXT DEFAULT '',
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  },

  // ── Migration 7: role_permissions table ──────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        role       TEXT NOT NULL,
        permission TEXT NOT NULL,
        UNIQUE(role, permission),
        FOREIGN KEY (role) REFERENCES roles(name) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_role_perm ON role_permissions(role)`);
  },

  // ── Migration 8: add suspended column to users ───────────────────────────
  () => {
    db.exec(`
      ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0
    `);
    console.log("[db] Migration 8: added 'suspended' to users");
  },

  // ── Migration 9: tokens table — active sessions + last 5 per user ────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        token_hash  TEXT NOT NULL UNIQUE,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at  DATETIME NOT NULL,
        last_used   DATETIME,
        is_active   INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_token_user ON tokens(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_token_hash ON tokens(token_hash)`);
    console.log("[db] Migration 9: created 'tokens' table");
  },

  // ── Migration 10: ring_groups + ring_group_members ───────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ring_groups (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL UNIQUE,
        strategy      TEXT NOT NULL DEFAULT 'ringall',
        description   TEXT DEFAULT '',
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS ring_group_members (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        ring_group_id INTEGER NOT NULL,
        extension_id  INTEGER NOT NULL,
        priority      INTEGER NOT NULL DEFAULT 0,
        UNIQUE(ring_group_id, extension_id),
        FOREIGN KEY (ring_group_id) REFERENCES ring_groups(id) ON DELETE CASCADE,
        FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_rgm_group ON ring_group_members(ring_group_id)`);
    console.log("[db] Migration 10: created 'ring_groups' and 'ring_group_members' tables");
  },

  // ── Migration 11: personal_directory + services_pin ──────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS personal_directory (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL UNIQUE,
        entries       TEXT NOT NULL DEFAULT '[]',
        secure        INTEGER NOT NULL DEFAULT 0,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      ALTER TABLE users ADD COLUMN services_pin TEXT DEFAULT NULL
    `);
    console.log("[db] Migration 11: created 'personal_directory' table, added 'services_pin' to users");
  },

  // ── Migration 12: services_status table ──────────────────────────────────
  () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS services_status (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL UNIQUE,
        label         TEXT NOT NULL DEFAULT '',
        description   TEXT DEFAULT '',
        enabled       INTEGER NOT NULL DEFAULT 1,
        url           TEXT DEFAULT '',
        port          INTEGER DEFAULT 0,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Seed default services
    db.exec(`INSERT OR IGNORE INTO services_status (name, label, description, enabled, url, port) VALUES
      ('directory', 'Directory', 'Personal and Corporate phone directory', 1, '/services/directory', 8001),
      ('quality_report', 'Quality Report', 'Call quality reporting service', 0, '/services/quality-report', 8001),
      ('problem_report', 'Problem Report', 'Problem reporting service', 0, '/services/problem-report', 8001)
    `);
    console.log("[db] Migration 12: created 'services_status' table with default services");
  }
];

// ─── Migration engine ─────────────────────────────────────────────────────────

/**
 * Apply all pending migrations that haven't been run yet.
 * Reads the current version from the configs table (defaulting to 0),
 * then runs each migration in order until the schema is up to date.
 */
function applyMigrations() {
  // Migration 1 must run first to create the configs table
  let currentVersion = 0;
  try {
    const row = db.prepare("SELECT value FROM configs WHERE key = '_schema_version'").get();
    if (row) currentVersion = parseInt(row.value, 10);
  } catch {
    // configs table doesn't exist yet — run migration 1 first
    if (currentVersion < 1) {
      MIGRATIONS[0]();
      currentVersion = 1;
    }
  }

  // Helper to persist the version number
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

// Run migrations on startup
applyMigrations();

/**
 * Return a list of all table names in the database.
 */
function getTables() {
  const rows = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();
  return rows.map(r => r.name);
}

/**
 * Return the schema (columns) for a given table.
 */
function getTableSchema(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

// ── Migration 13: extensions first_name/last_name ─────────────────────────────
function migrateExtensionsNames() {
  const schema = getTableSchema("extensions");
  const cols = schema.map(c => c.name);
  
  if (!cols.includes("first_name")) {
    db.exec("ALTER TABLE extensions ADD COLUMN first_name TEXT DEFAULT ''");
    console.log("[db] Migration 13: added 'first_name' to extensions");
  }
  if (!cols.includes("last_name")) {
    db.exec("ALTER TABLE extensions ADD COLUMN last_name TEXT DEFAULT ''");
    console.log("[db] Migration 13: added 'last_name' to extensions");
  }
}
migrateExtensionsNames();

module.exports = db;
module.exports.getTables = getTables;
module.exports.getTableSchema = getTableSchema;
