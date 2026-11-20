import { getLang } from "../../i18n/i18n";
import { D } from "./dict.js";
export function ot(key, vars = {}) {
  const s = (D[getLang()] || D.en)[key] ?? D.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
