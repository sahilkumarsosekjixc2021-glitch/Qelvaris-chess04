// QV-PWA: service worker register + "Install app" prompt ko pakadna.
let deferred = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(getInstallState()));
}

export function isStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

export function getInstallState() {
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  return { canInstall: Boolean(deferred), ios, standalone: isStandalone() };
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  fn(getInstallState());
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  try {
    const choice = await deferred.userChoice;
    deferred = null;
    notify();
    return choice.outcome === "accepted";
  } catch {
    return false;
  }
}

export function initPwa() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });

  // Sirf production build mein (dev mein cache se confusion hoti hai)
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("SW register failed:", error));
    });
  }
}
