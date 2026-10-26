// IndexedDB storage helper for Qelvaris.
// Stores: games, reviews, training, settings

const DB_NAME = "qelvaris";
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
      const request = indexedDB.open(DB_NAME, DB_VERSION);

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

export const dbPut = (store, value) => run(store, "readwrite", (s) => s.put(value));
export const dbGet = (store, key) => run(store, "readonly", (s) => s.get(key));
export const dbAll = (store) => run(store, "readonly", (s) => s.getAll());
export const dbDelete = (store, key) => run(store, "readwrite", (s) => s.delete(key));
export const dbClear = (store) => run(store, "readwrite", (s) => s.clear());

// Settings shortcuts
export async function getSetting(key, fallback = null) {
  const row = await dbGet("settings", key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return dbPut("settings", { key, value });
}

// Backup: sab data ek JSON file mein
export async function exportAll() {
  const data = {};
  for (const name of Object.keys(STORES)) {
    data[name] = await dbAll(name);
  }
  return {
    app: "qelvaris",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
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

export async function importAll(backup) {
  if (!backup || backup.app !== "qelvaris" || !backup.data) {
    throw new Error("Ye Qelvaris ki backup file nahi hai.");
  }
  for (const name of Object.keys(STORES)) {
    const rows = Array.isArray(backup.data[name]) ? backup.data[name] : [];
    for (const row of rows) {
      await dbPut(name, row);
    }
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