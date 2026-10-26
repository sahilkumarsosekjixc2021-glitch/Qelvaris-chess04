import { Chess } from "chess.js";
import { dbAll } from "./storage";

/*
  Mission Play ka dimaag: missions, "muft mein kaun sa piece lag sakta hai", aur result ka faisla.
*/

export const MISSIONS = [
  {
    id: "safe-hands",
    title: "Safe hands",
    goal: "Win without leaving a piece hanging.",
    leak: "hanging",
    tag: "Hanging pieces",
    pauses: 2,
  },
  {
    id: "clock-calm",
    title: "Clock calm",
    goal: "Reach move 25 with 3+ minutes left.",
    leak: "time-trouble",
    tag: "Time trouble",
    pauses: 0,
  },
  {
    id: "convert-win",
    title: "Convert the win",
    goal: "Start a winning endgame and finish it.",
    leak: "endgame-conversion",
    tag: "Endgames",
    pauses: 0,
  },
  {
    id: "clean-game",
    title: "Clean game",
    goal: "Play a game and check every move before you play it.",
    leak: null,
    tag: "Any leak",
    pauses: 0,
  },
];

export const MIN_MOVES = 25;
export const CALM_SECONDS = 180;

export function missionFor(leakId) {
  return MISSIONS.find((m) => m.leak === leakId) || MISSIONS.find((m) => m.id === "clean-game");
}

export const TIME_CHOICES = [5, 10, 15];

/* ---------- Muft mein lagne wale pieces ---------- */

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Capture "muft" tab hai jab wapas capture nahi ho sakta, ya jab bada piece chhote ke badle mil jaye (2+ ka fayda).
function isFree(chess, move) {
  if (!move.captured || move.captured === "k") return false;

  const gain = VALUE[move.captured];
  const risk = VALUE[move.piece];

  chess.move(move);
  const recapture = chess.moves({ verbose: true }).some((m) => m.to === move.to && m.captured);
  chess.undo();

  return !recapture ? gain > 0 : gain - risk >= 2;
}

function withTurn(fen, color) {
  const parts = String(fen).split(" ");
  parts[1] = color;
  parts[3] = "-";
  return parts.join(" ");
}

// `color` ke wo pieces jinhe opponent abhi muft mein le sakta hai: [{ square, piece }]
export function hangingPieces(fen, color) {
  try {
    const chess = new Chess(withTurn(fen, color === "w" ? "b" : "w"));
    const found = new Map();

    for (const move of chess.moves({ verbose: true })) {
      if (isFree(chess, move) && !found.has(move.to)) found.set(move.to, { square: move.to, piece: move.captured });
    }

    return [...found.values()];
  } catch {
    return [];
  }
}

// Bot ne abhi jo chaal chali, kya usne muft mein piece liya? (chaal chalne se pehle ki position)
export function wasFreeCapture(fenBefore, from, to, promotion) {
  try {
    const chess = new Chess(fenBefore);
    const move = chess.move({ from, to, promotion });
    if (!move) return false;
    chess.undo();
    return isFree(chess, move);
  } catch {
    return false;
  }
}

const PIECE_NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
export const pieceName = (code) => PIECE_NAME[code] || "piece";

/* ---------- Convert the win: shuruaati position ---------- */

const STANDARD_ENDGAMES = [
  "8/5k2/8/8/8/8/2Q5/4K3 w - - 0 1",
  "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
  "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
];

// Pehle aapki apni games ki jeetne wali endgame positions (Leak Lab se), warna ek standard
export async function pickEndgame() {
  try {
    const items = (await dbAll("training")).filter((item) => item.leak === "endgame-conversion" && item.fen);
    const usable = items.filter((item) => {
      try {
        const chess = new Chess(item.fen);
        return !chess.isGameOver();
      } catch {
        return false;
      }
    });

    if (usable.length) {
      const item = usable[Math.floor(Math.random() * usable.length)];
      return { fen: item.fen, userColor: item.userColor === "b" ? "b" : "w", own: true };
    }
  } catch {
    // niche standard position
  }

  return { fen: STANDARD_ENDGAMES[Math.floor(Math.random() * STANDARD_ENDGAMES.length)], userColor: "w", own: false };
}

/* ---------- Result ---------- */

export const mmss = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const hms = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function userWon(result, color) {
  return (result === "1-0" && color === "w") || (result === "0-1" && color === "b");
}

// { done: bool, title, text } mission ke natije ke liye
export function missionOutcome(mission, { result, userColor, freeLost, clockAt25, reason }) {
  const won = userWon(result, userColor);
  const draw = result === "1/2-1/2";

  if (!mission) {
    return {
      done: false,
      title: won ? "You won" : draw ? "Draw" : "You lost",
      text: reason ? `The game ended by ${reason}.` : "The game is over.",
    };
  }

  if (mission.id === "safe-hands") {
    if (reason === "resignation") {
      return { done: false, title: "Not counted", text: "You resigned, so this mission does not count. Try again." };
    }
    if (won && freeLost === 0) {
      return { done: true, title: "Mission complete", text: "You won and never left a piece to be taken for free." };
    }
    if (won) {
      return {
        done: false,
        title: "Won, but not clean",
        text: `You won, but ${freeLost} ${freeLost === 1 ? "piece was" : "pieces were"} taken for free. A clean win is needed.`,
      };
    }
    if (freeLost === 0) {
      return { done: false, title: "Clean, but not a win", text: "No piece was lost for free, but the game was not won." };
    }
    return {
      done: false,
      title: "Not this time",
      text: `${freeLost} ${freeLost === 1 ? "piece was" : "pieces were"} taken for free. Check every piece before you move.`,
    };
  }

  if (mission.id === "clock-calm") {
    if (clockAt25 === null) {
      return { done: false, title: "Move 25 not reached", text: `The game ended before move ${MIN_MOVES}, so the clock goal could not be tested.` };
    }
    if (clockAt25 >= CALM_SECONDS) {
      return { done: true, title: "Mission complete", text: `You reached move ${MIN_MOVES} with ${mmss(clockAt25)} left.` };
    }
    return { done: false, title: "Not this time", text: `At move ${MIN_MOVES} you had ${mmss(clockAt25)} left. The goal is 3:00 or more.` };
  }

  if (mission.id === "clean-game") {
    return { done: false, pending: true, title: "Checking your game", text: "The engine is looking for mistakes. This takes a moment." };
  }

  if (won) return { done: true, title: "Mission complete", text: "You turned the winning endgame into a win." };
  if (draw) return { done: false, title: "Not converted", text: "The winning endgame ended in a draw." };
  return { done: false, title: "Not converted", text: "The winning endgame was lost." };
}

// Clean game: analysis ke baad, kya aapki koi chaal Mistake ya Blunder thi?
export function cleanOutcome(userMoves) {
  const bad = userMoves.filter((m) => m.cat === "Mistake" || m.cat === "Blunder").length;
  return bad === 0
    ? { done: true, title: "Mission complete", text: "No mistakes and no blunders. Every move held up." }
    : {
        done: false,
        title: "Not this time",
        text: `${bad} ${bad === 1 ? "move was a mistake or blunder" : "moves were mistakes or blunders"}. Check the turning point below.`,
      };
}