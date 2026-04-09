/**
 * middleware/auth.js
 * ------------------
 * JWT auth with permission checking.
 *
 * Admin ROLE always passes — hardcoded in hasPermission.
 * Suspended users always fail.
 * Other roles checked against DB `role_permissions` table.
 *
 * Middleware:
 *   requiresAuth       — any logged-in, non-suspended user
 *   requiresAdmin      — role === "admin"
 *   requiresPerm("x")  — user has permission "x"
 *   requiresAnyPerm(["a","b"]) — user has any permission
 */

const { verify, hasPermission } = require("../services/auth");

function requiresAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Authorization header required" });
  if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Use: Bearer <token>" });

  const token = header.split(" ")[1].trim();
  if (!token) return res.status(401).json({ error: "Token is empty" });

  const user = verify(token);
  if (!user) {
    return res.status(401).json({ error: "Token invalid, expired, or revoked" });
  }
  req.user = user;
  next();
}

function requiresAdmin(req, res, next) {
  requiresAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin role required" });
    }
    next();
  });
}

function requiresPerm(permission) {
  return function(req, res, next) {
    requiresAuth(req, res, () => {
      if (hasPermission(req.user.role || "user", permission, req.user.suspended)) {
        return next();
      }
      res.status(403).json({ error: "Insufficient permissions", detail: `Missing: ${permission}` });
    });
  };
}

function requiresAnyPerm(permissions) {
  return function(req, res, next) {
    requiresAuth(req, res, () => {
      const has = permissions.some(p => hasPermission(req.user.role || "user", p, req.user.suspended));
      if (has) return next();
      res.status(403).json({ error: "Insufficient permissions", detail: `Need one of: ${permissions.join(", ")}` });
    });
  };
}

module.exports = { requiresAuth, requiresAdmin, requiresPerm, requiresAnyPerm };
