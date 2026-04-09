/**
 * routers/services/directory.js
 * -----------------------------
 * Directory service JSON API — data source for the phone XML frontend.
 *
 * These endpoints return raw JSON data that the /services/ XML server
 * consumes and wraps in CiscoIPPhone XML for phones.
 *
 * Auth: username + services_pin (not JWT) — phones don't have tokens.
 *
 * Endpoints:
 *   GET  /api/services/directory/menu              — enabled services config
 *   GET  /api/services/directory/personal          — user's personal contacts
 *   POST /api/services/directory/personal/contact  — add/edit/delete contact
 *   GET  /api/services/directory/personal/security — PIN security status
 *   POST /api/services/directory/personal/pin      — set/change/disable PIN
 *   GET  /api/services/directory/corporate         — corporate search results
 */

const express = require("express");
const db = require("../../config/db");
const fpbx = require("../../services/freepbx");
const cfg = require("../../config/configStore");
const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Authenticate user by username + services_pin.
 * Returns user object or null.
 */
function authUser(username, pin) {
  if (!username || !pin) return null;
  const user = db.prepare("SELECT id, username, first_name, last_name, email, role, services_pin FROM users WHERE username = ?").get(username);
  if (!user) return null;
  if (user.services_pin !== pin) return null;
  return user;
}

/**
 * Get or create personal_directory row for a user.
 */
function getPersonalDir(userId) {
  let pd = db.prepare("SELECT * FROM personal_directory WHERE user_id = ?").get(userId);
  if (!pd) {
    db.prepare("INSERT INTO personal_directory (user_id, entries, secure) VALUES (?, '[]', 0)").run(userId);
    pd = db.prepare("SELECT * FROM personal_directory WHERE user_id = ?").get(userId);
  }
  return pd;
}

// ─── Menu Config ──────────────────────────────────────────────────────────────

/**
 * GET /api/services/directory/menu
 * Returns which directory services are enabled.
 * No auth required — phones need to know what's available.
 */
router.get("/menu", (req, res) => {
  const enabled = cfg.getBool("directory.enabled");
  const personalEnabled = cfg.getBool("directory.personal_enabled");
  const corporateEnabled = cfg.getBool("directory.corporate_enabled");
  const personalLabel = cfg.get("directory.personal_label") || "Personal Directory";
  const corporateLabel = cfg.get("directory.corporate_label") || "Corporate Directory";

  res.json({
    ok: true,
    enabled,
    services: {
      personal: { enabled: personalEnabled, label: personalLabel },
      corporate: { enabled: corporateEnabled, label: corporateLabel }
    }
  });
});

// ─── Personal Directory ───────────────────────────────────────────────────────

/**
 * GET /api/services/directory/personal?username=X&pin=Y
 * Returns user's personal contacts.
 */
router.get("/personal", (req, res) => {
  const { username, pin } = req.query;
  const user = authUser(username, pin);
  if (!user) return res.status(401).json({ error: "Invalid username or PIN" });

  if (!cfg.getBool("directory.personal_enabled")) {
    return res.status(403).json({ error: "Personal directory is disabled" });
  }

  const pd = getPersonalDir(user.id);
  const entries = JSON.parse(pd.entries || "[]");

  res.json({
    ok: true,
    user: { id: user.id, username: user.username },
    secure: pd.secure,
    count: entries.length,
    entries
  });
});

/**
 * POST /api/services/directory/personal/contact
 * Add, edit, or delete a personal contact.
 * Body: { username, pin, action: "add"|"edit"|"delete", idx?, name?, number? }
 */
