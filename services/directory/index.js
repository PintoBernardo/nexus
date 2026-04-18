/**
 * services/directory/index.js
 * ---------------------------
 * Cisco IP Phone Directory Service — XML frontend for personal and corporate
 * directories. Mounts at /services/directory/* on the services server.
 *
 * Flow:
 *   Phone → /services/directory/* (XML server)
 *         → calls /api/services/directory/* (JSON API)
 *         → wraps response in CiscoIPPhone XML
 *
 * Routes:
 *   GET  /services/directory                        — Main menu (personal/corporate)
 *   GET  /services/directory/personal               — Login form + contact list
 *   GET  /services/directory/personal/add           — Add contact form
 *   GET  /services/directory/personal/add_contact   — Submit add contact
 *   GET  /services/directory/personal/select_edit   — Select contact to edit
 *   GET  /services/directory/personal/edit_form     — Edit contact form
 *   GET  /services/directory/personal/update_contact— Submit edit contact
 *   GET  /services/directory/personal/select_delete — Select contact to delete
 *   GET  /services/directory/personal/delete_contact— Submit delete contact
 *   GET  /services/directory/personal/reorder_menu  — Move contact menu
 *   GET  /services/directory/personal/reorder_select— Select target position
 *   GET  /services/directory/personal/reorder_move  — Submit move contact
 *   GET  /services/directory/personal/security_menu — PIN security menu
 *   GET  /services/directory/personal/pin_change_form      — Change PIN form
 *   GET  /services/directory/personal/pin_change_submit    — Submit PIN change
 *   GET  /services/directory/personal/pin_disable_form     — Disable PIN form
 *   GET  /services/directory/personal/pin_disable_submit   — Submit PIN disable
 *   GET  /services/directory/corporate              — Search form + results
 */

const express = require("express");
const router = express.Router();
const xml = require("../../api/src/services/xml/directory");
const {
  isServiceEnabled,
  apiGet,
  apiPost,
  serviceBase,
  cfg,
} = require("../config");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render an XML error page with a back button.
 */
function xmlError(res, msg, req, username, pin) {
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(
    xml.text("Error", msg, [
      {
        Name: "Back",
        URL: `${serviceBase(req)}/directory/personal?username=${username || ""}&pin=${pin || ""}`,
        Position: 1,
      },
    ])
  );
}

/**
 * Detect phone model from X-CiscoIPPhoneModelName header.
 * 79xx series (e.g. CP-7941, CP-7961) get the full directory menu.
 * 8xxx series (e.g. CP-8841, CP-8861) go directly to personal directory.
 */
function is79xxPhone(req) {
  const model = req.get("X-CiscoIPPhoneModelName") || "";
  return /^CP-79/.test(model);
}

// ─── Session State ─────────────────────────────────────────────────────────────
// Stores authenticated credentials per session (by IP address).
// On successful login we store the username/pin so sub-pages don't need them.
// 8xxx phones don't resend credentials on every request — session fixes that.
const sessions = new Map();

function sessionSet(req, username, pin) {
  const key = req.ip || "unknown";
  sessions.set(key, { username, pin });
}

function sessionGet(req) {
  const key = req.ip || "unknown";
  return sessions.get(key) || { username: null, pin: null };
}

// ─── Main Menu ────────────────────────────────────────────────────────────────

/**
 * GET /services/directory
 * 79xx: shows full directory menu (personal + corporate).
 * 8xxx: skips menu, redirects directly to personal directory.
 */
router.get("/", (req, res) => {
  const enabled = isServiceEnabled("directory");
  if (!enabled) {
    return res.set("Content-Type", "text/xml; charset=utf-8").send(
      xml.text("Directory", "Directory service is disabled.")
    );
  }

  const b = serviceBase(req);

  // 8xxx series — no menu, go straight to personal directory
  if (!is79xxPhone(req)) {
    const personalEnabled = cfg.getBool("directory.personal_enabled");
    if (!personalEnabled) {
      return res.set("Content-Type", "text/xml; charset=utf-8").send(
        xml.text("Directory", "Personal directory is disabled.")
      );
    }
    return res.set("Content-Type", "text/xml; charset=utf-8").send(
      xml.execute([
        { Priority: 0, URL: `${b}/directory/personal` },
      ])
    );
  }

  // 79xx series — show full menu
  const personalEnabled = cfg.getBool("directory.personal_enabled");
  const corporateEnabled = cfg.getBool("directory.corporate_enabled");
  const personalLabel = cfg.get("directory.personal_label") || "Personal Directory";
  const corporateLabel = cfg.get("directory.corporate_label") || "Corporate Directory";

  const items = [];
  if (personalEnabled)
    items.push({ Name: personalLabel, URL: `${b}/directory/personal` });
  if (corporateEnabled)
    items.push({ Name: corporateLabel, URL: `${b}/directory/corporate` });

  if (items.length === 0) {
    return res.set("Content-Type", "text/xml; charset=utf-8").send(
      xml.text("Directory", "No services available.")
    );
  }

  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(xml.menu("Directory", "Select a service", items, [
    { Name: "Logout", URL: `${b}/directory/logout`, Position: 1 },
  ]));
});

