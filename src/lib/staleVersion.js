// After every deploy, people with an OLD tab open ask the server for files that no longer exist
// ("Failed to fetch dynamically imported module"). That looks like "the site is broken".
// We detect it and reload once to fetch the new version.
export function isStaleVersionError(err) {
  const m = String(err?.message || err || "");
  return /dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk .* failed|error loading dynamically/i.test(m);
}

const KEY = "qelvaris-stale-reload";
// Returns true if it triggered a reload. Only once per 60 s so a real outage cannot cause a reload loop.
export function reloadOnceForNewVersion(storage = typeof sessionStorage !== "undefined" ? sessionStorage : null, now = Date.now(), reload = () => window.location.reload()) {
  try {
    const last = Number(storage?.getItem(KEY) || 0);
    if (now - last < 60000) return false;
    storage?.setItem(KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}
