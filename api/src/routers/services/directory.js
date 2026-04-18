/**
 * routers/services/directory.js
 * -----------------------------
 * Directory service JSON API.
 */

const express = require("express");
const db = require("../../config/db");
const fpbx = require("../../services/freepbx");
const cfg = require("../../config/configStore");
const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authUser(username, pin) {
  if (!username || !pin) return null;
  const user = db.prepare("SELECT * FROM personal_directory WHERE username = ?").get(username);
  if (!user || user.secure != 1) return null;
  const storedPin = db.prepare("SELECT services_pin FROM users WHERE id = ?").get(user.user_id);
  return storedPin?.services_pin === pin ? user : null;
}

// ─── Menu Config ──────────────────────────────────────────────────────

router.get("/menu", (req, res) => {
  res.json({
    directory: cfg.getBool("directory.enabled"),
    personal: cfg.getBool("directory.personal_enabled"),
    corporate: cfg.getBool("directory.corporate_enabled"),
  });
});

// ─── Personal Directory ────────────────────────────────────────────

router.get("/personal", (req, res) => {
  if (!cfg.getBool("directory.personal_enabled")) {
    return res.json({ error: "Personal directory is disabled" });
  }
  const username = req.query.username || "";
  const pin = req.query.pin || "";
  const user = authUser(username, pin);
  if (!user) {
    return res.json({ error: "Invalid credentials" });
  }
  const contacts = db.prepare(
    "SELECT name, number FROM personal_contacts WHERE user_id = ? ORDER BY position"
  ).all(user.user_id);
  res.json({ ok: true, count: contacts.length, contacts });
});

router.get("/personal/security", (req, res) => {
  const username = req.query.username || "";
  const pin = req.query.pin || "";
  const user = authUser(username, pin);
  if (!user) {
    return res.json({ secured: false });
  }
  const row = db.prepare("SELECT secure FROM personal_directory WHERE user_id = ?").get(user.user_id);
  res.json({ secured: row?.secure === 1 });
});

router.post("/personal/pin", (req, res) => {
  const { username, pin, action, new_pin, confirm } = req.body;
  const user = authUser(username, pin);
  if (!user) return res.json({ error: "Invalid credentials" });

  if (action === "set") {
    if (!new_pin || !confirm || new_pin !== confirm) {
      return res.json({ error: "PINs do not match" });
    }
    if (!/^\d{4,8}$/.test(new_pin)) {
      return res.json({ error: "PIN must be 4-8 digits" });
    }
    db.prepare("UPDATE users SET services_pin = ? WHERE id = ?").run(new_pin, user.user_id);
    db.prepare("UPDATE personal_directory SET secure = 1 WHERE user_id = ?").run(user.user_id);
    return res.json({ ok: true, secured: true });
  }

  if (action === "disable") {
    db.prepare("UPDATE personal_directory SET secure = 0 WHERE user_id = ?").run(user.user_id);
    return res.json({ ok: true, secured: false });
  }

  res.json({ error: "Invalid action" });
});

router.post("/personal/contact", (req, res) => {
  const { username, pin, action, name, number, oldName, position } = req.body;
  const user = authUser(username, pin);
  if (!user) return res.json({ error: "Invalid credentials" });

  if (action === "add") {
    const maxPos = db.prepare(
      "SELECT COALESCE(MAX(position),0) + 1 as pos FROM personal_contacts WHERE user_id = ?"
    ).get(user.user_id);
    db.prepare(
      "INSERT INTO personal_contacts (user_id, name, number, position) VALUES (?, ?, ?, ?)"
    ).run(user.user_id, name, number, maxPos.pos);
    return res.json({ ok: true });
  }

  if (action === "edit") {
    db.prepare(
      "UPDATE personal_contacts SET name = ?, number = ? WHERE user_id = ? AND name = ?"
    ).run(name, number, user.user_id, oldName);
    return res.json({ ok: true });
  }

  if (action === "delete") {
    db.prepare("DELETE FROM personal_contacts WHERE user_id = ? AND name = ?").run(user.user_id, name);
    return res.json({ ok: true });
  }

  if (action === "reorder") {
    const contacts = db.prepare(
      "SELECT name FROM personal_contacts WHERE user_id = ? ORDER BY position"
    ).all(user.user_id);
    for (let i = 0; i < contacts.length; i++) {
      db.prepare("UPDATE personal_contacts SET position = ? WHERE user_id = ? AND name = ?")
        .run(i, user.user_id, contacts[i].name);
    }
    return res.json({ ok: true });
  }

  res.json({ error: "Invalid action" });
});

// ─── Corporate Directory ──────────────────────────────────────────────────────

router.get("/corporate", async (req, res) => {
  if (!cfg.getBool("directory.corporate_enabled")) {
    return res.json({ error: "Corporate directory is disabled" });
  }

  const firstname = req.query.firstname || "";
  const lastname = req.query.lastname || "";
  const number = req.query.number || "";
  const includeRingGroups = cfg.getBool("directory.corporate_include_ringgroups");

  const hasSearch = firstname || lastname || number;
  const searchTerm = (firstname || lastname || number).toLowerCase();

  try {
    const entries = [];
    const fpbxExts = await fpbx.getExtensions();

    for (const ext of fpbxExts) {
      const name = (ext.user?.name || "").toLowerCase();
      const extNum = String(ext.extensionId || ext.extension || ext.id || "");

      if (!hasSearch) {
        entries.push({
          Name: ext.user?.name || "Extension " + extNum,
          Telephone: extNum
        });
      } else if (firstname && name.includes(firstname.toLowerCase())) {
        entries.push({ Name: ext.user?.name || extNum, Telephone: extNum });
      } else if (lastname && name.includes(lastname.toLowerCase())) {
        entries.push({ Name: ext.user?.name || extNum, Telephone: extNum });
      } else if (number && extNum.includes(number)) {
        entries.push({ Name: ext.user?.name || extNum, Telephone: extNum });
      }
    }

    if (includeRingGroups) {
      const ringgroups = await fpbx.getRingGroups();
      for (const rg of ringgroups) {
        if (!hasSearch) {
          entries.push({ Name: "RG: " + rg.description, Telephone: rg.groupList || "" });
        } else {
          const rgName = (rg.description || "").toLowerCase();
          if (rgName.includes(searchTerm)) {
            entries.push({ Name: "RG: " + rg.description, Telephone: rg.groupList || "" });
          }
        }
      }
    }

    res.json({ ok: true, count: entries.length, entries: entries });
  } catch (err) {
    res.json({ error: err.message, entries: [] });
  }
});

module.exports = router;