router.get("/logout", (req, res) => {
  const key = req.ip || "unknown";
  sessions.delete(key);
  const b = serviceBase(req);
  return res.set("Content-Type", "text/xml; charset=utf-8").send(
    xml.execute([
      { Priority: 0, URL: "Status:Logged out" },
      { Priority: 0, URL: `${b}/directory/personal` },
    ])
  );
});

// ─── Personal Directory ───────────────────────────────────────────────────────

/**
 * GET /services/directory/personal
 * Shows login form (username + PIN) or contact list if authenticated.
 */
router.get("/personal", (req, res) => {
  if (!isServiceEnabled("directory")) {
    return res.set("Content-Type", "text/xml; charset=utf-8").send(
      xml.text("Personal Directory", "This service is disabled.")
    );
  }

  const { username: queryUser, pin: queryPin } = req.query;

  // Try query params first, fall back to session (for 8xxx phones)
  const { username, pin } = queryUser ? { username: queryUser, pin: queryPin } : sessionGet(req);

  if (!username || !pin) {
    const b = serviceBase(req);
    return res.set("Content-Type", "text/xml; charset=utf-8").send(
      xml.input(
        "Personal Directory",
        "Enter your username and PIN",
        [
          {
            DisplayName: "Username",
            QueryStringParam: "username",
            InputFlags: "A",
            DefaultValue: "",
          },
          {
            DisplayName: "PIN",
            QueryStringParam: "pin",
            InputFlags: "T",
            DefaultValue: "",
          },
        ],
        b + "/directory/personal",
        [
          { Name: "Submit", URL: "SoftKey:Submit", Position: 1 },
          { Name: "<<", URL: "SoftKey:<<", Position: 2 },
          { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
        ]
      )
    );
  }

  // Store credentials in session for future requests (8xxx phones)
  sessionSet(req, username, pin);
  fetchPersonalContacts(req, res, username, pin);
});

/**
 * Fetch personal contacts from the JSON API and render as XML directory.
 */
function fetchPersonalContacts(req, res, username, pin) {
  apiGet(
    `/api/services/directory/personal?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`
  )
    .then(({ status, body }) => {
      if (status === 401) {
        return res.set("Content-Type", "text/xml; charset=utf-8").send(
          xml.text("Authentication Failed", "Invalid username or PIN.", [
            {
              Name: "Retry",
              URL: `${serviceBase(req)}/directory/personal`,
              Position: 1,
            },
            { Name: "<<", URL: "SoftKey:<<", Position: 2 },
            { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
          ])
        );
      }
      if (status === 403 || status !== 200) {
        const backUrl = is79xxPhone(req)
          ? `${serviceBase(req)}/directory`
          : "Init:Services";
        return res.set("Content-Type", "text/xml; charset=utf-8").send(
          xml.text("Personal Directory", body.error || "Service unavailable.", [
            { Name: "Back", URL: backUrl, Position: 1 },
          ])
        );
      }

      const entries = body.entries || [];
      const b = serviceBase(req);
      const prompt =
        entries.length === 0
          ? "No contacts — press Add"
          : `Records 1 to ${entries.length} of ${entries.length}`;
      const qp = `username=${username}&pin=${pin}`;

      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.directory("Personal Directory", prompt, entries, [
          { Name: "Exit", URL: "SoftKey:Exit", Position: 1 },
          { Name: "Dial", URL: "SoftKey:Dial", Position: 2 },
          { Name: "Add", URL: `${b}/directory/personal/add?${qp}`, Position: 3 },
          {
            Name: "Edit",
            URL: `${b}/directory/personal/select_edit?${qp}`,
            Position: 4,
          },
          {
            Name: "Del",
            URL: `${b}/directory/personal/select_delete?${qp}`,
            Position: 5,
          },
          {
            Name: "Move",
            URL: `${b}/directory/personal/reorder_menu?${qp}`,
            Position: 6,
          },
          {
            Name: "Sec",
            URL: `${b}/directory/personal/security_menu?${qp}`,
            Position: 7,
          },
          { Name: "Logout", URL: `${b}/directory/logout?${qp}`, Position: 8 },
        ])
      );
    })
    .catch((err) => {
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.text("Error", `API error: ${err.message}`, [
          {
            Name: "Retry",
            URL: `${serviceBase(req)}/directory/personal`,
            Position: 1,
          },
        ])
      );
    });
}

