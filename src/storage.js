// IndexedDB storage helper for Qelvaris.
// Stores: games, reviews, training, settings

import { BACKUP_VERSION, LOCAL_KEYS, isValidBackup, planRows, planLocalValue } from "./features/cloud/backupCore";

const LEGACY_DB_NAME = "qelvaris"; // QV-ACCOUNT: purana, sab accounts ka mila hua DB
let dbName = LEGACY_DB_NAME;
let currentUserId = null;
const OWNER_KEY = "qv-legacy-owner"; // jis account ne purana data apnaya
const LEGACY_LS_GAMES = "qelvarisSavedGames";
const DB_VERSION = 1;

const STORES = {
  games: "id",
  reviews: "gameId",
  training: "id",
  settings: "key",
};

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath });
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function run(storeName, mode, action) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = action(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

// QV-PERF: counts every change to games / reviews so heavy results built from them (leaks.js) can be reused
// until something really changes, instead of being rebuilt on every page visit.
let dataVersion = 0;
export const getDataVersion = () => dataVersion;
const touch = (store) => {
  if (store === "games" || store === "reviews") dataVersion += 1;
};

export const dbPut = (store, value) => run(store, "readwrite", (s) => s.put(value)).then((r) => (touch(store), r));
export const dbGet = (store, key) => run(store, "readonly", (s) => s.get(key));
export const dbAll = (store) => run(store, "readonly", (s) => s.getAll());
export const dbDelete = (store, key) => run(store, "readwrite", (s) => s.delete(key)).then((r) => (touch(store), r));
export const dbClear = (store) => run(store, "readwrite", (s) => s.clear()).then((r) => (touch(store), r));

/* ---------- QV-ACCOUNT: har account ka apna database ----------
   Login ke baad RootApp `await setStorageUser(user.id)` karta hai, uske baad hi baaki app chalti hai.
   Is browser ka purana data (pehle sab accounts ka mila hua) pehle login karne wale account ko mil jata hai.
   Purana DB delete nahi hota, backup ki tarah pada rehta hai. */

function readLegacyStores() {
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(LEGACY_DB_NAME);
    } catch {
      resolve(null);
      return;
    }
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const names = Array.from(db.objectStoreNames).filter((n) => n in STORES);
      if (names.length === 0) {
        // DB pehle se tha hi nahi, hamari open ne khali bana diya: hata do
        db.close();
        try {
          indexedDB.deleteDatabase(LEGACY_DB_NAME);
        } catch {
          /* ignore */
        }
        resolve(null);
        return;
      }
      const tx = db.transaction(names, "readonly");
      const out = {};
      const reqs = names.map((n) => {
        const r = tx.objectStore(n).getAll();
        r.onsuccess = () => {
          out[n] = r.result || [];
        };
        return r;
      });
      void reqs;
      tx.oncomplete = () => {
        db.close();
        resolve(out);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

async function adoptLegacyData(userId) {
  try {
    if (localStorage.getItem(OWNER_KEY)) return; // kisi ne pehle hi apna liya
  } catch {
    return;
  }
  try {
    const legacy = await readLegacyStores();
    if (legacy) {
      for (const [name, rows] of Object.entries(legacy)) {
        for (const row of rows) await dbPut(name, row);
      }
    }
    localStorage.setItem(OWNER_KEY, userId);
  } catch (error) {
    console.error("Could not adopt old data:", error);
  }
}

// Purani localStorage games (leaks.js padhta hai) sirf us account ko dikhein jisne purana data apnaya
function syncLegacyLocal(userId) {
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    if (!owner) return;
    const stash = `${LEGACY_LS_GAMES}:${owner}`;
    if (userId === owner) {
      const saved = localStorage.getItem(stash);
      if (saved !== null && localStorage.getItem(LEGACY_LS_GAMES) === null) {
        localStorage.setItem(LEGACY_LS_GAMES, saved);
      }
    } else {
      const live = localStorage.getItem(LEGACY_LS_GAMES);
      if (live !== null) {
        localStorage.setItem(stash, live);
        localStorage.removeItem(LEGACY_LS_GAMES);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function setStorageUser(userId) {
  const nextName = userId ? `qelvaris-u-${userId}` : LEGACY_DB_NAME;
  if (nextName === dbName && dbPromise) return;

  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
  dataVersion += 1; // another account = another data

  // Purane data ko padhne ke liye adopt se pehle purana naam khula rehna chahiye
  dbName = nextName;
  currentUserId = userId || null;

  if (userId) {
    await adoptLegacyData(userId);
    syncLegacyLocal(userId);
  }
}

export function getStorageUser() {
  return currentUserId;
}

// localStorage ki chhoti cheezein (jaise game favourites) bhi account ke hisaab se
function userKey(key) {
  return currentUserId ? `${key}:${currentUserId}` : key;
}

export function getLocalJSON(key, fallback) {
  try {
    let raw = localStorage.getItem(userKey(key));
    // Purane data wale account ko uski purani (bina account wali) value mile
    if (raw === null && currentUserId && localStorage.getItem(OWNER_KEY) === currentUserId) {
      raw = localStorage.getItem(key);
    }
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setLocalJSON(key, value) {
  try {
    localStorage.setItem(userKey(key), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// Settings shortcuts
export async function getSetting(key, fallback = null) {
  const row = await dbGet("settings", key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return dbPut("settings", { key, value });
}

// Backup: sab data ek JSON file mein (version 2: IndexedDB stores + chhoti localStorage cheezein)
export async function exportAll() {
  const data = {};
  for (const name of Object.keys(STORES)) {
    data[name] = await dbAll(name);
  }
  const local = {};
  for (const key of LOCAL_KEYS) {
    const v = getLocalJSON(key, undefined);
    if (v !== undefined) local[key] = v;
  }
  return {
    app: "qelvaris",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    local,
  };
}

export async function downloadBackup() {
  const backup = await exportAll();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `qelvaris-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// mode "merge"  : sirf wo rows jo is device par nahi hain (local kuch overwrite nahi hota)
// mode "replace": is device ka data cloud/file ki copy se badal do
// Pehle poora backup validate hota hai; kuch bhi badalne se pehle. Har store ek hi transaction mein
// likha jata hai, to beech mein fail hone par us store ka purana data safe rehta hai.
export async function importAll(backup, { mode = "merge" } = {}) {
  if (!isValidBackup(backup)) {
    throw new Error("This is not a valid Qelvaris backup file.");
  }
  const db = await openDb();
  const plans = {};
  for (const [name, keyPath] of Object.entries(STORES)) {
    const local = mode === "replace" ? [] : await dbAll(name);
    plans[name] = planRows(local, backup.data[name], keyPath, mode);
  }
  for (const [name, rows] of Object.entries(plans)) {
    if (mode !== "replace" && rows.length === 0) continue;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(name, "readwrite");
      const store = tx.objectStore(name);
      if (mode === "replace") store.clear();
      for (const row of rows) store.put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  dataVersion += 1; // games/reviews may have changed
  const cloudLocal = backup.local || {};
  for (const key of LOCAL_KEYS) {
    if (cloudLocal[key] === undefined) continue;
    setLocalJSON(key, planLocalValue(getLocalJSON(key, undefined), cloudLocal[key], mode));
  }
}

export async function clearAllData() {
  for (const name of Object.keys(STORES)) {
    await dbClear(name);
  }
}

// Purane localStorage games ko IndexedDB mein COPY karta hai (delete nahi karta),
// taaki purane pages abhi bhi kaam karte rahein.
export async function migrateFromLocalStorage() {
  if (await getSetting("migrated-v1", false)) return;

  try {
    const raw = JSON.parse(localStorage.getItem("qelvarisSavedGames") || "[]");
    const games = Array.isArray(raw) ? raw : [];

    for (let i = 0; i < games.length; i += 1) {
      const game = games[i];
      await dbPut("games", {
        ...game,
        id: game.id ?? `legacy-${i}`,
        source: game.source ?? "legacy",
      });
    }
  } catch (error) {
    console.error("Migration failed:", error);
    return;
  }

  await setSetting("migrated-v1", true);
}