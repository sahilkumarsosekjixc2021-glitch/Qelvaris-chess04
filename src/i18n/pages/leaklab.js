import { getLang } from "../i18n";
import { D } from "./leaklab.dict.js";

export function ll(key, vars = {}) {
  const s = (D[getLang()] || D.en)[key] ?? D.en[key] ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
