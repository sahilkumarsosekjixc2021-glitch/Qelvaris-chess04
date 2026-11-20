import { LIT as TODAY_LIT, PATTERNS as TODAY_PATTERNS } from "./today.dict.js";
import { LIT as DATA_LIT, PATTERNS as DATA_PATTERNS } from "./data.dict.js";
import { LIT as DATA2_LIT, PATTERNS as DATA2_PATTERNS } from "./data2.dict.js";

// Translate a data string. Unknown text stays as is.
export function litFor(lang, text) {
  if (typeof text !== "string" || lang === "en") return text;
  const exact = DATA_LIT[lang]?.[text] ?? DATA2_LIT[lang]?.[text] ?? TODAY_LIT[lang]?.[text];
  if (exact) return exact;
  // "vs sunil_k · Ruy Lopez" -> translate each part
  const parts = text.split(" · ");
  if (parts.length > 1) return parts.map((p) => litFor(lang, p)).join(" · ");
  for (const [re, fn] of [
    ...(DATA2_PATTERNS[lang] || []).slice(0, 2),
    ...(DATA_PATTERNS[lang] || []),
    ...(DATA2_PATTERNS[lang] || []).slice(2),
    ...(TODAY_PATTERNS[lang] || []),
  ]) {
    const m = text.match(re);
    if (!m) continue;
    const groups = m.slice(1).map((g) => (/^\d+$/.test(g) ? g : litFor(lang, g)));
    if (typeof fn === "function") return fn(...groups);
    return fn.replace(/\$(\d)/g, (_, i) => groups[Number(i) - 1] ?? "");
  }
  return text;
}
