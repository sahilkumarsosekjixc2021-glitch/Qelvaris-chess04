import { getLang } from "../i18n";

// Generic page translator. English text is the key; {name} placeholders are filled from vars.
// Unknown text falls back to English, so nothing breaks if a string is missing.
export function makeT(D) {
  return (en, vars) => {
    const lang = getLang();
    const s = lang === "en" ? en : (D[lang] && D[lang][en]) || en;
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")) : s;
  };
}
