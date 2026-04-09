/**
 * utils/amiParser.js
 * ------------------
 * Converts raw AMI text responses into JSON objects.
 *
 * AMI sends plain key: value lines separated by \r\n.
 * Multi-line values (Response: Follows) and repeating
 * keys (multi-valued responses) are handled.
 *
 * Usage:
 *   const { parse, parseAll } = require("../utils/amiParser");
 *
 *   const result = parse("Response: Success\r\nActionID: 1\r\n\r\n");
 *   // { response: "Success", actionId: "1" }
 *
 *   const results = parseAll(rawMessagesArray);
 */

/**
 * Parse a single AMI response string into a JSON-like object.
 *
 * Keys are converted to camelCase:
 *   "ActionID"  → actionId
 *   "Response"  → response
 *
 * Multi-valued keys (e.g. a response with multiple "Variable" lines)
 * are stored as an array.
 *
 * @param {string} raw - A single AMI message (one \r\n\r\n block)
 * @returns {Object|null} Parsed object, or null if empty
 */
function parse(raw) {
  if (!raw || !raw.trim()) return null;

  const result = {};
  const lines = raw.trim().split(/\r?\n/);

  for (const line of lines) {
    const eqIdx = line.indexOf(":");
    if (eqIdx === -1) continue; // skip malformed lines

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // camelCase the key (ActionID → actionId, Response → response)
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1);

    // Handle multi-valued keys → convert to array
    if (result[camelKey] !== undefined) {
      if (!Array.isArray(result[camelKey])) {
        result[camelKey] = [result[camelKey]];
      }
      result[camelKey].push(value);
    } else {
      result[camelKey] = value;
    }
  }

  return result;
}

/**
 * Parse an array of raw AMI messages into an array of objects.
 *
 * @param {string[]} messages - Array of raw AMI response strings
 * @returns {Object[]} Array of parsed objects
 */
function parseAll(messages) {
  return messages.map(parse).filter(Boolean);
}

/**
 * Parse and flatten: merges multiple AMI message objects into a
 * single object, collecting repeating keys into arrays.
 * Useful when a command returns several response blocks and
 * you want one unified JSON structure.
 *
 * @param {string[]} messages - Array of raw AMI response strings
 * @returns {Object} Single merged object
 */
function flatten(messages) {
  const result = {};

  for (const raw of messages) {
    const obj = parse(raw);
    if (!obj) continue;

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        if (!result[key]) result[key] = [];
        result[key].push(...value);
      } else if (result[key] !== undefined) {
        // Key already exists → convert to array
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]];
        }
        result[key].push(value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

module.exports = {
  parse,
  parseAll,
  flatten
};
