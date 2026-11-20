// Central place for reporting problems. Playbook layers 13 (logs/errors) and 10 (never log secrets).
// Errors are sent through the existing telemetry (the Supabase "events" table, insert-only) with
// secrets and e-mail addresses removed, capped per session so a crash loop cannot flood the database.
import { track } from "../features/telemetry/track";
import { isStaleVersionError, reloadOnceForNewVersion } from "./staleVersion";

const SECRET_KEY = /pass(word)?|token|secret|authorization|api[-_]?key|cookie|session|email|jwt/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const LONG_TOKEN = /\b(eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|[A-Za-z0-9_-]{32,})\b/g; // JWTs and long keys

export function redactText(value, max = 300) {
  return String(value ?? "").replace(EMAIL, "[email]").replace(LONG_TOKEN, "[token]").slice(0, max);
}

export function redact(obj, depth = 0) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return redactText(obj);
  if (typeof obj !== "object") return obj;
  if (depth > 3) return "[deep]";
  if (Array.isArray(obj)) return obj.slice(0, 10).map((x) => redact(x, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
  return out;
}

// The last few problems of this visit, so "Copy diagnostics" can include them (already redacted).
const recent = [];
export const recentErrors = () => recent.slice();

const MAX_PER_SESSION = 8;
let sent = 0;
const seen = new Set();

export function reportError(error, context = {}) {
  try {
    const message = redactText(error?.message || error, 200);
    const where = redactText(String(error?.stack || "").split("\n").slice(1, 3).join(" | "), 240);
    recent.push(message);
    if (recent.length > 10) recent.shift();
    if (isStaleVersionError(error)) { reloadOnceForNewVersion(); return; } // new deploy: just load the new version
    const key = message + where;
    if (seen.has(key) || sent >= MAX_PER_SESSION) return;
    seen.add(key);
    sent += 1;
    track("client_error", { message, where, page: location.pathname + location.search.replace(/[?&](code|token|access_token)=[^&]*/g, ""), ...redact(context) });
  } catch {
    /* reporting must never throw */
  }
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    if (!e.error && /ResizeObserver/.test(e.message || "")) return; // harmless browser noise
    reportError(e.error || e.message, { kind: "window.error" });
  });
  // Vite fires this when a lazy page file is gone after a new deploy
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault?.(); reloadOnceForNewVersion(); });
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, { kind: "unhandledrejection" }));
}
