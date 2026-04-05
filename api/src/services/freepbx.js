/**
 * freepbx.js
 * ----------
 * FreePBX GraphQL API integration service.
 *
 * Reads all connection details and OAuth credentials from the
 * database-driven config system. Caches the access token
 * until it expires.
 *
 * Usage:
 *   const fpbx = require("../services/freepbx");
 *
 *   // Get all extensions from FreePBX
 *   const extensions = await fpbx.getExtensions();
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");
const cfg = require("../config/configStore");

/**
 * Cached access token and its expiry timestamp.
 * We re-authenticate only when the token is expired or missing.
 */
let accessToken = null;
let tokenExpiresAt = 0;

/**
 * FreePBX API response timeout in milliseconds.
 * Older systems can be slow — 30s is a sane default.
 */
const FREEPBX_TIMEOUT = 30000;

/**
 * Perform an HTTP POST that expects a JSON response.
 *
 * @param {string} url - Target URL
 * @param {Object} body - Request body (will be sent as JSON or form-encoded)
 * @param {Object} extraHeaders - Additional headers to merge in
 * @param {boolean} formEncoded - When true, send body as application/x-www-form-urlencoded
 */
function postJson(url, body, extraHeaders = {}, formEncoded = false) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    let payload;
    let contentType;

    if (formEncoded) {
      // OAuth2 token endpoints require URL-encoded form data
      contentType = "application/x-www-form-urlencoded";
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        params.append(key, value);
      }
      payload = params.toString();
    } else {
      contentType = "application/json";
      payload = JSON.stringify(body);
    }

    const headers = {
      "Content-Type": contentType,
      "Content-Length": Buffer.byteLength(payload),
      ...extraHeaders
    };

    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse JSON response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Request timeout — abort if the FreePBX server takes too long
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`FreePBX request timed out after ${FREEPBX_TIMEOUT / 1000}s: ${parsed.hostname}`));
    }, FREEPBX_TIMEOUT);

    req.write(payload);
    req.end();
  });
}

/**
 * Obtain an OAuth2 access token from FreePBX.
 * The token is cached and reused until expiry.
 * Credentials come from config: freepbx.api_url, client_id, client_secret
 */
async function getToken() {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const baseUrl = cfg.get("freepbx.api_url");
  const clientId = cfg.get("freepbx.client_id");
  const clientSecret = cfg.get("freepbx.client_secret");

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error("FreePBX not configured — set freepbx.api_url, freepbx.client_id, freepbx.client_secret");
  }

  const tokenUrl = `${baseUrl}/admin/api/api/token`;
  const tokenBody = {
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  };

  const result = await postJson(tokenUrl, tokenBody, {}, true);

  if (result.access_token) {
    accessToken = result.access_token;
    // Tokens typically last 3600s — cache for 50 min to be safe
    tokenExpiresAt = Date.now() + 50 * 60 * 1000;
    console.log("[freepbx] Access token obtained (cached for ~50min)");
    return accessToken;
  }

  throw new Error(`FreePBX token response missing access_token: ${JSON.stringify(result)}`);
}

/**
 * Execute a raw GraphQL query against FreePBX.
 * Useful for custom queries beyond the built-in helpers.
 */
async function query(gqlQuery) {
  const baseUrl = cfg.get("freepbx.api_url");
  const token = await getToken();
  const gqlUrl = `${baseUrl}/admin/api/api/gql`;

  const result = await postJson(gqlUrl, { query: gqlQuery }, {
    Authorization: `Bearer ${token}`
  });

  if (result.errors) {
    throw new Error(`FreePBX GraphQL error: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

/**
 * Fetch all extensions from FreePBX.
 * Returns array of extension objects.
 */
async function getExtensions() {
  const data = await query(`
    query {
      fetchAllExtensions {
        extension {
          extensionId
          user {
            name
          }
        }
      }
    }
  `);

  return data?.fetchAllExtensions?.extension ?? [];
}

/**
 * Invalidate the cached token (forces re-auth on next call).
 */
function invalidateToken() {
  accessToken = null;
  tokenExpiresAt = 0;
}

module.exports = {
  getExtensions,
  query,
  getToken,
  invalidateToken
};
