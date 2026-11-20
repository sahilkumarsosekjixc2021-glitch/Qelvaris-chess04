import { getLang } from "../../i18n/i18n";
const D = {
  en: {
    btn: "Coach whisper",
    again: "More help",
    off: "Wait for your turn",
    thinking: "Thinking…",
    fail: "The coach could not look at this position. Try again.",
    w1capture: "A capture here is worth a look.",
    w1check: "Look at your checks. One of them matters.",
    w1castle: "Your king's safety is the idea here.",
    w1promo: "A pawn is about to become something stronger.",
    w1quiet: "No capture needed. Think about your least active piece.",
    w2: "Look at your {piece}.",
    w3: "The idea: {san} ({from} to {to}).",
    note: "Hints are for practice. Use them to learn, then try without.",
    piece: { pawn: "pawn", knight: "knight", bishop: "bishop", rook: "rook", queen: "queen", king: "king" },
  },
  es: {
    btn: "Susurro del coach",
    again: "Más ayuda",
    off: "Espera tu turno",
    thinking: "Pensando…",
    fail: "El coach no pudo analizar la posición. Inténtalo de nuevo.",
    w1capture: "Vale la pena mirar una captura.",
    w1check: "Mira tus jaques. Uno importa.",
    w1castle: "La seguridad de tu rey es la idea.",
    w1promo: "Un peón está por convertirse en algo más fuerte.",
    w1quiet: "No hace falta capturar. Piensa en tu pieza menos activa.",
    w2: "Mira tu {piece}.",
    w3: "La idea: {san} ({from} a {to}).",
    note: "Las pistas son para practicar. Aprende y luego prueba sin ellas.",
    piece: { pawn: "peón", knight: "caballo", bishop: "alfil", rook: "torre", queen: "dama", king: "rey" },
  },
  hi: {
    btn: "कोच का इशारा",
    again: "और मदद",
    off: "अपनी बारी का इंतज़ार करें",
    thinking: "सोच रहा है…",
    fail: "कोच इस पोज़िशन को नहीं देख पाया। फिर कोशिश करें।",
    w1capture: "यहाँ कोई कैप्चर देखने लायक है।",
    w1check: "अपने चेक देखिए। उनमें से एक ज़रूरी है।",
    w1castle: "आपके राजा की सुरक्षा यहाँ का आइडिया है।",
    w1promo: "एक प्यादा और ताकतवर बनने वाला है।",
    w1quiet: "कैप्चर की ज़रूरत नहीं। अपने सबसे कम सक्रिय मोहरे के बारे में सोचिए।",
    w2: "अपने {piece} को देखिए।",
    w3: "आइडिया: {san} ({from} से {to})।",
    note: "हिंट प्रैक्टिस के लिए हैं। सीखिए, फिर बिना हिंट खेलिए।",
    piece: { pawn: "प्यादा", knight: "घोड़ा", bishop: "ऊँट", rook: "हाथी", queen: "वज़ीर", king: "राजा" },
  },
};
const dict = () => D[getLang()] || D.en;
export function wt(key, vars = {}) {
  const d = dict();
  const s = typeof d[key] === "string" ? d[key] : D.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k === "piece" ? d.piece[vars[k]] ?? vars[k] : vars[k] ?? ""));
}
