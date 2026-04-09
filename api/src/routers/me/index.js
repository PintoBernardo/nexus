/**
 * routers/me/index.js
 * --------------------
 * "My data" endpoints — any authenticated user can access their own profile,
 * permissions, sessions, extensions, devices, and logout.
 *
 * All routes mount at /api/me so they are clean and self-contained.
 *
 * GET    /api/me              — own profile
 * GET    /api/me/perms        — own permissions
 * GET    /api/me/sessions     — own active sessions
 * GET    /api/me/extensions   — own extensions (local DB)
 * GET    /api/me/devices      — own devices (local DB)
 * DELETE /api/me/sessions/:id — revoke own session
 * POST   /api/me/logout       — expire current token now
 * POST   /api/me/logout-all   — expire all own tokens (force logout everywhere)
 */

const express = require("express");
const crypto = require("crypto");
const auth = require("../../services/auth");
const tokens = require("../../services/tokens");
const { requiresAuth } = require("../../middleware/auth");
const db = require("../../config/db");
const router = express.Router();

/**
 * GET /api/me
 * Returns the requesting user's own profile.
 */
router.get("/", requiresAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/**
 * GET /api/me/perms
 * Returns the requesting user's role and permissions.
 */
router.get("/perms", requiresAuth, (req, res) => {
  res.json({
    ok: true,
    role: req.user.role || "user",
    permissions: auth.getPermissions(req.user.role)
  });
});

/**
 * GET /api/me/sessions
 * Returns all active sessions (tokens) for the requesting user.
 */
router.get("/sessions", requiresAuth, (req, res) => {
  const userTokens = tokens.userTokens(req.user.id);
  res.json({ ok: true, count: userTokens.length, sessions: userTokens });
});

/**
 * GET /api/me/extensions
 * Returns all phone extensions linked to the requesting user.
 */
router.get("/extensions", requiresAuth, (req, res) => {
  const exts = db.prepare("SELECT * FROM extensions WHERE user_id = ?").all(req.user.id);
  res.json({ ok: true, count: exts.length, extensions: exts });
});

/**
 * GET /api/me/devices
 * Returns all devices linked to the requesting user.
 */
router.get("/devices", requiresAuth, (req, res) => {
  const devs = db.prepare("SELECT * FROM devices WHERE user_id = ?").all(req.user.id);
  res.json({ ok: true, count: devs.length, devices: devs });
});

/**
 * DELETE /api/me/sessions/:id
 * Revokes one of the user's own sessions.
 */
router.delete("/sessions/:id", requiresAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const session = db.prepare("SELECT * FROM tokens WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  db.prepare("UPDATE tokens SET is_active = 0 WHERE id = ?").run(id);
  res.json({ ok: true, message: "Session revoked" });
});

/**
 * POST /api/me/logout
 * Immediately expires the current JWT token (force logout this session).
 */
router.post("/logout", requiresAuth, (req, res) => {
  const header = req.headers.authorization;
  const token = header.split(" ")[1].trim();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("UPDATE tokens SET is_active = 0, expires_at = CURRENT_TIMESTAMP WHERE token_hash = ?").run(tokenHash);
  res.json({ ok: true, message: "Logged out successfully" });
});

/**
 * POST /api/me/logout-all
 * Expires ALL tokens for the requesting user (logout everywhere).
 */
router.post("/logout-all", requiresAuth, (req, res) => {
  const result = tokens.revokeAll(req.user.id);
  res.json({ ok: true, message: "All sessions revoked", revoked: result.revoked });
});

module.exports = router;
