// QV-TRACK: apna chhota event + error tracking (Supabase `events` table mein). Koi extra library nahi.
// - Fire-and-forget: fail ho toh app par koi asar nahi
// - Do Not Track on ho toh kuch nahi bhejta
// - Table banane ka SQL: supabase_events.sql
const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MAX_PER_SESSION = 120;
const FLUSH_MS = 4000;

let userId = null;
let queue = [];
let timer = null;
let sent = 0;
let sessionId = null;
let broken = false; // table nahi bani / permission galat: us session mein events bhejna band

function disabled() {
  try {
    return broken || !URL_BASE || !KEY || navigator.doNotTrack === "1";
  } catch {
    return true;
  }
}

function getSession() {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem("qv-sid");
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("qv-sid", sessionId);
    }
  } catch {
    sessionId = Math.random().toString(36).slice(2);
  }
  return sessionId;
}

export function setTrackUser(id) {
  userId = id || null;
}

function flush() {
  timer = null;
  if (!queue.length || disabled()) {
    queue = [];
    return;
  }
  const rows = queue;
  queue = [];
  try {
    fetch(`${URL_BASE}/rest/v1/events`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    })
      .then((res) => {
        if (!res.ok && [400, 401, 403, 404].includes(res.status)) broken = true;
      })
      .catch(() => {});
  } catch {
    /* ignore */
  }
}

export function track(name, props = {}) {
  if (disabled() || sent >= MAX_PER_SESSION) return;
  sent += 1;
  queue.push({
    name: String(name).slice(0, 50),
    user_id: userId,
    session_id: getSession(),
    path: window.location.pathname + window.location.search.slice(0, 40),
    props,
  });
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/* ---------- Errors ---------- */

const seenErrors = new Set();
let errorCount = 0;

export function trackError(kind, error, extra = {}) {
  try {
    if (errorCount >= 10) return;
    const message = String(error?.message || error || "unknown").slice(0, 200);
    const key = `${kind}:${message}`;
    if (seenErrors.has(key)) return;
    seenErrors.add(key);
    errorCount += 1;
    track("error", {
      kind,
      message,
      stack: String(error?.stack || "").slice(0, 600),
      ...extra,
    });
  } catch {
    /* ignore */
  }
}

export function installErrorTracking() {
  window.addEventListener("error", (e) => {
    trackError("window", e.error || e.message, { file: String(e.filename || "").slice(-60), line: e.lineno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    trackError("promise", e.reason);
  });
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
