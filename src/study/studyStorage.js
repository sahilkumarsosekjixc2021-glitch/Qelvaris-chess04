// Qelvaris Study — attempts aur drafts ki storage.
// Existing storage.js ke getSetting/setSetting use karta hai (account-wise DB). Purana data nahi chhuata.

import { getSetting, setSetting } from "../storage";

const KEY = "qelvaris-study-attempts";
const DRAFT_KEY = "qelvaris-study-drafts";
const MAX_ATTEMPTS = 200;
export const ATTEMPT_SCHEMA_VERSION = 1;

// Read-modify-write ek ke baad ek chale, taaki tezi se save hone par data na khoye
let writeChain = Promise.resolve();
function serial(task) {
  const job = writeChain.then(task);
  writeChain = job.catch(() => {});
  return job;
}

export async function loadAttempts() {
  try {
    const value = await getSetting(KEY, []);
    return Array.isArray(value) ? value : [];
  } catch (err) {
    console.error("Could not read study attempts:", err);
    return [];
  }
}

// Completed attempts history ki tarah rakhe jaate hain (overwrite nahi hote)
export function saveAttempt(attempt) {
  return serial(async () => {
    const current = await loadAttempts();
    const next = [
      ...current.filter((item) => item.id !== attempt.id),
      { ...attempt, schemaVersion: ATTEMPT_SCHEMA_VERSION },
    ].slice(-MAX_ATTEMPTS);

    await setSetting(KEY, next);
    return next;
  });
}

/* ---------- Drafts: beech mein chhode hue exercise ka progress ---------- */

async function readDrafts() {
  try {
    const value = await getSetting(DRAFT_KEY, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export async function loadDraft(exerciseId) {
  const all = await readDrafts();
  return all[exerciseId] || null;
}

export function saveDraft(draft) {
  return serial(async () => {
    const all = await readDrafts();
    await setSetting(DRAFT_KEY, {
      ...all,
      [draft.exerciseId]: { ...draft, savedAt: new Date().toISOString() },
    });
  });
}

export function clearDraft(exerciseId) {
  return serial(async () => {
    const all = await readDrafts();
    if (!(exerciseId in all)) return;
    const { [exerciseId]: _removed, ...rest } = all;
    await setSetting(DRAFT_KEY, rest);
  });
}
