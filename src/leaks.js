import { Chess } from "chess.js";
import { dbAll, dbGet } from "./storage";
import { fromLegacyAnalysis, moverWin, parseGame, summarize } from "./chessUtils";

/*
  Leak engine.
  Reviewed games ko "leaks" mein badalta hai: wo aadatein jo baar-baar rating points khati hain.
  DNA, Today, Leak Lab aur Story Review isi file ko use karenge.
*/

const LEGACY_KEY = "qelvarisSavedGames";
const ERROR_CATS = ["Inaccuracy", "Mistake", "Miss", "Blunder"];
const SERIOUS_CATS = ["Mistake", "Miss", "Blunder"];
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// 1 percentage point jeetne ke chance ~ 6.95 Elo points (Elo formula ka slope)
const POINTS_PER_PERCENT = 6.95;

// Ek galti ek hi leak mein ginti jaati hai, taaki points double count na hon
const PRIORITY = ["time-trouble", "hanging", "missed-tactics", "opening-gaps"];

export const LEAK_DEFS = [
  {
    id: "hanging",
    title: "Hanging pieces",
    skill: "Tactics",
    text: "A piece was left where the opponent could win it for free.",
    ask: "Before you move, ask: what can capture the piece I just moved?",
    askHindi: "Chalne se pehle poochiye: ab mere piece ko kaun capture kar sakta hai?",
  },
  {
    id: "time-trouble",
    title: "Time trouble",
    skill: "Time use",
    text: "Serious mistakes after move 25 with under a minute left.",
    ask: "When the clock is low, play the safe move you already know instead of searching for the best one.",
    askHindi: "Clock kam ho toh best move dhundhne ki jagah wahi safe chaal chaliye jo aap pehle se jante hain.",
  },
  {
    id: "missed-tactics",
    title: "Missed tactics",
    skill: "Tactics",
    text: "A capture or a forced mate was on the board and you did not play it.",
    ask: "Before every move, list the checks, captures and threats for both sides.",
    askHindi: "Har chaal se pehle dono taraf ke check, capture aur threat ki list banaiye.",
  },
  {
    id: "endgame-conversion",
    title: "Endgame conversion",
    skill: "Converting wins",
    text: "You reached a winning endgame and did not win the game.",
    ask: "When you are winning, trade pieces, keep your king safe and avoid risky plans.",
    askHindi: "Jab aap jeet rahe hon, pieces exchange kijiye, king surakshit rakhiye aur risky plan mat banaiye.",
  },
  {
    id: "opening-gaps",
    title: "Opening gaps",
    skill: "Openings",
    text: "Early slips before move 10 that cost winning chances.",
    ask: "In the first ten moves, develop pieces, castle, and do not move the same piece twice without a reason.",
    askHindi: "Pehli das chaalon mein pieces nikaaliye, castle kijiye, aur bina wajah ek hi piece dobara mat chaliye.",
  },
  {
    id: "back-rank",
    title: "Back-rank mates",
    skill: "Defence",
    text: "You were checkmated on your first rank.",
    ask: "Give your king an escape square before the rooks come to the open files.",
    askHindi: "Rooks open file par aayein usse pehle apne king ko nikalne ki jagah dijiye.",
  },
];

/* ---------- Small helpers ---------- */

