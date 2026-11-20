import { supabase } from "../../lib/supabase";
import { exportAll, importAll } from "../../storage";
import { decidePush, hashPayload, summarize, recommendedMode } from "./backupCore";

export const MAX_BYTES = 8 * 1024 * 1024; // keep one backup under 8 MB

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("not-signed-in");
  return data.user.id;
}

// ---- what THIS device last saw (kept in localStorage, per account) ----
const syncKey = (uid) => `qelvaris-sync:${uid}`;
function readSync(uid) {
  try { return JSON.parse(localStorage.getItem(syncKey(uid)) || "null"); } catch { return null; }
}
function writeSync(uid, v) {
  try { localStorage.setItem(syncKey(uid), JSON.stringify(v)); } catch { /* storage full/blocked */ }
}

function mapDbError(error) {
  const msg = String(error?.message || "");
  // Postgres "undefined_column": the rev column from sql/user_backups_v2.sql is missing
  if (error?.code === "42703" || /rev/.test(msg) && /column/.test(msg)) return new Error("needs-setup");
  return error;
}

export async function getCloudInfo() {
  const uid = await currentUserId();
  const { data, error } = await supabase.from("user_backups").select("updated_at,size_bytes,rev").eq("user_id", uid).maybeSingle();
  if (error) throw mapDbError(error);
  return data ? { updatedAt: data.updated_at, size: data.size_bytes, rev: data.rev } : null;
}

// Is there anything on this device that is not in the cloud copy yet?
export async function getLocalStatus() {
  const uid = await currentUserId();
  const payload = await exportAll();
  const sync = readSync(uid);
  return {
    summary: summarize(payload),
    changed: !sync || sync.hash !== hashPayload(payload),
    lastSyncAt: sync?.at || null,
  };
}

// force=false: refuse to overwrite a cloud copy that changed since this device last looked at it.
export async function pushBackup({ force = false } = {}) {
  const uid = await currentUserId();
  const backup = await exportAll();
  const size = new Blob([JSON.stringify(backup)]).size;
  if (size > MAX_BYTES) throw new Error("too-big");

  const cloud = await getCloudInfo();
  const sync = readSync(uid);
  const verdict = decidePush(cloud ? cloud.rev : null, sync ? sync.rev : null);
  if (verdict === "conflict" && !force) {
    const err = new Error("conflict");
    err.cloud = cloud;
    throw err;
  }

  const nowIso = new Date().toISOString();
  let newRev;
  if (!cloud) {
    const { data, error } = await supabase
      .from("user_backups")
      .insert({ user_id: uid, data: backup, size_bytes: size, updated_at: nowIso, rev: 1 })
      .select("rev,updated_at")
      .single();
    if (error) {
      if (error.code === "23505") { const err = new Error("conflict"); err.cloud = await getCloudInfo(); throw err; } // someone else just created it
      throw mapDbError(error);
    }
    newRev = data.rev;
  } else {
    // compare-and-swap on the revision: only succeeds if nobody else changed the row meanwhile
    const { data, error } = await supabase
      .from("user_backups")
      .update({ data: backup, size_bytes: size, updated_at: nowIso, rev: cloud.rev + 1 })
      .eq("user_id", uid)
      .eq("rev", cloud.rev)
      .select("rev,updated_at");
    if (error) throw mapDbError(error);
    if (!data || data.length === 0) { const err = new Error("conflict"); err.cloud = await getCloudInfo(); throw err; }
    newRev = data[0].rev;
  }
  writeSync(uid, { rev: newRev, hash: hashPayload(backup), at: nowIso });
  return { size, at: nowIso, summary: summarize(backup) };
}

// Download the cloud copy and describe it next to this device's data (nothing is changed yet).
export async function previewRestore() {
  const uid = await currentUserId();
  const { data, error } = await supabase.from("user_backups").select("data,rev,updated_at").eq("user_id", uid).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data?.data) throw new Error("no-backup");
  const local = summarize(await exportAll());
  return { payload: data.data, rev: data.rev, updatedAt: data.updated_at, cloud: summarize(data.data), local, recommended: recommendedMode(local) };
}

// mode: "merge" adds only what this device is missing; "replace" makes this device match the cloud copy.
export async function restoreBackup(preview, mode) {
  const uid = await currentUserId();
  await importAll(preview.payload, { mode });
  // After "replace" the device equals the cloud copy; after "merge" it may hold extra data, so it stays "changed".
  const after = await exportAll();
  writeSync(uid, { rev: preview.rev, hash: mode === "replace" ? hashPayload(preview.payload) : hashPayload(after), at: new Date().toISOString() });
}

// ---- optional automatic backup (off unless the user turns it on) ----
const autoKey = (uid) => `qelvaris-autobackup:${uid}`;
export async function getAutoBackup() {
  try { return localStorage.getItem(autoKey(await currentUserId())) === "1"; } catch { return false; }
}
export async function setAutoBackup(on) {
  try { localStorage.setItem(autoKey(await currentUserId()), on ? "1" : "0"); } catch { /* ignore */ }
}
const DAY = 24 * 3600 * 1000;
// Called once when the app opens. Silent: never overwrites a newer cloud copy and never shows errors.
export async function maybeAutoBackup() {
  try {
    if (!(await getAutoBackup())) return false;
    const st = await getLocalStatus();
    if (!st.changed || st.summary.games === 0) return false;
    if (st.lastSyncAt && Date.now() - new Date(st.lastSyncAt).getTime() < DAY) return false;
    await pushBackup({ force: false });
    return true;
  } catch {
    return false; // conflict, offline or not signed in: try again next time
  }
}

// Ask the browser not to delete this site's data when the phone is low on space.
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return "unsupported";
    if (await navigator.storage.persisted()) return "granted";
    return (await navigator.storage.persist()) ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}
