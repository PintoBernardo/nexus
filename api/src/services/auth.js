/**
 * services/auth.js
 * ----------------
 * Authentication with multi-role permission system.
 *
 * All users stored in DB. Admin ROLE always passes perm checks in hasPermission.
 * Suspended users = zero permissions.
 *
 * JWT tokens tracked in the `tokens` table by services/tokens.js.
 *
 * Usage:
 *   const auth = require("../services/auth");
 *   const profile = await auth.login(username, password); // records token
 *   const tokenObj = await auth.login(username, password); // returns { token, profile }
 *   const has = auth.hasPermission("manager", "db:write");
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const cfg = require("../config/configStore");
const tokens = require("./tokens");

function getSecret() {
  return cfg.get("auth.jwt_secret", "nexus-uc-secret-change-in-production");
}

function getTokenExpiry() {
  return cfg.get("auth.jwt_expiry", "24h");
}

// Expose getSecret for token service JWT verification
module.exports._getSecret = getSecret;

// ─── Prepared statements ─────────────────────────────────────────────────────────────────────
const stmtInsertUser = db.prepare(
  "INSERT INTO users (username, email, password, first_name, last_name, phone, role, suspended) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);
const stmtGetUser = db.prepare(
  "SELECT id, username, email, password, first_name, last_name, phone, role, suspended FROM users WHERE username = ? OR email = ?"
);
const stmtGetPermissions = db.prepare(
  "SELECT permission FROM role_permissions WHERE role = ?"
);
const stmtUpdateUser = db.prepare(
  'UPDATE users SET "role" = ?, suspended = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
);
const stmtDeleteUser = db.prepare("DELETE FROM users WHERE id = ?");
const stmtGetAllUsers = db.prepare(
  "SELECT id, username, email, first_name, last_name, phone, role, suspended, created_at, updated_at FROM users ORDER BY id"
);

// ─── Permission engine ──────────────────────────────────────────────────────
function hasPermission(role, permission, suspended = false) {
  if (suspended) return false;
  if (role === "admin") return true;
  const perms = stmtGetPermissions.all(role);
  return perms.some(p => p.permission === permission || p.permission === "*");
}

function getPermissions(role) {
  if (role === "admin") return ["*"];
  return stmtGetPermissions.all(role).map(p => p.permission);
}

// ─── User management ────────────────────────────────────────────────────────
async function createUser({ username, email, password, firstName = "", lastName = "", phone = "", role = "user", suspended = 0 }) {
  const existing = db.prepare("SELECT id FROM users WHERE username = ? OR email = ?").get(username, email);
  if (existing) throw new Error(`User already exists: username=${username} or email=${email}`);

  const hash = await bcrypt.hash(password, 12);
  const result = stmtInsertUser.run(username, email, hash, firstName, lastName, phone, role, suspended ? 1 : 0);

  return {
    id: result.lastInsertRowid,
    username, email,
    firstName, lastName, phone,
    role,
    suspended: false
  };
}

/**
 * Login with username and password.
 * Automatically records the JWT token in the tokens table.
 * Returns: { token, profile }
 */
async function login(username, password) {
  const user = stmtGetUser.get(username, username);
  if (!user) throw new Error("Invalid credentials");
  if (user.suspended) throw new Error("Account is suspended");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  const profile = {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    role: user.role,
    isAdmin: user.role === "admin",
    suspended: false
  };

  // Issue JWT
  const jwtToken = jwt.sign(profile, getSecret(), { expiresIn: getTokenExpiry() });

  // Decode the JWT to get the actual expiry date for token tracking
  const decoded = jwt.decode(jwtToken);
  const expiresAt = new Date(decoded.exp * 1000).toISOString();

  // Record token in DB (enforces last-5 limit per user)
  tokens.record(user.id, jwtToken, expiresAt);

  return { profile, token: jwtToken };
}

/**
 * Verify a JWT token — checks signature, expiry, AND DB session status.
 * Returns decoded payload or null if invalid/expired/revoked.
 */
function verify(token) {
  return tokens.verify(token);
}

/**
 * Issue a JWT token for a user profile (e.g. on registration).
 * Does NOT record in the tokens table — caller should do that if needed.
 */
function issueToken(profile) {
  const jwtToken = jwt.sign(profile, getSecret(), { expiresIn: getTokenExpiry() });
  const decoded = jwt.decode(jwtToken);
  const expiresAt = new Date(decoded.exp * 1000).toISOString();
  tokens.record(profile.id || 0, jwtToken, expiresAt);
  return jwtToken;
}

// ─── User CRUD ──────────────────────────────────────────────────────────────
function getAllUsers() { return stmtGetAllUsers.all(); }

function updateUser(userId, role, suspended) {
  const result = stmtUpdateUser.run(role, suspended ? 1 : 0, userId);
  if (result.changes === 0) throw new Error("User not found");
  return { ok: true, changes: result.changes };
}

function deleteUser(adminId, userId) {
  if (adminId === userId) throw new Error("Cannot delete yourself");
  // Revoke all tokens first
  tokens.revokeAll(userId);
  const result = stmtDeleteUser.run(userId);
  if (result.changes === 0) throw new Error("User not found");
  return { ok: true, deleted: userId };
}

function suspendUser(adminId, userId) {
  if (adminId === userId) throw new Error("Cannot suspend yourself");
  const result = updateUser(userId, "user", true);
  // Revoke all active tokens
  tokens.revokeAll(userId);
  return result;
}

function unsuspendUser(userId) {
  return updateUser(userId, "user", false);
}

module.exports = {
  login,
  createUser,
  verify,
  issueToken,
  hasPermission,
  getPermissions,
  getAllUsers,
  updateUser,
  deleteUser,
  suspendUser,
  unsuspendUser
};
