/**
 * services/config.js
 * ------------------
 * Shared configuration and helpers for the Cisco Phone Services server.
 *
 * Provides:
 *   - Database connection (read-only to nexus.db)
 *   - API client functions (apiGet, apiPost) to talk to the JSON backend
 *   - Service enable/disable checks via services_status table
 *   - URL base helper for building service URLs
 */

const path = require("path");
const http = require("http");
const Database = require("better-sqlite3");

// ─── Database ─────────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, "..", "nexus.db");
const db = new Database(DB_PATH, { readonly: true });
db.pragma("journal_mode = WAL");

// ─── API Client ───────────────────────────────────────────────────────────────

const API_BASE = `http://127.0.0.1:${process.env.NEXUS_API_PORT || 8000}`;

/**
 * Make a GET request to the JSON API backend.
 * @param {string} urlPath - Path starting with /api/...
 * @returns {Promise<{status: number, body: object}>}
 */
function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}${urlPath}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          reject(new Error(`Bad API response: ${data.substring(0, 200)}`));
        }
      });
    }).on("error", reject);
  });
}

/**
 * Make a POST request to the JSON API backend.
 * @param {string} urlPath - Path starting with /api/...
 * @param {object} body - JSON payload
 * @returns {Promise<{status: number, body: object}>}
 */
function apiPost(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${urlPath}`);
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            reject(new Error(`Bad API response: ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── Service Status Helpers ───────────────────────────────────────────────────

/**
 * Check if a service is enabled by reading the services_status table.
 * @param {string} name - Service name (e.g. "directory")
 * @returns {boolean}
 */
function isServiceEnabled(name) {
  try {
    const row = db
      .prepare("SELECT enabled FROM services_status WHERE name = ?")
      .get(name);
    return row ? row.enabled === 1 : false;
  } catch {
    return false;
  }
}

/**
 * Get a service's display label from the services_status table.
 * @param {string} name - Service name
 * @param {string} fallback - Default label if not found
 * @returns {string}
 */
function getServiceLabel(name, fallback) {
  try {
    const row = db
      .prepare("SELECT label FROM services_status WHERE name = ?")
      .get(name);
    return row ? row.label : fallback;
  } catch {
    return fallback;
  }
}

// ─── URL Helpers ──────────────────────────────────────────────────────────────

/**
 * Build the base URL for services from an incoming request.
 * @param {object} req - Express request object
 * @returns {string} e.g. "http://host:8001/services"
 */
function serviceBase(req) {
  return `${req.protocol}://${req.get("host")}/services`;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  db,
  API_BASE,
  apiGet,
  apiPost,
  isServiceEnabled,
  getServiceLabel,
  serviceBase,
};
