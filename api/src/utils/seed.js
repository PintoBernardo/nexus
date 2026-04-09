/**
 * seed.js
 * -------
 * Safe to run multiple times — NEVER deletes or overwrites user data.
 * Creates: configs (only if missing), roles, permissions, admin user.
 *
 * Run: npm run seed
 */

const db = require("../config/db");
const cfg = require("../config/configStore");
const bcrypt = require("bcrypt");

// ── Helper: set config ONLY if it doesn't exist yet ─────────────────────────
function seedConfig(key, value, group, label, type) {
  const existing = db.prepare("SELECT key FROM configs WHERE key = ?").get(key);
  if (existing) return; // user changed it — do NOT overwrite
  cfg.set(key, value, group, label, type);
}

// ── Auth settings ─────────────────────────────────────────────────────────────
seedConfig("auth.jwt_secret", "nexus-uc-secret-change-in-production", "auth", "JWT signing secret", "secret");
seedConfig("auth.jwt_expiry", "24h", "auth", "JWT token lifetime");

// ── Server ───────────────────────────────────────────────────────────────────
seedConfig("server.host", "0.0.0.0", "server", "Bind address");
seedConfig("server.port", "8000", "server", "HTTP listen port", "number");

// ── FreePBX ──────────────────────────────────────────────────────────────────
seedConfig("freepbx.enabled", "true", "freepbx", "Enable FreePBX integration", "boolean");
seedConfig("freepbx.api_url", "http://127.0.0.1", "freepbx", "FreePBX API base URL");
seedConfig("freepbx.client_id", "client_id", "freepbx", "FreePBX OAuth client ID", "secret");
seedConfig("freepbx.client_secret", "client_secret", "freepbx", "FreePBX OAuth client secret", "secret");

// ── AMI ─────────────────────────────────────────────────────────────────────
seedConfig("ami.enabled", "true", "ami", "Enable AMI integration", "boolean");
seedConfig("ami.host", "127.0.0.1", "ami", "AMI server host");
seedConfig("ami.port", "5038", "ami", "AMI server port", "number");
seedConfig("ami.username", "admin", "ami", "AMI login username");
seedConfig("ami.secret", "amp111", "ami", "AMI login secret", "secret");
seedConfig("ami.events", "on", "ami", "Subscribe to AMI events");
seedConfig("ami.timeout", "15", "ami", "Command timeout in seconds", "number");

// ── Services Server ────────────────────────────────────────────────────────
seedConfig("services.host", "0.0.0.0", "services", "Phone Services bind address");
seedConfig("services.port", "8001", "services", "Phone Services HTTP listen port", "number");

// ── Cache ────────────────────────────────────────────────────────────────────
seedConfig("cache.router_expire", "300", "cache", "Default router cache TTL in seconds", "number");

// ── Roles (INSERT OR IGNORE, safe to rerun) ─────────────────────────────────────────────
db.prepare("INSERT OR IGNORE INTO roles (name, label, description) VALUES (?, ?, ?)").run("admin", "Administrator", "Full access — all permissions");
db.prepare("INSERT OR IGNORE INTO roles (name, label, description) VALUES (?, ?, ?)").run("manager", "Manager", "Manage users, extensions, devices, read-only DB");
db.prepare("INSERT OR IGNORE INTO roles (name, label, description) VALUES (?, ?, ?)").run("operator", "Operator", "Read-only access to most endpoints");
db.prepare("INSERT OR IGNORE INTO roles (name, label, description) VALUES (?, ?, ?)").run("user", "Standard User", "Basic access — configs and health");
console.log("[seed] Roles created (skipped if exist)");

// ── Role permissions ────────────────────────────────────────────────────────
const perm = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");

// admin → wildcard
perm.run("admin", "*");

// manager
perm.run("manager", "users:read");
perm.run("manager", "users:write");
perm.run("manager", "users:delete");
perm.run("manager", "extensions:read");
perm.run("manager", "extensions:write");
perm.run("manager", "extensions:delete");
perm.run("manager", "devices:read");
perm.run("manager", "devices:write");
perm.run("manager", "devices:delete");
perm.run("manager", "ringgroups:read");
perm.run("manager", "ringgroups:write");
perm.run("manager", "ringgroups:delete");
perm.run("manager", "db:read");
perm.run("manager", "freepbx:read");
perm.run("manager", "ami:read");
perm.run("manager", "ami:write");
perm.run("manager", "configs:read");
perm.run("manager", "configs:write");
perm.run("manager", "roles:read");
perm.run("manager", "roles:write");
perm.run("manager", "health:read");
perm.run("manager", "services:read");
perm.run("manager", "services:write");

// operator
perm.run("operator", "users:read");
perm.run("operator", "extensions:read");
perm.run("operator", "devices:read");
perm.run("operator", "ringgroups:read");
perm.run("operator", "configs:read");
perm.run("operator", "db:read");
perm.run("operator", "freepbx:read");
perm.run("operator", "ami:read");
perm.run("operator", "ami:write");
perm.run("operator", "roles:read");
perm.run("operator", "health:read");
perm.run("operator", "services:read");

// user
perm.run("user", "services:read");
perm.run("user", "extensions:read");
console.log("[seed] Permissions created (skipped if exist)");

// ── Default admin user ──────────────────────────────────────────────────────
async function seedAdmin() {
  const existing = db.prepare("SELECT id, username, suspended FROM users WHERE username = 'admin'").get();
  if (existing) {
    console.log(`[seed] Admin user exists (id=${existing.id}, suspended=${existing.suspended}) — skipping`);
    return;
  }

  const hash = await bcrypt.hash("admin", 12);
  const result = db.prepare(
    "INSERT INTO users (username, email, password, first_name, last_name, phone, role, suspended) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
  ).run("admin", "admin@nexus.local", hash, "System", "Administrator", "", "admin");

  console.log(`[seed] Admin user created: admin / admin (id: ${result.lastInsertRowid})`);
}

seedAdmin().then(() => {
  console.log("[seed] Done. Configs, roles, permissions, and admin user ready.");
});
