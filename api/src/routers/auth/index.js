/**
 * routers/auth/index.js
 * --------------------
 * Auth router - public endpoints for login and verify.
 *
 * POST /api/login     — authenticate
 * POST /api/auth/verify — verify JWT token
 */

const express = require("express");
const auth = require("../../services/auth");
const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }
  try {
    const result = await auth.login(username, password);
    res.json({ ok: true, token: result.token, profile: result.profile });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/verify", (req, res) => {
  const token = req.body.token || (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  if (!token) return res.status(400).json({ error: "Missing token" });
  const payload = auth.verify(token);
  if (!payload) return res.status(400).json({ ok: false, valid: false, error: "Invalid, expired, or revoked token" });
  res.json({ ok: true, valid: true, user: payload });
});

module.exports = router;