function readLegacy() {
  try {
    const list = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Phase material se tay hota hai, move number se nahi
export function phaseOf(fen, index) {
  let material = 0;
  for (const ch of String(fen).split(" ")[0]) {
    const key = ch.toLowerCase();
    if (key === "n" || key === "b") material += 3;
    else if (key === "r") material += 5;
    else if (key === "q") material += 9;
  }
  if (material <= 26) return "Endgame";
  return index < 20 ? "Opening" : "Middlegame";
}

// PGN ke [%clk h:mm:ss] se har move ke baad bacha time (seconds). Clock na ho toh null.
export function parseClocks(pgn, plies) {
  const found = [...String(pgn || "").matchAll(/\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/g)];
  if (found.length !== plies) return null;
  return found.map((m) => Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
}

// 1 = jeet, 0.5 = draw, 0 = haar, null = pata nahi
export function userScore(result, color) {
  if (result === "1-0") return color === "w" ? 1 : 0;
  if (result === "0-1") return color === "b" ? 1 : 0;
  if (result === "1/2-1/2" || result === "½-½") return 0.5;
  return null;
}

// Opponent ke paas sabse achha capture kitna material jeet-ta hai (recapture ginke)
function bestGain(chess) {
  let best = 0;

  for (const move of chess.moves({ verbose: true })) {
    if (!move.captured) continue;

    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    const recapture = chess.moves({ verbose: true }).some((r) => r.captured && r.to === move.to);
    chess.undo();

    const gain = VALUE[move.captured] - (recapture ? VALUE[move.piece] : 0);
    if (gain > best) best = gain;
  }

  return best;
}

function advantageOf(move) {
  const sign = move.color === "w" ? 1 : -1;
  return sign * (typeof move.evalBefore === "number" ? move.evalBefore : 0);
}

function detectLeakTags(move, played, fenBefore, fenAfter, index, clock) {
  const tags = [];
  const playedBest = Boolean(move.best) && move.best === move.uci;
  const serious = SERIOUS_CATS.includes(move.cat);

  if (serious && clock !== null && clock < 60 && index >= 48) tags.push("time-trouble");

  if (serious) {
    try {
      if (bestGain(new Chess(fenAfter)) >= 3) tags.push("hanging");
    } catch {
      // ignore
    }
  }

  if (!playedBest && move.best) {
    let tactic = advantageOf(move) >= 90;

    if (!tactic && !played.captured) {
      try {
        const best = new Chess(fenBefore)
          .moves({ verbose: true })
          .find((m) => m.from + m.to + (m.promotion || "") === move.best);
        tactic = Boolean(best && best.captured);
      } catch {
        // ignore
      }
    }

    if (tactic) tags.push("missed-tactics");
  }

  if (index < 20 && move.cat !== "Book") tags.push("opening-gaps");

  return tags;
}

function isBackRankMate(parsed, userColor) {
  try {
    const chess = new Chess(parsed.fens[parsed.fens.length - 1]);
    if (!chess.isCheckmate() || chess.turn() !== userColor) return false;

    const last = parsed.moves[parsed.moves.length - 1];
    if (last.piece !== "r" && last.piece !== "q") return false;

    const rank = userColor === "w" ? "1" : "8";
    for (const row of chess.board()) {
      for (const square of row) {
        if (square && square.type === "k" && square.color === userColor) {
          return square.square[1] === rank && last.to[1] === rank;
        }
      }
    }
  } catch {
    // ignore
  }

  return false;
}

/* ---------- One game -> one record ---------- */

export function analyseGame(game, parsed, moves) {
  const userColor = game.userColor || "w";
  const opponent = userColor === "w" ? parsed.headers.Black : parsed.headers.White;
  const clocks = parseClocks(parsed.pgn, parsed.moves.length);
  const score = userScore(parsed.result, userColor);
  const userMoves = [];

  parsed.moves.forEach((played, index) => {
    if (played.color !== userColor) return;

    const move = moves[index];
    const fenBefore = parsed.fens[index];
    const fenAfter = parsed.fens[index + 1];
    const isError = ERROR_CATS.includes(move.cat);
    const clock = clocks ? clocks[index] : null;
    const tags = isError ? detectLeakTags(move, played, fenBefore, fenAfter, index, clock) : [];

    userMoves.push({
      ...move,
      index,
      phase: phaseOf(fenBefore, index),
      isError,
      tags,
      leak: PRIORITY.find((id) => tags.includes(id)) || null,
      clock,
      fenBefore,
      userColor,
      label: `vs ${opponent || "Opponent"}, move ${move.moveNumber}`,
    });
  });

  // Poore game se jude leaks
  const gameLeaks = [];

  if (score !== null && score < 1) {
    const winning = userMoves.filter((m) => m.phase === "Endgame" && advantageOf(m) >= 2.5);

    if (winning.length) {
      const peak = Math.max(...winning.map((m) => moverWin(m.evalBefore, m.color)));
      const slip = userMoves.find((m) => m.phase === "Endgame" && m.isError && advantageOf(m) >= 1.5);

      gameLeaks.push({
        leakId: "endgame-conversion",
        loss: Math.max(0, peak - score * 100),
        example: slip || winning[0],
      });
    }
  }

  if (userMoves.length && isBackRankMate(parsed, userColor)) {
    gameLeaks.push({ leakId: "back-rank", loss: 50, example: userMoves[userMoves.length - 1] });
  }

  return {
    id: game.id,
    time: new Date(game.date || 0).getTime() || 0,
    accuracy: summarize(moves).acc[userColor],
    userColor,
    result: parsed.result,
    score,
    opponent: opponent || "Opponent",
    opening: parsed.opening || "",
    userMoves,
    gameLeaks,
  };
}

/* ---------- Loading every reviewed game ---------- */

export async function loadReviewedGames() {
  let stored = [];
  try {
    stored = await dbAll("games");
  } catch (error) {
    console.error("Could not read games:", error);
  }

  const byId = new Map();
  for (const game of readLegacy()) if (game?.id && game.pgn) byId.set(game.id, game);
  for (const game of stored) if (game?.id && game.pgn) byId.set(game.id, game);

  const seen = new Set();
  const records = [];

  for (const game of byId.values()) {
    if (seen.has(game.pgn)) continue;
    seen.add(game.pgn);

    try {
      const parsed = parseGame(game.pgn);
      let moves = null;

      const review = await dbGet("reviews", game.id);
      if (review && Array.isArray(review.moves) && review.moves.length === parsed.moves.length) {
        moves = review.moves;
      } else if (Array.isArray(game.analysis) && game.analysis.length === parsed.moves.length) {
        moves = fromLegacyAnalysis(game.analysis, parsed);
      }

      if (!moves || moves.some((m) => m.cat === "Pending")) continue;
      records.push(analyseGame(game, parsed, moves));
    } catch (error) {
      console.error("Skipped a game:", error);
    }
  }

  return records.sort((a, b) => a.time - b.time);
}

/* ---------- Leaks, points and status ---------- */

export function inWindow(records, days) {
  if (days === "all" || days === null || days === undefined) return records;
  const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
  return records.filter((r) => r.time >= cutoff);
}

const sum = (list) => list.reduce((a, b) => a + b, 0);
const avg = (list) => (list.length ? sum(list) / list.length : 0);

// series = har game mein leak kitni baar aaya, purane se naye
export function leakStatus(series) {
  if (series.length < 6) return { status: "Open", progress: 0, enough: false };

  const last5 = series.slice(-5);
  const earlier = series.slice(0, -5);

  if (sum(last5) === 0 && sum(earlier) >= 2) return { status: "Fixed", progress: 100, enough: true };

  const half = Math.floor(series.length / 2);
  const older = avg(series.slice(0, half));
  const newer = avg(series.slice(series.length - half));

  if (older > 0 && newer <= older * 0.7) {
    const progress = Math.min(95, Math.max(0, Math.round((1 - newer / older) * 100)));
    return { status: "Improving", progress, enough: true };
  }

  return { status: "Open", progress: 0, enough: true };
}

/*
  windowRecords: points aur "found in N games" yahin se.
  allRecords: Fixed / Improving tay karne ke liye poori history.
*/
export function computeLeaks(windowRecords, allRecords = windowRecords) {
  const games = windowRecords.length;
  const ordered = [...allRecords].sort((a, b) => a.time - b.time);

  const leaks = LEAK_DEFS.map((def) => {
    const foundIn = new Set();
    const examples = [];
    let totalLoss = 0;

    for (const record of windowRecords) {
      for (const move of record.userMoves) {
        if (move.leak !== def.id) continue;
        foundIn.add(record.id);
        totalLoss += move.winLoss || 0;
        examples.push(move);
      }

      for (const item of record.gameLeaks) {
        if (item.leakId !== def.id) continue;
        foundIn.add(record.id);
        totalLoss += item.loss;
        examples.push(item.example);
      }
    }

    const series = ordered.map((record) => {
      const moves = record.userMoves.filter((m) => m.leak === def.id).length;
      const gameLevel = record.gameLeaks.filter((g) => g.leakId === def.id).length;
      return moves + gameLevel;
    });

    const last10 = series.slice(-10);
    const half = Math.floor(last10.length / 2);

    return {
      ...def,
      games: foundIn.size,
      occurrences: examples.length,
      points: games ? Math.round((totalLoss / games) * POINTS_PER_PERCENT) : 0,
      examples: examples.sort((a, b) => (b.winLoss || 0) - (a.winLoss || 0)).slice(0, 8),
      trend: half >= 2 ? { before: avg(last10.slice(0, half)), after: avg(last10.slice(last10.length - half)) } : null,
      ...leakStatus(series),
    };
  })
    .filter((leak) => leak.games > 0)
    .sort((a, b) => b.points - a.points);

  return {
    games,
    leaks,
    total: sum(leaks.map((leak) => leak.points)),
  };
}