router.post("/personal/contact", (req, res) => {
  const { username, pin, action, idx, name, number } = req.body;
  const user = authUser(username, pin);
  if (!user) return res.status(401).json({ error: "Invalid username or PIN" });

  if (!cfg.getBool("directory.personal_enabled")) {
    return res.status(403).json({ error: "Personal directory is disabled" });
  }

  const pd = getPersonalDir(user.id);
  const entries = JSON.parse(pd.entries || "[]");

  switch (action) {
    case "add":
      if (!name || !number) return res.status(400).json({ error: "Missing name or number" });
      entries.push({ Name: name, Telephone: number });
      break;

    case "edit":
      if (idx === undefined || idx < 0 || idx >= entries.length) {
        return res.status(400).json({ error: "Invalid contact index" });
      }
      if (!name || !number) return res.status(400).json({ error: "Missing name or number" });
      entries[idx] = { Name: name, Telephone: number };
      break;

    case "delete":
      if (idx === undefined || idx < 0 || idx >= entries.length) {
        return res.status(400).json({ error: "Invalid contact index" });
      }
      entries.splice(idx, 1);
      break;

    case "reorder": {
      const { newIdx } = req.body;
      if (idx === undefined || newIdx === undefined || idx < 0 || newIdx < 0 || idx >= entries.length || newIdx >= entries.length) {
        return res.status(400).json({ error: "Invalid reorder params" });
      }
      const [moved] = entries.splice(idx, 1);
      entries.splice(newIdx, 0, moved);
      break;
    }

    default:
      return res.status(400).json({ error: "Invalid action. Must be: add, edit, delete, reorder" });
  }

  db.prepare("UPDATE personal_directory SET entries = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
    .run(JSON.stringify(entries), user.id);

  res.json({ ok: true, message: `Contact ${action}ed`, count: entries.length, entries });
});

/**
 * GET /api/services/directory/personal/security?username=X&pin=Y
 * Returns PIN security status for the user.
 */
router.get("/personal/security", (req, res) => {
  const { username, pin } = req.query;
  const user = authUser(username, pin);
  if (!user) return res.status(401).json({ error: "Invalid username or PIN" });

  const pd = getPersonalDir(user.id);
  res.json({ ok: true, secure: pd.secure, hasPin: !!user.services_pin });
});

/**
 * POST /api/services/directory/personal/pin
 * Set, change, or disable PIN.
 * Body: { username, pin, action: "set"|"disable", new_pin?, confirm? }
 */
router.post("/personal/pin", (req, res) => {
  const { username, pin, action, new_pin, confirm } = req.body;
  const user = authUser(username, pin);
  if (!user) return res.status(401).json({ error: "Invalid username or PIN" });

  switch (action) {
    case "set":
      if (!new_pin || !confirm) return res.status(400).json({ error: "Missing new_pin or confirm" });
      if (new_pin !== confirm) return res.status(400).json({ error: "PINs do not match" });
      if (!/^\d{4,8}$/.test(new_pin)) return res.status(400).json({ error: "PIN must be 4-8 digits" });
      db.prepare("UPDATE users SET services_pin = ? WHERE id = ?").run(new_pin, user.id);
      db.prepare("UPDATE personal_directory SET secure = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(user.id);
      return res.json({ ok: true, message: "PIN enabled", secure: true });

    case "disable":
      db.prepare("UPDATE personal_directory SET secure = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(user.id);
      return res.json({ ok: true, message: "PIN disabled", secure: false });

    default:
      return res.status(400).json({ error: "Invalid action. Must be: set, disable" });
  }
});

// ─── Corporate Directory ──────────────────────────────────────────────────────

/**
 * GET /api/services/directory/corporate?firstname=X&lastname=Y&number=Z
 * Search FreePBX extensions.
 */
router.get("/corporate", async (req, res) => {
  if (!cfg.getBool("directory.corporate_enabled")) {
    return res.status(403).json({ error: "Corporate directory is disabled" });
  }

  if (!cfg.getBool("freepbx.enabled")) {
    return res.status(503).json({ error: "FreePBX integration is disabled" });
  }

  const firstname = (req.query.firstname || "").toLowerCase();
  const lastname = (req.query.lastname || "").toLowerCase();
  const number = req.query.number || "";

  try {
    const extensions = await fpbx.getExtensions();
    const results = extensions.filter(ext => {
      const name = ext.user?.name ?? "";
      const extId = String(ext.extensionId ?? ext.extension ?? ext.id ?? "");

      if (firstname && !name.toLowerCase().split(" ")[0].includes(firstname)) return false;
      if (lastname && !name.toLowerCase().split(" ").slice(1).join(" ").includes(lastname)) return false;
      if (number && !extId.includes(number)) return false;
      return true;
    });

    const entries = results.map(ext => ({
      Name: ext.user?.name ?? `Extension ${ext.extensionId ?? "unknown"}`,
      Telephone: ext.extensionId ?? ext.extension ?? ext.id ?? ""
    }));

    res.json({ ok: true, count: entries.length, entries });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch corporate directory", detail: err.message });
  }
});

module.exports = router;
