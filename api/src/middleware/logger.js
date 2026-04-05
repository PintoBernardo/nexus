/**
 * middleware/logger.js
 * --------------------
 * Express middleware that logs every request with method, path,
 * status code, and duration — styled to match the Nexus logging convention.
 */

function logger(req, res, next) {
  const start = process.hrtime.bigint();

  // When the response finishes, calculate and log the elapsed time
  res.on("finish", () => {
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms
    const time = `${elapsed.toFixed(2)}ms`;
    const status = res.statusCode;
    const msg = `${req.method} ${req.url} - Status: ${status} (${time})`;

    // Color-code by status
    const RESET = "\x1b[0m";
    const GREEN = "\x1b[32m";
    const YELLOW = "\x1b[33m";
    const RED = "\x1b[31m";
    const BLUE = "\x1b[94m";
    const BOLD = "\x1b[1m";

    let color;
    if (status >= 500) color = RED;
    else if (status >= 400) color = YELLOW;
    else if (status >= 300) color = BLUE;
    else color = GREEN;

    const label = status >= 400 ? "Error" : "Info";
    const labelColor = status >= 400 ? RED : GREEN;

    console.log(`${labelColor}${BOLD}${label}:${RESET} ${color}${msg}${RESET}`);
  });

  next();
}

module.exports = logger;
