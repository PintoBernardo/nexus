/**
 * services/sync.js
 * ----------------
 * Sync service for FreePBX extensions and ringgroups.
 * Handles both manual sync and periodic auto-sync.
 */

const fpbx = require("./freepbx");
const cfg = require("../config/configStore");
const db = require("../config/db");

let autoSyncTimer = null;
let syncSelections = 0;

function parseName(name) {
  if (!name || typeof name !== "string") {
    return { first_name: "", last_name: "" };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) {
    return { first_name: "", last_name: "" };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }
  const first_name = parts[0];
  const last_name = parts.slice(1).join(" ");
  return { first_name, last_name };
}

async function syncExtensions(mode) {
  if (mode === "no") return { added: 0, updated: 0, deleted: 0, skipped: 0 };

  const results = { added: 0, updated: 0, deleted: 0, skipped: 0 };
  const fpbxExts = await fpbx.getExtensions();
  const getExt = db.prepare("SELECT id FROM extensions WHERE extension = ?");
  const defaultUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();

  for (const ext of fpbxExts) {
    const extNum = String(ext.extensionId ?? ext.extension ?? ext.id ?? "");
    if (!extNum) continue;

    const existing = getExt.get(extNum);
    const name = ext.user?.name ?? "";
    const { first_name, last_name } = parseName(name);

    if (!existing) {
      if (mode === "yes" || mode === "yes_add_only") {
        const userMatch = db.prepare("SELECT id FROM users WHERE username = ?").get(name.toLowerCase().replace(/\s+/g, "."));
        const userId = userMatch?.id || defaultUser?.id || 1;
        db.prepare(
          "INSERT INTO extensions (user_id, type, extension, secret, display_name, first_name, last_name, context, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)"
        ).run(userId, "pjsip", extNum, "", name, first_name, last_name, "from-internal");
        results.added++;
      } else {
        results.skipped++;
      }
    } else {
      if (mode === "yes") {
        db.prepare("UPDATE extensions SET display_name = ?, first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(name, first_name, last_name, existing.id);
        results.updated++;
      } else {
        results.skipped++;
      }
    }
  }

  if (mode === "yes" || mode === "yes_delete_only") {
    const fpbxExtNums = new Set(fpbxExts.map(e => String(e.extensionId ?? e.extension ?? e.id ?? "")).filter(Boolean));
    const localExts = db.prepare("SELECT id, extension FROM extensions").all();
    for (const local of localExts) {
      if (!fpbxExtNums.has(local.extension)) {
        db.prepare("DELETE FROM extensions WHERE id = ?").run(local.id);
        results.deleted++;
      }
    }
  }

  return results;
}

async function syncRingGroups(mode) {
  if (mode === "no") return { added: 0, updated: 0, deleted: 0, skipped: 0 };

  const results = { added: 0, updated: 0, deleted: 0, skipped: 0 };
  const fpbxRgs = await fpbx.getRingGroups();
  const getRg = db.prepare("SELECT id FROM ring_groups WHERE name = ?");

  for (const rg of fpbxRgs) {
    const name = rg.description || `RingGroup ${rg.id}`;
    const existing = getRg.get(name);

    if (!existing) {
      if (mode === "yes" || mode === "yes_add_only") {
        const result = db.prepare(
          "INSERT INTO ring_groups (name, strategy, description) VALUES (?, ?, ?)"
        ).run(name, rg.strategy || "ringall", `Synced from FreePBX: ${rg.id}`);
        const groupId = result.lastInsertRowid;

        if (rg.groupList) {
          const members = String(rg.groupList).split(/[,\s]+/).filter(Boolean);
          const getExt = db.prepare("SELECT id FROM extensions WHERE extension = ?");
          const insertMember = db.prepare("INSERT INTO ring_group_members (ring_group_id, extension_id, priority) VALUES (?, ?, ?)");
          for (let i = 0; i < members.length; i++) {
            const ext = getExt.get(members[i]);
            if (ext) {
              insertMember.run(groupId, ext.id, i);
            }
          }
        }
        results.added++;
      } else {
        results.skipped++;
      }
    } else {
      if (mode === "yes") {
        db.prepare("UPDATE ring_groups SET strategy = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(rg.strategy || "ringall", `Synced from FreePBX: ${rg.id}`, existing.id);

        if (rg.groupList) {
          const members = String(rg.groupList).split(/[,\s]+/).filter(Boolean);
          db.prepare("DELETE FROM ring_group_members WHERE ring_group_id = ?").run(existing.id);
          const getExt = db.prepare("SELECT id FROM extensions WHERE extension = ?");
          const insertMember = db.prepare("INSERT INTO ring_group_members (ring_group_id, extension_id, priority) VALUES (?, ?, ?)");
          for (let i = 0; i < members.length; i++) {
            const ext = getExt.get(members[i]);
            if (ext) {
              insertMember.run(existing.id, ext.id, i);
            }
          }
        }
        results.updated++;
      } else {
        results.skipped++;
      }
    }
  }

  if (mode === "yes" || mode === "yes_delete_only") {
    const fpbxRgNames = new Set(fpbxRgs.map(r => r.description || `RingGroup ${r.id}`).filter(Boolean));
    const localRgs = db.prepare("SELECT id, name FROM ring_groups WHERE name LIKE 'RingGroup %' OR description LIKE 'Synced from FreePBX%'").all();
    for (const local of localRgs) {
      if (!fpbxRgNames.has(local.name)) {
        db.prepare("DELETE FROM ring_groups WHERE id = ?").run(local.id);
        results.deleted++;
      }
    }
  }

  return results;
}

async function runSync(extensionsMode, ringgroupsMode) {
  const results = {
    extensions: { added: 0, updated: 0, deleted: 0, skipped: 0 },
    ringgroups: { added: 0, updated: 0, deleted: 0, skipped: 0 }
  };

  try {
    if (extensionsMode !== "no") {
      results.extensions = await syncExtensions(extensionsMode);
    }
    if (ringgroupsMode !== "no") {
      results.ringgroups = await syncRingGroups(ringgroupsMode);
    }
    return results;
  } catch (err) {
    console.error("[sync] Error during sync:", err.message);
    throw err;
  }
}

function startPeriodicSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
  }

  const enabled = cfg.getBool("sync.auto.enabled");
  const interval = cfg.getNumber("sync.auto.interval", 60);

  if (!enabled || interval <= 0) {
    console.log("[sync] Periodic auto-sync is disabled");
    return;
  }

  const intervalMs = interval * 60 * 1000;
  console.log(`[sync] Starting periodic auto-sync every ${interval} minutes`);

  autoSyncTimer = setInterval(async () => {
    const extMode = cfg.get("sync.default.extensions", "no");
    const rgMode = cfg.get("sync.default.ringgroups", "no");

    if (extMode !== "no" || rgMode !== "no") {
      console.log("[sync] Running periodic auto-sync...");
      try {
        await runSync(extMode, rgMode);
        console.log("[sync] Periodic sync completed");
      } catch (err) {
        console.error("[sync] Periodic sync failed:", err.message);
      }
    }
  }, intervalMs);
}

function stopPeriodicSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    console.log("[sync] Periodic auto-sync stopped");
  }
}

function recordSyncSelection() {
  syncSelections++;
  const selectionsBeforeAuto = cfg.getNumber("sync.auto.selections_before", 0);
  if (selectionsBeforeAuto > 0 && syncSelections >= selectionsBeforeAuto) {
    syncSelections = 0;
    const extMode = cfg.get("sync.default.extensions", "no");
    const rgMode = cfg.get("sync.default.ringgroups", "no");
    if (extMode !== "no" || rgMode !== "no") {
      console.log("[sync] Auto-sync triggered after selections threshold");
      runSync(extMode, rgMode).catch(err => console.error("[sync] Auto-sync failed:", err.message));
    }
  }
}

function resetSyncSelections() {
  syncSelections = 0;
}

module.exports = {
  runSync,
  startPeriodicSync,
  stopPeriodicSync,
  recordSyncSelection,
  resetSyncSelections,
  syncExtensions,
  syncRingGroups
};