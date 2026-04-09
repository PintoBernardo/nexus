/**
 * ami.js
 * ------
 * Persistent Asterisk Manager Interface (AMI) connection service.
 *
 * Maintains a single long-lived TCP socket to the AMI server.
 * Commands are sent through the socket; responses are captured
 * by a background reader and returned when complete.
 *
 * All connection details (host, port, username, secret) are read
 * from the database-driven config system.
 *
 * Usage:
 *   const ami = require("../services/ami");
 *
 *   // Connect to AMI (reads creds from config)
 *   await ami.connect();
 *
 *   // Send an AMI action
 *   const resp = await ami.send({ action: "CoreShowChannels" });
 *
 *   // Close the connection
 *   ami.disconnect();
 */

const net = require("net");
const cfg = require("../config/configStore");

/**
 * AMI connection state
 */
let socket = null;
let connected = false;
let buffer = "";
let actionId = 0;                       // Unique ID for each command

/** Pending response handlers keyed by ActionID
 * Each entry: { resolve, reject, timer, messages: [] }
 */
const pending = new Map();

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if an AMI message event indicates the end of an event list.
 * Covers all Asterisk `EventListComplete`, `CommandListComplete`,
 * `DAHDIShowChannels` with "FullyBooted", and `StatusComplete`.
 */
function isComplete(message) {
  const low = message.toLowerCase();
  return (
    low.includes("eventlist: complete") ||
    low.includes("eventlist: end") ||
    low.startsWith("event: ") && low.includes("listcomplete") ||
    low.startsWith("event: ") && low.includes("complete")
  );
}

/**
 * Check if the message is a standalone response (no events follow).
 * This is true when the message has a `Response:` line and no `EventList:` header.
 */
function isStandaloneResponse(message) {
  return (
    message.includes("Response: Success") || message.includes("Response: Error") ||
    message.includes("Response: Follows")
  ) && !message.includes("EventList: start");
}

// ─── socket data handler ─────────────────────────────────────────────────────

function onSocketData() {
  socket.on("data", (chunk) => {
    buffer += chunk.toString();

    // AMI messages are separated by \r\n\r\n
    while (buffer.includes("\r\n\r\n")) {
      const idx = buffer.indexOf("\r\n\r\n");
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 4);

      const message = raw.trim();
      if (!message) continue;

      // Extract ActionID from the message to route the response
      const aidMatch = message.match(/ActionID:\s*(\S+)/);
      const aid = aidMatch ? aidMatch[1] : null;

      if (aid && pending.has(aid)) {
        const entry = pending.get(aid);
        entry.messages.push(message);

        // Determine if the response chain is complete
        if (isComplete(message) || isStandaloneResponse(message)) {
          clearTimeout(entry.timer);
          entry.resolve(entry.messages);
          pending.delete(aid);
        }
      }
    }
  });
}

// ─── connect ──────────────────────────────────────────────────────────────────

/**
 * Connect to the Asterisk Manager Interface.
 * Reads host, port, username, secret from config.
 * Sends the Login action automatically.
 */
