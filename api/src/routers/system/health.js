/**
 * routers/system/health.js
 * ------------------------
 * System health and status endpoint.
 *
 * GET /api/system/health  — API status, version, uptime
 */

const express = require("express");
const cfg = require("../../config/configStore");
const ami = require("../../services/ami");
const router = express.Router();

/**
 * GET /api/system/health
 * Returns the API status, version, uptime, and submodule status
 * (FreePBX, AMI) so monitoring tools can check everything at once.
 */
router.get("/health", (req, res) => {
  res.json({
    project: "Nexus",
    status: "online",
    version: "1.0.0",
    uptime: process.uptime(),
    services: {
      freepbx: {
        enabled: cfg.getBool("freepbx.enabled")
      },
      ami: {
        enabled: cfg.getBool("ami.enabled"),
        connected: ami.isConnected()
      }
    }
  });
});

module.exports = router;