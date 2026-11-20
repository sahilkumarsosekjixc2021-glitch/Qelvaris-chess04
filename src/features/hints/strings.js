import { getLang } from "../../i18n/i18n";
const D = {
  en: { btn: "Coach hint", l1: "Hint 1: your {piece} has a useful move. Look at it.", l2: "Hint 2: the highlighted piece is the one to move.", l3: "Hint 3: the best idea is {san}.", more: "Another hint", thinking: "Thinking…", off: "Hints are not available right now.", used: "Hints used: {n}", wait: "Hints work on your turn." },
  es: { btn: "Pista del Coach", l1: "Pista 1: tu {piece} tiene una jugada útil. Míralo.", l2: "Pista 2: la pieza resaltada es la que debes mover.", l3: "Pista 3: la mejor idea es {san}.", more: "Otra pista", thinking: "Pensando…", off: "Las pistas no están disponibles ahora.", used: "Pistas usadas: {n}", wait: "Las pistas funcionan en tu turno." },
  hi: { btn: "Coach हिंट", l1: "हिंट 1: आपके {piece} के पास एक काम की चाल है। उसे देखें।", l2: "हिंट 2: जो मोहरा हाइलाइट है, उसे चलाएँ।", l3: "हिंट 3: सबसे अच्छा आइडिया {san} है।", more: "एक और हिंट", thinking: "सोच रहा है…", off: "अभी हिंट उपलब्ध नहीं हैं।", used: "इस्तेमाल हुए हिंट: {n}", wait: "हिंट आपकी बारी पर काम करते हैं।" },
};
export function ht(key, vars = {}) {
  const s = (D[getLang()] || D.en)[key] ?? D.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
