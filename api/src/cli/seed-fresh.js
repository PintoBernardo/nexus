#!/usr/bin/env node
/**
 * cli/seed-fresh.js
 * ----------------
 * Creates a fresh database with default settings and admin user.
 * ONLY run this on a new install — it deletes the existing database file!
 *
 * Usage:  npm run seed:fresh
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "..", "nexus.db");

if (fs.existsSync(DB_PATH)) {
  console.error("[seed:fresh] nexus.db already exists. Do NOT run this if you have data!");
  console.error("[seed:fresh] Use 'npm run seed' instead to safely update settings without losing data.");
  process.exit(1);
}

// If the DB doesn't exist, just run the normal seed
console.log("[seed:fresh] No existing database found. Running fresh seed...");
require("../utils/seed");
