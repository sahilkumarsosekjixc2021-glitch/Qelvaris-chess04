// Pure helpers for the support card (no browser access, so tests can run them).
export const APP_VERSION = "2026.11.16-b31";

const clean = (v, max = 160) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, max);

// info -> plain text a player can paste into an e-mail. Never contains e-mail, password or game moves.
export function buildReport(info) {
  const lines = [
    `Qelvaris ${clean(info.version)}`,
    `Time: ${clean(info.time)}`,
    `Page: ${clean(info.page)}`,
    `Signed in: ${info.signedIn ? "yes" : "no"}${info.shortId ? ` (id ${clean(info.shortId, 8)})` : ""}`,
    `Language: ${clean(info.language)}  Online: ${info.online ? "yes" : "no"}`,
    `Device: ${clean(info.userAgent, 140)}`,
    `Screen: ${clean(info.screen)}  Installed app: ${info.standalone ? "yes" : "no"}`,
    `Storage: ${clean(info.storage)}`,
    `Data on this device: ${clean(info.counts)}`,
    `Last cloud backup: ${clean(info.lastBackup || "none")}`,
  ];
  const errs = Array.isArray(info.errors) ? info.errors.slice(-5) : [];
  lines.push(errs.length ? "Recent problems:" : "Recent problems: none");
  for (const e of errs) lines.push(`- ${clean(e, 200)}`);
  return lines.join("\n");
}

// mailto: bodies get cut by some mail apps, so keep it short.
export function mailtoLink(email, subject, report, max = 1400) {
  const body = `Please describe what happened:\n\n\n---\n${report}`.slice(0, max);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
