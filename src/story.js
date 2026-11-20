import { LEAK_DEFS } from "./leaks";
import { moverWin } from "./chessUtils";
import { buildExplanation } from "./storyText.js";

/*
  Story Review: picks the 3 moments that mattered and explains each one
  in English, Spanish and Hindi.
*/

// "8. Ne5" or "8... Ne5"
export function moveLabel(move) {
  return `${move.moveNumber}${move.color === "w" ? "." : "..."} ${move.san}`;
}

export function betterLabel(move) {
  if (!move.bestSan) return "";
  return `${move.moveNumber}${move.color === "w" ? "." : "..."} ${move.bestSan}`;
}

/*
  The 3 mistakes that cost the most. If there are fewer than 3, fill up with Brilliant / Great moves.
  Result is in move order.
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
  const def = LEAK_DEFS.find((item) => item.id === move.leak);
  return buildExplanation({
    san: move.san,
    cat: move.cat,
    leak: move.leak,
    clock: move.clock,
    color: move.color,
    evalBefore: move.evalBefore,
    before: Math.round(moverWin(move.evalBefore ?? 0, move.color)),
    after: Math.round(moverWin(move.evalAfter ?? 0, move.color)),
    ask: def ? def.ask : null,
  });
}