function connect() {
  return new Promise((resolve, reject) => {
    if (connected && socket && !socket.destroyed) {
      resolve();
      return;
    }

    const host = cfg.get("ami.host", "127.0.0.1");
    const port = cfg.getNumber("ami.port", 5038);
    const username = cfg.get("ami.username", "admin");
    const secret = cfg.get("ami.secret", "");

    socket = net.createConnection({ host, port }, () => {
      console.log(`[ami] Connected to AMI at ${host}:${port}`);

      // Build and send AMI Login action with a fixed ActionID
      const loginActionId = "nexus-login";
      const loginMsg =
        `Action: Login\r\n` +
        `Username: ${username}\r\n` +
        `Secret: ${secret}\r\n` +
        `Events: ${cfg.get("ami.events", "off")}\r\n` +
        `ActionID: ${loginActionId}\r\n` +
        `\r\n`;

      socket.write(loginMsg);

      // Install the regular data handler (for normal commands)
      onSocketData();

      // Also handle the login response separately since it doesn't have
      // a pending entry — we need to resolve/reject the connect() promise.
      const originalDataHandler = socket.listeners("data")[socket.listeners("data").length - 1];
      socket.off("data", originalDataHandler);

      socket.on("data", (chunk) => {
        buffer += chunk.toString();

        // AMI messages are separated by \r\n\r\n
        while (buffer.includes("\r\n\r\n")) {
          const idx = buffer.indexOf("\r\n\r\n");
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 4);
          const message = raw.trim();
          if (!message) continue;

          const loginAidMatch = message.match(/ActionID:\s*(\S+)/);
          const msgAid = loginAidMatch ? loginAidMatch[1] : null;

          if (msgAid === loginActionId) {
            // Login response
            if (message.includes("Response: Success")) {
              connected = true;
              console.log("[ami] AMI login successful");
              resolve();
            } else if (message.includes("Response: Error")) {
              disconnect();
              reject(new Error(`AMI login failed: ${message}`));
            }
            return;
          }

          // Route to a pending command
          const aidMatch2 = message.match(/ActionID:\s*(\S+)/);
          const aid2 = aidMatch2 ? aidMatch2[1] : null;

          if (aid2 && pending.has(aid2)) {
            const entry = pending.get(aid2);
            entry.messages.push(message);
            if (isComplete(message) || isStandaloneResponse(message)) {
              clearTimeout(entry.timer);
              entry.resolve(entry.messages);
              pending.delete(aid2);
            }
          }
        }
      });
    });

    socket.on("error", (err) => {
      console.error(`[ami] Socket error: ${err.message}`);
      connected = false;
      reject(err);
    });

    socket.on("close", () => {
      console.log("[ami] AMI connection closed");
      connected = false;
      socket = null;
    });

    // Timeout if connection takes too long — 10s for TCP connect
    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error("[ami] Connection timeout"));
    });
  });
}

// ─── send ─────────────────────────────────────────────────────────────────────

/**
 * Send a command to AMI and wait for the response (with timeout).
 *
 * @param {Object} cmd   - Command object:
 *   { action: "CoreShowChannels" }
 *   { action: "Command", command: "core show channels" }
 * @param {number} [timeout=15] - Timeout in seconds
 * @returns {Promise<string[]>} Array of response messages
 */
function send(cmd, timeout = 15) {
  return new Promise((resolve, reject) => {
    if (!connected || !socket || socket.destroyed) {
      reject(new Error("[ami] Not connected to AMI — call connect() first"));
      return;
    }

    const id = `nexus-${++actionId}`;

    // Build the AMI action string
    let msg = `Action: ${cmd.action}\r\n`;
    if (cmd.action.toLowerCase() === "command") {
      msg += `Command: ${cmd.command}\r\n`;
    }
    if (cmd.params) {
      for (const [key, value] of Object.entries(cmd.params)) {
        msg += `${key}: ${value}\r\n`;
      }
    }
    msg += `ActionID: ${id}\r\n\r\n`;

    // Set up pending entry with timeout
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`[ami] Command timed out after ${timeout}s: ${JSON.stringify(cmd)}`));
    }, timeout * 1000);

    pending.set(id, { resolve, reject, timer, messages: [] });

    // Write to socket
    socket.write(msg);
  });
}

// ─── misc ─────────────────────────────────────────────────────────────────────

/**
 * Check if we're currently connected to AMI.
 */
function isConnected() {
  return connected && socket && !socket.destroyed;
}

/**
 * Disconnect from AMI (sends Logoff action).
 */
function disconnect() {
  if (connected && socket && !socket.destroyed) {
    socket.write("Action: Logoff\r\n\r\n");
    connected = false;
  }
  if (socket) {
    socket.destroy();
    socket = null;
  }
  // Reject all pending commands
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new Error("[ami] Disconnected from AMI"));
    pending.delete(id);
  }
  console.log("[ami] AMI disconnected");
}

module.exports = {
  connect,
  send,
  isConnected,
  disconnect
};
