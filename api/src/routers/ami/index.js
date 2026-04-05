/**
 * routers/ami/index.js
 * -------------------
 * Asterisk Manager Interface (AMI) endpoints.
 *
 * Lets you send AMI commands through HTTP, with the persistent
 * AMI connection managed automatically.
 *
 * POST /api/ami/connect   — Connect (or reconnect) to AMI
 * POST /api/ami/command   — Send an AMI command
 * GET  /api/ami/status    — Check AMI connection status
 * POST /api/ami/disconnect — Disconnect from AMI
 */

const express = require("express");
const ami = require("../../services/ami");
const cfg = require("../../config/configStore");
const router = express.Router();

/**
 * POST /api/ami/connect
 * Connect to the AMI server using credentials from config.
 */
router.post("/connect", async (req, res) => {
  try {
    await ami.connect();
    res.json({ ok: true, message: "Connected to AMI" });
  } catch (err) {
    res.status(500).json({ error: "Failed to connect to AMI", detail: err.message });
  }
});

/**
 * POST /api/ami/command
 * Send a command to AMI.
 *
 * Body:
 *   { action: "CoreShowChannels" }
 *   { action: "Command", command: "core show channels" }
 *   { action: "Originate", params: { Channel: "SIP/100", ... } }
 *
 * Auto-connects to AMI first if not already connected.
 */
router.post("/command", async (req, res) => {
  const cmd = req.body;
  if (!cmd || !cmd.action) {
    return res.status(400).json({ error: "Missing 'action' in request body" });
  }

  // Auto-connect if not already connected
  if (!ami.isConnected() && cfg.getBool("ami.enabled")) {
    try {
      await ami.connect();
    } catch (err) {
      return res.status(503).json({ error: "Failed to connect to AMI", detail: err.message });
    }
  }

  const timeout = cfg.getNumber("ami.timeout", 5);

  try {
    const messages = await ami.send(cmd, timeout);
    res.json({ ok: true, messages });
  } catch (err) {
    res.status(500).json({ error: "AMI command failed", detail: err.message });
  }
});

/**
 * GET /api/ami/status
 * Returns whether the AMI connection is currently active.
 */
router.get("/status", (req, res) => {
  res.json({
    connected: ami.isConnected(),
    enabled: cfg.getBool("ami.enabled"),
    host: cfg.get("ami.host"),
    port: cfg.getNumber("ami.port")
  });
});

/**
 * POST /api/ami/disconnect
 * Disconnect from AMI.
 */
router.post("/disconnect", (req, res) => {
  ami.disconnect();
  res.json({ ok: true, message: "Disconnected from AMI" });
});

module.exports = router;
