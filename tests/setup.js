const http = require("http");

const BASE_URL = process.env.API_URL || "http://localhost:8000";

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function get(path, token) {
  return request("GET", path, null, token);
}

function post(path, body, token) {
  return request("POST", path, body, token);
}

function put(path, body, token) {
  return request("PUT", path, body, token);
}

function del(path, token) {
  return request("DELETE", path, null, token);
}

async function login(username, password) {
  const res = await post("/api/login", { username, password });
  if (res.body && res.body.token) {
    return res.body.token;
  }
  return null;
}

async function createTestUser(token) {
  const timestamp = Date.now();
  const user = {
    username: `testuser_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: "TestPassword123!"
  };
  const res = await post("/api/admin/auth/register", user, token);
  return { ...user, id: res.body?.user?.id };
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "Assertion failed"}: expected ${expected}, got ${actual}`);
  }
}

function assertOk(res, message) {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${message || "Expected success"}: got status ${res.status}`);
  }
}

function assertNotOk(res, message) {
  if (res.status >= 200 && res.status < 400) {
    throw new Error(`${message || "Expected failure"}: got status ${res.status}`);
  }
}

module.exports = {
  BASE_URL,
  get,
  post,
  put,
  del,
  login,
  createTestUser,
  assertEqual,
  assertOk,
  assertNotOk
};
