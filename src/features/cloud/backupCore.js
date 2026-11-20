// Pure backup logic (no browser, no Supabase) so it can be unit-tested.
// A backup payload looks like:
//   { app:"qelvaris", version:2, exportedAt, data:{games,reviews,training,settings}, local:{ key: value } }
// version 1 payloads (older backups) have no "local" part and still restore fine.

export const BACKUP_VERSION = 2;
export const STORE_KEYS = { games: "id", reviews: "gameId", training: "id", settings: "key" };
// Small localStorage items that belong to the user and must travel with the backup.
export const LOCAL_KEYS = ["qelvaris-game-favourites"];

export function isValidBackup(b) {
  if (!b || b.app !== "qelvaris" || typeof b.data !== "object" || b.data === null) return false;
  if (typeof b.version === "number" && b.version > BACKUP_VERSION) return false; // made by a newer app
  for (const [store, keyPath] of Object.entries(STORE_KEYS)) {
    const rows = b.data[store];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) return false;
    for (const r of rows) {
      if (!r || typeof r !== "object" || r[keyPath] === undefined || r[keyPath] === null) return false;
    }
  }
  return true;
}

// Short, stable fingerprint of what the backup contains (ignores the export time).
export function hashPayload(b) {
  const s = JSON.stringify({ d: b?.data || {}, l: b?.local || {} });
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16) + ":" + s.length;
}

export function summarize(b) {
  const d = b?.data || {};
  const count = (k) => (Array.isArray(d[k]) ? d[k].length : 0);
  const local = b?.local || {};
  const favs = Array.isArray(local["qelvaris-game-favourites"]) ? local["qelvaris-game-favourites"].length : 0;
  return {
    games: count("games"),
    reviews: count("reviews"),
    training: count("training"),
    settings: count("settings"),
    favourites: favs,
    exportedAt: b?.exportedAt || null,
    version: b?.version || 1,
  };
}

// What to do when a push meets the cloud copy. rev = the cloud revision number.
//  "first"    : no cloud copy yet
//  "ok"       : the cloud copy is exactly the one this device last saw
//  "conflict" : another device (or an older session) changed the cloud copy since
export function decidePush(cloudRev, lastSeenRev) {
  if (cloudRev === null || cloudRev === undefined) return "first";
  if (lastSeenRev !== null && lastSeenRev !== undefined && Number(cloudRev) === Number(lastSeenRev)) return "ok";
  return "conflict";
}

// Rows to write into one store.
//  mode "merge"   : only rows this device does not have (nothing local is overwritten)
//  mode "replace" : every cloud row (the caller clears the store first)
export function planRows(localRows, cloudRows, keyPath, mode) {
  const rows = Array.isArray(cloudRows) ? cloudRows : [];
  if (mode === "replace") return rows;
  const have = new Set((Array.isArray(localRows) ? localRows : []).map((r) => r[keyPath]));
  return rows.filter((r) => !have.has(r[keyPath]));
}

// Value for one small localStorage item.
export function planLocalValue(localValue, cloudValue, mode) {
  if (cloudValue === undefined) return localValue;
  if (mode === "replace") return cloudValue;
  if (Array.isArray(localValue) && Array.isArray(cloudValue)) {
    const seen = new Set();
    return [...localValue, ...cloudValue].filter((x) => {
      const k = typeof x === "object" ? JSON.stringify(x) : x;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return localValue === undefined || localValue === null ? cloudValue : localValue;
}

// A brand-new device has no games yet; "replace" is the sensible restore there.
export function recommendedMode(localSummary) {
  return localSummary && localSummary.games > 0 ? "merge" : "replace";
}