// ─── Personal: Add Contact ────────────────────────────────────────────────────

/**
 * GET /services/directory/personal/add
 * Shows the add contact input form.
 */
router.get("/personal/add", (req, res) => {
  // Fall back to session credentials (8xxx phones don't resend username/pin)
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  const b = serviceBase(req);
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(
    xml.input(
      "Add Contact",
      "Enter contact details",
      [
        {
          DisplayName: "Name",
          QueryStringParam: "name",
          InputFlags: "A",
          DefaultValue: "",
        },
        {
          DisplayName: "Number",
          QueryStringParam: "number",
          InputFlags: "T",
          DefaultValue: "",
        },
      ],
      `${b}/directory/personal/add_contact`,
      [
        { Name: "Submit", URL: "SoftKey:Submit", Position: 1 },
        { Name: "<<", URL: "SoftKey:<<", Position: 2 },
        { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
      ]
    )
  );
});

/**
 * GET /services/directory/personal/add_contact
 * Submits the add contact form to the JSON API.
 */
router.get("/personal/add_contact", (req, res) => {
  // Fall back to session credentials (8xxx phones don't resend username/pin)
  const { username: qUser, pin: qPin, name, number } = req.query;
  const { username, pin } = qUser ? { username: qUser, pin: qPin } : sessionGet(req);
  if (!username || !pin || !name || !number) {
    return xmlError(res, "Missing data", req, username, pin);
  }
  apiPost("/api/services/directory/personal/contact", {
    username,
    pin,
    action: "add",
    name,
    number,
  })
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.execute([
          { Priority: 0, URL: `Status:Contact ${name} added` },
          {
            Priority: 0,
            URL: `${serviceBase(req)}/directory/personal?username=${username}&pin=${pin}`,
          },
        ])
      );
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

// ─── Personal: Edit Contact ───────────────────────────────────────────────────

/**
 * GET /services/directory/personal/select_edit
 * Lists contacts to select one for editing.
 */
router.get("/personal/select_edit", (req, res) => {
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  const b = serviceBase(req);
  apiGet(
    `/api/services/directory/personal?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`
  )
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      const items = (body.entries || []).map((e, i) => ({
        Name: `${e.Name} (${e.Telephone})`,
        URL: `${b}/directory/personal/edit_form?username=${username}&pin=${pin}&idx=${i}`,
      }));
      items.push({
        Name: "Back",
        URL: `${b}/directory/personal?username=${username}&pin=${pin}`,
      });
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(xml.menu("Edit Contact", "Select a contact", items));
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

/**
 * GET /services/directory/personal/edit_form
 * Shows the edit form for a selected contact.
 */
router.get("/personal/edit_form", (req, res) => {
  const { username, pin, idx } = req.query.username ? req.query : sessionGet(req);
  apiGet(
    `/api/services/directory/personal?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`
  )
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      const entries = body.entries || [];
      const i = parseInt(idx, 10);
      if (!entries[i])
        return xmlError(res, "Contact not found", req, username, pin);
      const c = entries[i];
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.input(
          "Edit Contact",
          `Editing: ${c.Name}`,
          [
            {
              DisplayName: "Name",
              QueryStringParam: "name",
              InputFlags: "A",
              DefaultValue: c.Name,
            },
            {
              DisplayName: "Number",
              QueryStringParam: "number",
              InputFlags: "T",
              DefaultValue: c.Telephone,
            },
          ],
          `${serviceBase(req)}/directory/personal/update_contact?username=${username}&pin=${pin}&idx=${i}`,
          [
            { Name: "Submit", URL: "SoftKey:Submit", Position: 1 },
            { Name: "<<", URL: "SoftKey:<<", Position: 2 },
            { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
          ]
        )
      );
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

/**
 * GET /services/directory/personal/update_contact
 * Submits the edit contact form to the JSON API.
 */
router.get("/personal/update_contact", (req, res) => {
  const { username, pin, idx, name, number } = req.query.username ? req.query : sessionGet(req);
  if (!username || !pin || idx === undefined || !name || !number) {
    return xmlError(res, "Missing data", req, username, pin);
  }
  apiPost("/api/services/directory/personal/contact", {
    username,
    pin,
    action: "edit",
    idx: parseInt(idx, 10),
    name,
    number,
  })
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.execute([
          { Priority: 0, URL: `Status:Contact ${name} updated` },
          {
            Priority: 0,
            URL: `${serviceBase(req)}/directory/personal?username=${username}&pin=${pin}`,
          },
        ])
      );
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

// ─── Personal: Delete Contact ─────────────────────────────────────────────────

/**
 * GET /services/directory/personal/select_delete
 * Lists contacts to select one for deletion.
 */
router.get("/personal/select_delete", (req, res) => {
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  const b = serviceBase(req);
  apiGet(
    `/api/services/directory/personal?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`
  )
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      const items = (body.entries || []).map((e, i) => ({
        Name: `${e.Name} (${e.Telephone})`,
        URL: `${b}/directory/personal/delete_contact?username=${username}&pin=${pin}&idx=${i}`,
      }));
      items.push({
        Name: "Back",
        URL: `${b}/directory/personal?username=${username}&pin=${pin}`,
      });
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(xml.menu("Delete Contact", "Select a contact", items));
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

/**
 * GET /services/directory/personal/delete_contact
 * Submits the delete action to the JSON API.
 */
router.get("/personal/delete_contact", (req, res) => {
  const { username, pin, idx } = req.query.username ? req.query : sessionGet(req);
  if (!username || !pin || idx === undefined) {
    return xmlError(res, "Missing data", req, username, pin);
  }
  apiPost("/api/services/directory/personal/contact", {
    username,
    pin,
    action: "delete",
    idx: parseInt(idx, 10),
  })
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.execute([
          { Priority: 0, URL: "Status:Contact deleted" },
          {
            Priority: 0,
            URL: `${serviceBase(req)}/directory/personal?username=${username}&pin=${pin}`,
          },
        ])
      );
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

// ─── Personal: Reorder / Move Contact ─────────────────────────────────────────

/**
 * GET /services/directory/personal/reorder_menu
 * Lists contacts to select one for reordering.
 */
router.get("/personal/reorder_menu", (req, res) => {
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  const b = serviceBase(req);
  apiGet(
    `/api/services/directory/personal?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`
  )
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      const items = (body.entries || []).map((e, i) => ({
        Name: `${i + 1}. ${e.Name} (${e.Telephone})`,
        URL: `${b}/directory/personal/reorder_select?username=${username}&pin=${pin}&idx=${i}`,
      }));
      items.push({
        Name: "Back",
        URL: `${b}/directory/personal?username=${username}&pin=${pin}`,
      });
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(xml.menu("Move Contact", "Select contact to move", items));
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

/**
 * GET /services/directory/personal/reorder_select
 * Shows available positions to move the selected contact to.
 */
router.get("/personal/reorder_select", (req, res) => {
  const { username, pin, idx } = req.query.username ? req.query : sessionGet(req);
  apiGet(
    `/api/services/directory/personal?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`
  )
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      const entries = body.entries || [];
      const i = parseInt(idx, 10);
      const items = [];
      for (let j = 0; j < entries.length; j++) {
        if (j === i) continue;
        items.push({
          Name: `Position ${j + 1}: ${entries[j].Name}`,
          URL: `${serviceBase(req)}/directory/personal/reorder_move?username=${username}&pin=${pin}&idx=${i}&newIdx=${j}`,
        });
      }
      items.push({
        Name: "Back",
        URL: `${serviceBase(req)}/directory/personal/reorder_menu?username=${username}&pin=${pin}`,
      });
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(xml.menu("Move To", "Select new position", items));
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

/**
 * GET /services/directory/personal/reorder_move
 * Submits the move action to the JSON API.
 */
router.get("/personal/reorder_move", (req, res) => {
  const { username, pin, idx, newIdx } = req.query.username ? req.query : sessionGet(req);
  if (!username || !pin || idx === undefined || newIdx === undefined) {
    return xmlError(res, "Missing data", req, username, pin);
  }
  apiPost("/api/services/directory/personal/contact", {
    username,
    pin,
    action: "reorder",
    idx: parseInt(idx, 10),
    newIdx: parseInt(newIdx, 10),
  })
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.execute([
          {
            Priority: 0,
            URL: `Status:Contact moved to position ${parseInt(newIdx, 10) + 1}`,
          },
          {
            Priority: 0,
            URL: `${serviceBase(req)}/directory/personal?username=${username}&pin=${pin}`,
          },
        ])
      );
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

// ─── Personal: Security / PIN Management ──────────────────────────────────────

/**
 * GET /services/directory/personal/security_menu
 * Shows PIN security options (enable, change, disable).
 */
router.get("/personal/security_menu", (req, res) => {
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  const b = serviceBase(req);
  apiGet(
    `/api/services/directory/personal/security?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`
  )
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      const items = [];
      if (body.secure) {
        items.push({
          Name: "Change PIN",
          URL: `${b}/directory/personal/pin_change_form?username=${username}&pin=${pin}`,
        });
        items.push({
          Name: "Disable PIN",
          URL: `${b}/directory/personal/pin_disable_form?username=${username}&pin=${pin}`,
        });
      } else {
        items.push({
          Name: "Change PIN",
          URL: `${b}/directory/personal/pin_change_form?username=${username}&pin=${pin}`,
        });
      }
      items.push({
        Name: "Back",
        URL: `${b}/directory/personal?username=${username}&pin=${pin}`,
      });
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(xml.menu("Security", "Manage your PIN", items));
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

/**
 * GET /services/directory/personal/pin_change_form
 * Shows the change PIN input form (includes current PIN).
 */
router.get("/personal/pin_change_form", (req, res) => {
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(
    xml.input(
      "Change PIN",
      "Enter PIN details",
      [
        {
          DisplayName: "Current PIN",
          QueryStringParam: "pin",
          InputFlags: "T",
          DefaultValue: pin || "",
        },
        {
          DisplayName: "New PIN",
          QueryStringParam: "new_pin",
          InputFlags: "T",
          DefaultValue: "",
        },
        {
          DisplayName: "Confirm",
          QueryStringParam: "confirm",
          InputFlags: "T",
          DefaultValue: "",
        },
      ],
      `${serviceBase(req)}/directory/personal/pin_change_submit?username=${encodeURIComponent(username)}&pin=${encodeURIComponent(pin)}`,
      [
        { Name: "Submit", URL: "SoftKey:Submit", Position: 1 },
        { Name: "<<", URL: "SoftKey:<<", Position: 2 },
        { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
      ]
    )
  );
});

/**
 * GET /services/directory/personal/pin_change_submit
 * Submits the PIN change to the JSON API.
 */
router.get("/personal/pin_change_submit", (req, res) => {
  const { username, pin, new_pin, confirm } = req.query.username ? req.query : sessionGet(req);
  if (!username || !pin || !new_pin || !confirm) {
    return xmlError(res, "Missing fields", req, username, pin);
  }
  apiPost("/api/services/directory/personal/pin", {
    username,
    pin,
    action: "set",
    new_pin,
    confirm,
  })
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.execute([
          { Priority: 0, URL: "Status:PIN enabled" },
          {
            Priority: 0,
            URL: `${serviceBase(req)}/directory/personal?username=${username}&pin=${new_pin}`,
          },
        ])
      );
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

/**
 * GET /services/directory/personal/pin_disable_form
 * Shows the disable PIN confirmation form.
 */
router.get("/personal/pin_disable_form", (req, res) => {
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(
    xml.input(
      "Disable PIN",
      "Enter current PIN to confirm",
      [
        {
          DisplayName: "Current PIN",
          QueryStringParam: "pin",
          InputFlags: "T",
          DefaultValue: "",
        },
      ],
      `${serviceBase(req)}/directory/personal/pin_disable_submit`,
      [
        { Name: "Submit", URL: "SoftKey:Submit", Position: 1 },
        { Name: "<<", URL: "SoftKey:<<", Position: 2 },
        { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
      ]
    )
  );
});

/**
 * GET /services/directory/personal/pin_disable_submit
 * Submits the PIN disable to the JSON API.
 */
router.get("/personal/pin_disable_submit", (req, res) => {
  const { username, pin } = req.query.username ? req.query : sessionGet(req);
  if (!username || !pin) {
    return xmlError(res, "Missing PIN", req, username, pin);
  }
  apiPost("/api/services/directory/personal/pin", {
    username,
    pin,
    action: "disable",
  })
    .then(({ status, body }) => {
      if (status !== 200)
        return xmlError(res, body.error || "Failed", req, username, pin);
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.execute([
          { Priority: 0, URL: "Status:PIN disabled" },
          {
            Priority: 0,
            URL: `${serviceBase(req)}/directory/personal?username=${username}&pin=${pin}`,
          },
        ])
      );
    })
    .catch(() => xmlError(res, "API error", req, username, pin));
});

// ─── Corporate Directory ──────────────────────────────────────────────────────

/**
 * GET /services/directory/corporate
 * Shows search form or corporate directory results from FreePBX.
 */
router.get("/corporate", (req, res) => {
  if (!isServiceEnabled("directory")) {
    return res.set("Content-Type", "text/xml; charset=utf-8").send(
      xml.text("Corporate Directory", "This service is disabled.")
    );
  }

  const { firstname, lastname, number } = req.query;

  if (!firstname && !lastname && !number) {
    const b = serviceBase(req);
    return res.set("Content-Type", "text/xml; charset=utf-8").send(
      xml.input(
        "Corporate Directory",
        "Enter search criteria",
        [
          {
            DisplayName: "First Name",
            QueryStringParam: "firstname",
            InputFlags: "A",
            DefaultValue: "",
          },
          {
            DisplayName: "Last Name",
            QueryStringParam: "lastname",
            InputFlags: "A",
            DefaultValue: "",
          },
          {
            DisplayName: "Number",
            QueryStringParam: "number",
            InputFlags: "T",
            DefaultValue: "",
          },
        ],
        b + "/directory/corporate",
        [
          { Name: "Search", URL: "SoftKey:Submit", Position: 1 },
          { Name: "<<", URL: "SoftKey:<<", Position: 2 },
          { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
        ]
      )
    );
  }

  const params = {};
  if (firstname) params.firstname = firstname;
  if (lastname) params.lastname = lastname;
  if (number) params.number = number;
  const query = new URLSearchParams(params).toString();
  apiGet(`/api/services/directory/corporate?${query}`)
    .then(({ status, body }) => {
      const backUrl = is79xxPhone(req)
        ? `${serviceBase(req)}/directory`
        : "Init:Services";
      if (status === 403) {
        return res.set("Content-Type", "text/xml; charset=utf-8").send(
          xml.text("Corporate Directory", body?.error || "Service disabled.", [
            { Name: "Back", URL: backUrl, Position: 1 },
          ])
        );
      }
      if (status !== 200) {
        return res.set("Content-Type", "text/xml; charset=utf-8").send(
          xml.text("Error", body?.error || body?.detail || "Failed to fetch", [
            { Name: "Back", URL: backUrl, Position: 1 },
          ])
        );
      }

      if (!body || !body.entries) {
        return res.set("Content-Type", "text/xml; charset=utf-8").send(
          xml.text("Corporate Directory", "No results found", [
            { Name: "Back", URL: backUrl, Position: 1 },
          ])
        );
      }

      const entries = body.entries || [];
      const prompt =
        entries.length === 0
          ? "No results found"
          : `Records 1 to ${entries.length} of ${entries.length}`;
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.directory("Corporate Directory", prompt, entries, [
          { Name: "Dial", URL: "SoftKey:Dial", Position: 1 },
          { Name: "EditDial", URL: "SoftKey:EditDial", Position: 2 },
          { Name: "Exit", URL: "SoftKey:Exit", Position: 3 },
        ])
      );
    })
    .catch((err) => {
      const backUrl = is79xxPhone(req)
        ? `${serviceBase(req)}/directory`
        : "Init:Services";
      res.set("Content-Type", "text/xml; charset=utf-8");
      res.send(
        xml.text("Error", `API error: ${err.message}`, [
          { Name: "Back", URL: backUrl, Position: 1 },
        ])
      );
    });
});

module.exports = router;
