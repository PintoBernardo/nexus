/**
 * routers/ami/index.js
 * -------------------
 * Asterisk Manager Interface (AMI) endpoints.
 *
 * Lets you send AMI commands through HTTP, with the persistent
 * AMI connection managed automatically. AMI text responses
 * are automatically parsed into JSON objects.
 *
 * POST /api/ami/connect   — Connect (or reconnect) to AMI
 * POST /api/ami/command   — Send an AMI command
 * GET  /api/ami/status    — Check AMI connection status
 * POST /api/ami/disconnect — Disconnect from AMI
 */

const express = require("express");
const ami = require("../../services/ami");
const cfg = require("../../config/configStore");
const { requiresPerm } = require("../../middleware/auth");
const { parse, parseAll, flatten } = require("../../utils/amiParser");
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
 * Send a command to AMI. Raw text responses are parsed to JSON.
 *
 * Query: ?flatten=1  — merge all message blocks into one object
 *
 * Body:
 *   { action: "CoreShowChannels" }
 *   { action: "Command", command: "core show channels" }
 *   { action: "Originate", params: { Channel: "SIP/100", ... } }
 *
 * Auto-connects to AMI first if not already connected.
 */
router.post("/command", requiresPerm("ami:write"), async (req, res) => {
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

  const timeout = cfg.getNumber("ami.timeout", 15);

  try {
    const rawMessages = await ami.send(cmd, timeout);

    // Auto-parse responses to JSON
    const parsed = parseAll(rawMessages);
    const data = req.query.flatten ? flatten(rawMessages) : parsed;

    res.json({ ok: true, data });
  } catch (err) {
    // Check if error contains AMI Response: Error details
    const detail = err.message;
    res.status(500).json({ error: "AMI command failed", detail });
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
router.post("/disconnect", requiresPerm("ami:write"), (req, res) => {
  ami.disconnect();
  res.json({ ok: true, message: "Disconnected from AMI" });
});

module.exports = router;
