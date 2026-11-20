// Qelvaris Practice — sessions ki storage (existing storage.js ke getSetting/setSetting par).
// Purane data ko nahi chhuata. Chal rahe session ka resume bhi isi se hota hai.

import { getSetting, setSetting } from "../storage";

const KEY = "qelvaris-practice-sessions";
const MAX_SESSIONS = 60;
export const SESSION_SCHEMA_VERSION = 1;

let writeChain = Promise.resolve();
function serial(task) {
  const job = writeChain.then(task);
  writeChain = job.catch(() => {});
  return job;
}

export async function loadSessions() {
  try {
    const value = await getSetting(KEY, []);
    return Array.isArray(value) ? value : [];
  } catch (err) {
    console.error("Could not read practice sessions:", err);
    return [];
  }
}

export function saveSession(session) {
  return serial(async () => {
    const current = await loadSessions();
    const exists = current.some((item) => item.id === session.id);
    const stamped = { ...session, schemaVersion: SESSION_SCHEMA_VERSION, updatedAt: new Date().toISOString() };
    const next = exists
      ? current.map((item) => (item.id === session.id ? stamped : item))
      : [...current, stamped];
    const trimmed = next.slice(-MAX_SESSIONS);
    await setSetting(KEY, trimmed);
    return trimmed;
  });
}
