import { litFor } from "./i18n/pages/lit.js";

// Story Review explanation texts (en / es / hi). Pure functions, no app imports, so they can be tested in Node.

const GENERIC_ASK = {
  en: "Before you move, ask: what is my opponent threatening after this move?",
  es: "Antes de mover, pregúntate: ¿qué amenaza mi rival después de esta jugada?",
  hi: "चाल चलने से पहले पूछें: इस चाल के बाद मेरे विरोधी का क्या खतरा है?",
};

const HIGHLIGHT_ASK = {
  en: "Notice how you found it: what did you check before you moved?",
  es: "Fíjate cómo la encontraste: ¿qué comprobaste antes de mover?",
  hi: "ध्यान दें आपने इसे कैसे ढूँढा: चाल चलने से पहले आपने क्या जाँचा था?",
};

const T = {
  swing: {
    en: (b, a) => `Your winning chances went from ${b}% to ${a}%.`,
    es: (b, a) => `Tus probabilidades de ganar pasaron del ${b}% al ${a}%.`,
    hi: (b, a) => `आपकी जीत की संभावना ${b}% से ${a}% हो गई।`,
  },
  brilliant: {
    en: (m) => `${m} is a sacrifice that works. You gave up material, and the engine still rates it the best move.`,
    es: (m) => `${m} es un sacrificio que funciona. Cediste material y aun así el motor la considera la mejor jugada.`,
    hi: (m) => `${m} एक ऐसा बलिदान है जो काम करता है। आपने मोहरे दिए, फिर भी इंजन इसे सबसे अच्छी चाल मानता है।`,
  },
  great: {
    en: (m) => `${m} was the only move that kept your position healthy. Most other moves lose a lot of ground.`,
    es: (m) => `${m} era la única jugada que mantenía sana tu posición. La mayoría de las otras pierden mucho terreno.`,
    hi: (m) => `${m} अकेली ऐसी चाल थी जिसने आपकी पोज़िशन को स्वस्थ रखा। ज़्यादातर दूसरी चालों से बहुत नुकसान होता।`,
  },
  hanging: {
    en: (m) => `After ${m}, one of your pieces could be captured for free.`,
    es: (m) => `Después de ${m}, una de tus piezas podía capturarse gratis.`,
    hi: (m) => `${m} के बाद आपका एक मोहरा मुफ़्त में कैप्चर हो सकता था।`,
  },
  timeSecs: {
    en: (m, n) => `With ${n} seconds left you played ${m}.`,
    es: (m, n) => `Con ${n} segundos restantes jugaste ${m}.`,
    hi: (m, n) => `सिर्फ़ ${n} सेकंड बचे थे और आपने ${m} चली।`,
  },
  timeShort: {
    en: (m) => `Short on time, you played ${m}.`,
    es: (m) => `Con poco tiempo, jugaste ${m}.`,
    hi: (m) => `समय कम था और आपने ${m} चली।`,
  },
  mate: {
    en: (m) => `You had a forced checkmate, but you played ${m}.`,
    es: (m) => `Tenías un jaque mate forzado, pero jugaste ${m}.`,
    hi: (m) => `आपके पास ज़बरदस्ती चेकमेट था, लेकिन आपने ${m} चली।`,
  },
  capture: {
    en: (m) => `A stronger capture was available, but you played ${m}.`,
    es: (m) => `Había una captura más fuerte disponible, pero jugaste ${m}.`,
    hi: (m) => `एक ज़्यादा मज़बूत कैप्चर उपलब्ध था, लेकिन आपने ${m} चली।`,
  },
  opening: {
    en: (m) => `Early in the game, ${m} gave up winning chances.`,
    es: (m) => `Al inicio de la partida, ${m} cedió opciones de ganar.`,
    hi: (m) => `शुरुआत में ही ${m} से जीत के मौके कम हो गए।`,
  },
  blunder: {
    en: (m) => `${m} was a serious error.`,
    es: (m) => `${m} fue un error grave.`,
    hi: (m) => `${m} एक गंभीर गलती थी।`,
  },
  mistake: {
    en: (m) => `${m} was a clear mistake.`,
    es: (m) => `${m} fue un error claro.`,
    hi: (m) => `${m} एक साफ़ गलती थी।`,
  },
  miss: {
    en: (m) => `Your opponent slipped, but ${m} did not take advantage.`,
    es: (m) => `Tu rival falló, pero ${m} no lo aprovechó.`,
    hi: (m) => `विरोधी से चूक हुई, लेकिन ${m} से फ़ायदा नहीं उठाया गया।`,
  },
  slip: {
    en: (m) => `${m} was a small slip.`,
    es: (m) => `${m} fue un pequeño desliz.`,
    hi: (m) => `${m} एक छोटी चूक थी।`,
  },
};

const LANGS = ["en", "es", "hi"];
const cap = (l) => l[0].toUpperCase() + l[1];

// Returns { en, es, hi, askEn, askEs, askHi }
// info: { san, cat, leak, clock, color, evalBefore, before, after, ask }  (before/after = win % of the mover, ask = leak tip in English or null)
export function buildExplanation(info) {
  const { san, cat, leak, clock, color, evalBefore, before, after } = info;
  const out = {};
  const make = (build, ask) => {
    for (const l of LANGS) {
      out[l] = build(l);
      out["ask" + cap(l)] = ask[l];
    }
    return out;
  };

  if (cat === "Brilliant") return make((l) => T.brilliant[l](san), HIGHLIGHT_ASK);
  if (cat === "Great") return make((l) => T.great[l](san), HIGHLIGHT_ASK);

  const ask = info.ask
    ? { en: info.ask, es: litFor("es", info.ask), hi: litFor("hi", info.ask) }
    : GENERIC_ASK;
  const swing = (l) => T.swing[l](before, after);

  let first;
  switch (leak) {
    case "hanging":
      first = (l) => T.hanging[l](san);
      break;
    case "time-trouble": {
      const secs = typeof clock === "number" ? Math.round(clock) : null;
      first = (l) => (secs !== null ? T.timeSecs[l](san, secs) : T.timeShort[l](san));
      break;
    }
    case "missed-tactics": {
      const sign = color === "w" ? 1 : -1;
      const mate = sign * (evalBefore ?? 0) >= 90;
      first = (l) => (mate ? T.mate[l](san) : T.capture[l](san));
      break;
    }
    case "opening-gaps":
      first = (l) => T.opening[l](san);
      break;
    default:
      if (cat === "Blunder") first = (l) => T.blunder[l](san);
      else if (cat === "Mistake") first = (l) => T.mistake[l](san);
      else if (cat === "Miss") first = (l) => T.miss[l](san);
      else first = (l) => T.slip[l](san);
  }

  return make((l) => `${first(l)} ${swing(l)}`, ask);
}
