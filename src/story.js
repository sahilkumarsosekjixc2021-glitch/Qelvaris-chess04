import { LEAK_DEFS } from "./leaks";
import { moverWin } from "./chessUtils";

/*
  Story Review ka dimaag: kaun se 3 moments chune jaayein, aur har moment ki wajah
  English aur Hindi (Roman) mein.
*/

const GENERIC_ASK = {
  en: "Before you move, ask: what is my opponent threatening after this move?",
  hi: "Chalne se pehle poochiye: is chaal ke baad mere opponent ka kya threat hai?",
};

const HIGHLIGHT_ASK = {
  en: "Notice how you found it: what did you check before you moved?",
  hi: "Dhyan dijiye aapne ise kaise dhundha: chalne se pehle aapne kya check kiya tha?",
};

// "8. Ne5" ya "8... Ne5"
export function moveLabel(move) {
  return `${move.moveNumber}${move.color === "w" ? "." : "..."} ${move.san}`;
}

export function betterLabel(move) {
  if (!move.bestSan) return "";
  return `${move.moveNumber}${move.color === "w" ? "." : "..."} ${move.bestSan}`;
}

/*
  Sabse zyada nuksaan wali 3 galtiyan. Agar 3 se kam hain toh Brilliant / Great moves se bharte hain.
  Result move number ke order mein.
*/
export function pickTurningPoints(userMoves, max = 3) {
  const mistakes = userMoves
    .filter((m) => m.isError && (m.winLoss || 0) >= 6)
    .sort((a, b) => b.winLoss - a.winLoss)
    .slice(0, max)
    .map((m) => ({ ...m, kind: "mistake" }));

  const chosen = [...mistakes];

  if (chosen.length < max) {
    const rank = { Brilliant: 0, Great: 1 };
    const highlights = userMoves
      .filter((m) => m.cat === "Brilliant" || m.cat === "Great")
      .sort((a, b) => rank[a.cat] - rank[b.cat])
      .slice(0, max - chosen.length)
      .map((m) => ({ ...m, kind: "highlight" }));

    chosen.push(...highlights);
  }

  return chosen.sort((a, b) => a.ply - b.ply);
}

export function explainMoment(move) {
  const before = Math.round(moverWin(move.evalBefore ?? 0, move.color));
  const after = Math.round(moverWin(move.evalAfter ?? 0, move.color));
  const swingEn = `Your winning chances went from ${before}% to ${after}%.`;
  const swingHi = `Aapke jeetne ke chance ${before}% se ${after}% par aa gaye.`;
  const san = move.san;

  if (move.cat === "Brilliant") {
    return {
      en: `${san} is a sacrifice that works. You gave up material, and the engine still rates it the best move.`,
      hi: `${san} ek aisi qurbani hai jo kaam karti hai. Aapne material diya, phir bhi engine ise sabse achhi chaal maanta hai.`,
      askEn: HIGHLIGHT_ASK.en,
      askHi: HIGHLIGHT_ASK.hi,
    };
  }

  if (move.cat === "Great") {
    return {
      en: `${san} was the only move that kept your position healthy. Most other moves lose a lot of ground.`,
      hi: `${san} akeli aisi chaal thi jisne aapki position ko majboot rakha. Baaki zyadatar chaalon se bahut nuksaan hota.`,
      askEn: HIGHLIGHT_ASK.en,
      askHi: HIGHLIGHT_ASK.hi,
    };
  }

  const def = LEAK_DEFS.find((item) => item.id === move.leak);
  const askEn = def ? def.ask : GENERIC_ASK.en;
  const askHi = def ? def.askHindi : GENERIC_ASK.hi;

  let en;
  let hi;

  switch (move.leak) {
    case "hanging":
      en = `After ${san}, one of your pieces could be captured for free. ${swingEn}`;
      hi = `${san} ke baad aapka ek piece muft mein capture ho sakta tha. ${swingHi}`;
      break;

    case "time-trouble": {
      const secs = typeof move.clock === "number" ? Math.round(move.clock) : null;
      en = `${secs !== null ? `With ${secs} seconds left you played ${san}.` : `Short on time, you played ${san}.`} ${swingEn}`;
      hi = `${secs !== null ? `Sirf ${secs} second bache the aur aapne ${san} chali.` : `Time kam tha aur aapne ${san} chali.`} ${swingHi}`;
      break;
    }

    case "missed-tactics": {
      const sign = move.color === "w" ? 1 : -1;
      const mate = sign * (move.evalBefore ?? 0) >= 90;
      en = mate
        ? `You had a forced checkmate, but you played ${san}. ${swingEn}`
        : `A stronger capture was available, but you played ${san}. ${swingEn}`;
      hi = mate
        ? `Aapke paas forced checkmate tha, lekin aapne ${san} chali. ${swingHi}`
        : `Ek zyada majboot capture maujood tha, lekin aapne ${san} chali. ${swingHi}`;
      break;
    }

    case "opening-gaps":
      en = `Early in the game, ${san} gave up winning chances. ${swingEn}`;
      hi = `Shuruaat mein hi ${san} se jeetne ke chance kam ho gaye. ${swingHi}`;
      break;

    default:
      if (move.cat === "Blunder") {
        en = `${san} was a serious error. ${swingEn}`;
        hi = `${san} ek badi galti thi. ${swingHi}`;
      } else if (move.cat === "Mistake") {
        en = `${san} was a clear mistake. ${swingEn}`;
        hi = `${san} ek saaf galti thi. ${swingHi}`;
      } else if (move.cat === "Miss") {
        en = `Your opponent slipped, but ${san} did not take advantage. ${swingEn}`;
        hi = `Opponent se chook hui, lekin ${san} se faayda nahi uthaya gaya. ${swingHi}`;
      } else {
        en = `${san} was a small slip. ${swingEn}`;
        hi = `${san} ek chhoti chook thi. ${swingHi}`;
      }
  }

  return { en, hi, askEn, askHi };
}