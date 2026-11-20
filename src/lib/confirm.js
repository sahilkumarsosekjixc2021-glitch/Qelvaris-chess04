// askConfirm(message, { danger }) -> Promise<boolean>. Replaces the browser's window.confirm popup with
// the site's own dialog (see components/ConfirmHost.jsx). Falls back to window.confirm if the host is not mounted.
let handler = null;
export function registerConfirmHost(fn) {
  handler = fn;
  return () => { if (handler === fn) handler = null; };
}
export function askConfirm(message, opts = {}) {
  if (handler) return handler(String(message), opts);
  return Promise.resolve(typeof window !== "undefined" ? window.confirm(String(message)) : false);
}
