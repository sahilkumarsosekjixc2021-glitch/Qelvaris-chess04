import { getLang } from "../i18n";
import { D } from "./today.dict.js";
import { litFor } from "./lit.js";

export function td(key, vars = {}) {
  const s = (D[getLang()] || D.en)[key] ?? D.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// Translate a data string (plan step, mission, leak name). Unknown text stays as is.
export function lit(text) {
  return litFor(getLang(), text);
}
