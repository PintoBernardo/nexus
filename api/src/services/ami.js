/**
 * ami.js
 * ------
 * Persistent Asterisk Manager Interface (AMI) connection service.
 *
 * Maintains a single long-lived TCP socket to the AMI server.
 * Commands are queued and sent through the socket; responses are
 * captured by a background reader thread and returned as an array.
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
let responseBuffer = "";  // Accumulates partial reads from AMI
let pendingCommand = null; // Current command waiting for response

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

      // Build and send AMI Login action
      const loginMsg =
        `Action: Login\r\n` +
        `Username: ${username}\r\n` +
        `Secret: ${secret}\r\n` +
        `Events: ${cfg.get("ami.events", "off")}\r\n` +
        `\r\n`;

      socket.write(loginMsg);

      // Handle AMI responses — login confirmation arrives first
      const onLogin = (data) => {
        if (data.includes("Response: Success") && data.includes("Message: Authentication accepted")) {
          connected = true;
          console.log("[ami] AMI login successful");
          resolve();
        } else if (data.includes("Response: Error")) {
          disconnect();
          reject(new Error(`AMI login failed: ${data}`));
        } else {
          // Not a login response yet — wait for more data
          responseBuffer = data;
        }
      };

      // Temporarily override the data handler for login phase
      const onData = (chunk) => {
        responseBuffer += chunk.toString();

        // AMI messages end with \r\n\r\n
        while (responseBuffer.includes("\r\n\r\n")) {
          const [message, rest] = responseBuffer.split("\r\n\r\n");
          responseBuffer = rest;

          // If we're still waiting for login confirmation
          if (pendingCommand === null) {
            if (message.includes("Response: Success") || message.includes("Response: Error")) {
              onLogin(message);
            }
            return; // stop processing until next chunk
          }

          // For normal commands, check if response is complete
          if (message.includes("Event: FullyBooted") || message.includes("Response: Success") ||
              message.includes("Response: Error") || message.includes("Message: Authentication accepted")) {
            handleResponse(message);
          }
        }
      };

      socket.on("data", onData);
    });

    socket.on("error", (err) => {
      console.error(`[ami] Socket error: ${err.message}`);
      connected = false;
      if (pendingCommand) {
        pendingCommand.reject(err);
        pendingCommand = null;
      }
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

/**
 * Handle a complete AMI response message.
 * If there's a pending command promise, resolve it.
 */
function handleResponse(message) {
  if (pendingCommand) {
    if (!message.includes("--END COMMAND--") && message.includes("Event:")) {
      // Multi-line response — accumulate
      pendingCommand.messages.push(message);
      return;
    }
    pendingCommand.messages.push(message);
    pendingCommand.resolve(pendingCommand.messages);
    pendingCommand = null;
  }
}

/**
 * Send a command to AMI and wait for the response (with timeout).
 *
 * @param {Object} cmd   - Command object:
 *   { action: "CoreShowChannels" }
 *   { action: "Command", command: "core show channels" }
 * @param {number} [timeout=5] - Timeout in seconds
 * @returns {Promise<string[]>} Array of response messages
 */
function send(cmd, timeout = 5) {
  return new Promise((resolve, reject) => {
    if (!connected || !socket || socket.destroyed) {
      reject(new Error("[ami] Not connected to AMI — call connect() first"));
      return;
    }

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
    msg += "\r\n";

    // Set up pending command with timeout
    let timer = null;
    pendingCommand = {
      messages: [],
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      }
    };

    // Timeout
    timer = setTimeout(() => {
      pendingCommand = null;
      reject(new Error(`[ami] Command timed out after ${timeout}s: ${JSON.stringify(cmd)}`));
    }, timeout * 1000);

    // Write to socket
    socket.write(msg);
  });
}

/**
 * Check if we're currently connected to AMI.
 */
function isConnected() {
  return connected && socket && !socket.destroyed;
}

/**
 * Disconnect from AMI (sends Logout action).
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
  console.log("[ami] AMI disconnected");
}

module.exports = {
  connect,
  send,
  isConnected,
  disconnect
};
