/**
 * services/tokens.js
 * ------------------
 * Tracks active JWT sessions in the database.
 *
 * Every login / register stores the token hash in the `tokens` table.
 * Only the latest 5 tokens per user are active — older ones are deactivated.
 * Expired tokens are cleaned up on every check.
 *
 * Usage:
 *   const tokens = require("../services/tokens");
 *
 *   const tok = await tokens.record(userId, jwtString, expiresAt);
 *   const ok = await tokens.verify(token); // null if expired/revoked
 *   await tokens.revoke(userId, tokenHash);
 *   await tokens.revokeAll(userId);
 *   await tokens.cleanup();
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const cfg = require("../config/configStore");

function getSecret() {
  return cfg.get("auth.jwt_secret", "nexus-uc-secret-change-in-production");
}

// ─── Prepared statements ──────────────────────────────────────────────────────
const stmtInsertToken = db.prepare(
  "INSERT INTO tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
);
const stmtGetToken = db.prepare(
  "SELECT * FROM tokens WHERE token_hash = ?"
);
const stmtUpdateLastUsed = db.prepare(
  "UPDATE tokens SET last_used = CURRENT_TIMESTAMP WHERE id = ?"
);
const stmtDeactivateOldTokens = db.prepare(
  `UPDATE tokens SET is_active = 0
   WHERE user_id = ? AND is_active = 1
   AND id NOT IN (
     SELECT id FROM tokens
     WHERE user_id = ? AND is_active = 1
     ORDER BY created_at DESC
     LIMIT 5
   )`
);
const stmtRevokeToken = db.prepare(
  "UPDATE tokens SET is_active = 0 WHERE user_id = ? AND token_hash = ?"
);
const stmtRevokeAll = db.prepare(
  "UPDATE tokens SET is_active = 0 WHERE user_id = ? AND is_active = 1"
);
const stmtDeactivateExpired = db.prepare(
  "UPDATE tokens SET is_active = 0 WHERE expires_at < CURRENT_TIMESTAMP AND is_active = 1"
);
const stmtDeleteExpired = db.prepare(
  "DELETE FROM tokens WHERE expires_at < date('now', '-7 days')"
);
const stmtActiveTokens = db.prepare(
  "SELECT t.id, t.user_id, t.created_at, t.expires_at, t.last_used, t.is_active, " +
  "u.username, u.email, u.role FROM tokens t JOIN users u ON t.user_id = u.id WHERE t.is_active = 1 ORDER BY t.created_at DESC"
);
const stmtUserTokens = db.prepare(
  "SELECT id, created_at, expires_at, last_used, is_active FROM tokens WHERE user_id = ? ORDER BY created_at DESC"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a SHA-256 hash of a token for storage.
 * We store the hash, never the raw JWT.
 *
 * @param {string} tokenString — raw JWT string
 * @returns {string} SHA-256 hex digest
 */
function hashToken(tokenString) {
  return crypto.createHash("sha256").update(tokenString).digest("hex");
}

// Expose hashToken for auth router logout endpoint
module.exports._hashToken = hashToken;

/**
 * Record a new token in the DB, then deactivate any token
 * older than the last 5 for this user.
 *
 * @param {number} userId     — the user ID
 * @param {string} jwtToken   — the raw JWT string
 * @param {string} expiresAt  — ISO date string (e.g. "2026-04-06T12:00:00Z")
 */
function record(userId, jwtToken, expiresAt) {
  const tokenHash = hashToken(jwtToken);
  const result = stmtInsertToken.run(userId, tokenHash, expiresAt);

  // Keep only the last 5 active tokens per user
  stmtDeactivateOldTokens.run(userId, userId);

  return { ok: true, id: result.lastInsertRowid };
}

/**
 * Verify a JWT and check if it's an active session.
 * Returns the decoded payload or null if invalid/expired/revoked.
 */
function verify(token) {
  // First check DB — if the hash is deactivated or expired, reject immediately
  const h = hashToken(token);
  const row = stmtGetToken.get(h);
  if (row) {
    if (!row.is_active) return null; // revoked or too old
    // Update last_used
    stmtUpdateLastUsed.run(row.id);
  }

  // Verify JWT signature and expiry
  try {
    const payload = jwt.verify(token, getSecret());
    // Double-check DB status
    if (row && !row.is_active) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Revoke a specific token for a user.
 */
function revoke(userId, tokenString) {
  stmtRevokeToken.run(userId, hashToken(tokenString));
  return { ok: true };
}

/**
 * Revoke all active tokens for a user (force logout everywhere).
 */
function revokeAll(userId) {
  const result = stmtRevokeAll.run(userId);
  return { ok: true, revoked: result.changes };
}

/**
 * Clean up: deactivate expired tokens and delete tokens older than 7 days.
 */
function cleanup() {
  const expired = stmtDeactivateExpired.run();
  const deleted = stmtDeleteExpired.run();
  return { deactivated: expired.changes, deleted: deleted.changes };
}

/**
 * List all active sessions across all users (admin).
 */
function listActive() {
  return stmtActiveTokens.all();
}

/**
 * List all tokens (active + inactive) for a specific user.
 */
function userTokens(userId) {
  return stmtUserTokens.all(userId);
}

// ─── Auto-cleanup every 5 minutes ─────────────────────────────────────────────
setInterval(() => {
  const result = cleanup();
  if (result.deactivated + result.deleted > 0) {
    console.log(`[tokens] Cleanup: ${result.deactivated} expired, ${result.deleted} deleted`);
  }
}, 5 * 60 * 1000);

module.exports = {
  record,
  verify,
  revoke,
  revokeAll,
  listActive,
  userTokens,
  cleanup
};
