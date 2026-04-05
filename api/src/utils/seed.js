/**
 * seed.js
 * -------
 * Populates the `configs` table with default Nexus settings.
 * Run with: npm run seed
 *
 * Every value here can later be changed from the database or API
 * — nothing is hardcoded. The config cache will auto-reload.
 */

const cfg = require("../config/configStore");

// ── Server ───────────────────────────────────────────────────────────────────
cfg.set("server.host", "0.0.0.0", "server", "Bind address");
cfg.set("server.port", "8000", "server", "HTTP listen port", "number");

// ── FreePBX API ──────────────────────────────────────────────────────────────
cfg.set("freepbx.enabled", "true", "freepbx", "Enable FreePBX integration", "boolean");
cfg.set("freepbx.api_url", "http://127.0.0.1", "freepbx", "FreePBX API base URL");
cfg.set("freepbx.client_id", "freepbx", "freepbx", "FreePBX OAuth client ID", "secret");
cfg.set("freepbx.client_secret", "freepbx", "freepbx", "FreePBX OAuth client secret", "secret");

// ── AMI (Asterisk Manager Interface) ────────────────────────────────────────
cfg.set("ami.enabled", "true", "ami", "Enable AMI integration", "boolean");
cfg.set("ami.host", "127.0.0.1", "ami", "AMI server host");
cfg.set("ami.port", "5038", "ami", "AMI server port", "number");
cfg.set("ami.username", "admin", "ami", "AMI login username");
cfg.set("ami.secret", "amp111", "ami", "AMI login secret", "secret");
cfg.set("ami.events", "on", "ami", "Subscribe to AMI events");
cfg.set("ami.timeout", "15", "ami", "Command timeout in seconds", "number");

// ── Cache ────────────────────────────────────────────────────────────────────
cfg.set("cache.router_expire", "300", "cache", "Default router cache TTL in seconds", "number");

console.log("[seed] Done. All default settings written to nexus.db");
