// Collects a short, privacy-safe summary for support. Browser only.
// Never includes e-mail, password, tokens or game moves: only counts and technical facts.
import { exportAll } from "../../storage";
import { recentErrors } from "../../lib/errorReport";
import { supabase } from "../../lib/supabase";
import { APP_VERSION, buildReport } from "./supportCore";

export async function collectDiagnostics(page = "") {
  const info = {
    version: APP_VERSION,
    time: new Date().toISOString(),
    page,
    language: navigator.language,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    standalone: !!(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone),
    errors: recentErrors(),
  };
  try {
    const { data } = await supabase.auth.getSession();
    const id = data?.session?.user?.id;
    info.signedIn = !!id;
    info.shortId = id ? id.slice(0, 8) : "";
  } catch { info.signedIn = false; }
  try {
    const p = await exportAll();
    const n = (k) => (Array.isArray(p?.data?.[k]) ? p.data[k].length : 0);
    info.counts = `games ${n("games")}, reviews ${n("reviews")}, training ${n("training")}`;
  } catch { info.counts = "unreadable"; }
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    info.storage = `persistent ${persisted === null ? "unknown" : persisted ? "yes" : "no"}` + (est?.usage ? `, used ${Math.round(est.usage / 1048576)} MB` : "");
  } catch { info.storage = "unknown"; }
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("qelvaris-sync:"));
    const s = keys.length ? JSON.parse(localStorage.getItem(keys[0]) || "{}") : null;
    info.lastBackup = s?.at || "";
  } catch { /* ignore */ }
  return { info, text: buildReport(info) };
}

// Fresh files WITHOUT touching IndexedDB or localStorage (games, streak, settings stay).
export async function refreshAppFiles() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch { /* still reload */ }
  window.location.reload();
}
