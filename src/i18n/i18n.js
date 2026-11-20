// Chhota i18n: t("key", {vars}), useT() hook (language badalte hi UI update), auto-detect + yaad rakhna.
// Nayi bhasha: locales/<code>.js banao, neeche LOCALES mein jodo. Jo key na mile wo English se aati hai.
import { useSyncExternalStore } from "react";
import en from "./locales/en";
import es from "./locales/es";
import hi from "./locales/hi";

const LOCALES = { en, es, hi };
export const LANGS = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "hi", label: "हिन्दी" },
];
const STORE_KEY = "qv-ui-lang";

function detect() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && LOCALES[saved]) return saved;
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    for (const l of list) {
      const code = String(l).slice(0, 2).toLowerCase();
      if (LOCALES[code]) return code;
    }
  } catch {
    /* ignore */
  }
  return "en";
}

let current = detect();
const listeners = new Set();
try {
  document.documentElement.lang = current;
} catch {
  /* ignore */
}

export const getLang = () => current;
export function setLang(id) {
  if (!LOCALES[id] || id === current) return;
  current = id;
  try {
    localStorage.setItem(STORE_KEY, id);
    document.documentElement.lang = id;
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function fill(str, vars) {
  return vars ? str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : str;
}

export function t(key, vars) {
  const s = LOCALES[current]?.[key] ?? en[key] ?? key;
  return fill(s, vars);
}

// Lesson/course ka text: overlay mein ho toh wo, warna lessons.generated ka English.
//   tl("tactics/forks", "title", fallback)      step: tl("tactics/forks#3", "prompt", fallback)
export function tl(id, field, fallback) {
  return LOCALES[current]?.lessons?.[id]?.[field] ?? fallback;
}

export function useT() {
  useSyncExternalStore(subscribe, getLang, getLang);
  return t;
}
