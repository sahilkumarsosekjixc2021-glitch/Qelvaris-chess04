import { Chess } from "chess.js";
import { findOpening, isBookMove } from "./openings";

/* ---------- Move labels ---------- */

export const CATEGORIES = {
  Brilliant: { symbol: "!!", color: "#22b8cf" },
  Great: { symbol: "!", color: "#5b8def" },
  Best: { symbol: "★", color: "#4caf63" },
  Excellent: { symbol: "✓", color: "#8bc34a" },
  Good: { symbol: "•", color: "#8fa79b" },
  Book: { symbol: "B", color: "#a97c50" },
  Inaccuracy: { symbol: "?!", color: "#e8b923" },
  Miss: { symbol: "✕", color: "#e5737f" },
  Mistake: { symbol: "?", color: "#f0903a" },
  Blunder: { symbol: "??", color: "#e0453d" },
  Pending: { symbol: "…", color: "#5c6470" },
};

export const CATEGORY_ORDER = [
  "Brilliant",
  "Great",
  "Best",
  "Excellent",
  "Good",
  "Book",
  "Inaccuracy",
  "Miss",
  "Mistake",
  "Blunder",
];

// "Next key moment" in moves par ruka karta hai
export const KEY_CATEGORIES = ["Brilliant", "Great", "Miss", "Mistake", "Blunder"];

/* ---------- Win chance and accuracy ---------- */

// Score pawns mein (White ke nazariye se). Result 0-100: White ke jeetne ke chance.
export function winChance(pawns) {
  const cp = Math.max(-1000, Math.min(1000, (Number(pawns) || 0) * 100));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function moverWin(pawns, color) {
  const white = winChance(pawns);
  return color === "w" ? white : 100 - white;
}

// loss = win-chance ke kitne points gaye
export function moveAccuracy(loss) {
  const value = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
  return Math.max(0, Math.min(100, value));
}

function combine(list) {
  if (!list.length) return null;
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  const harmonic = list.length / list.reduce((a, b) => a + 1 / Math.max(b, 1), 0);
  return Math.round(((mean + harmonic) / 2) * 10) / 10;
}

export function summarize(moves) {
  const counts = { w: {}, b: {} };
  const accs = { w: [], b: [] };

  for (const move of moves) {
    if (!move || move.cat === "Pending") continue;
    counts[move.color][move.cat] = (counts[move.color][move.cat] || 0) + 1;
    accs[move.color].push(moveAccuracy(move.winLoss ?? 0));
  }

  return { counts, acc: { w: combine(accs.w), b: combine(accs.b) } };
}

export function formatEval(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "—";
  const abs = Math.abs(score);

  if (abs >= 90) {
    const n = Math.round(100 - abs);
    return n <= 0 ? "Mate" : `${score > 0 ? "+" : "-"}M${n}`;
  }

  return `${score > 0 ? "+" : ""}${score.toFixed(1)}`;
}

/* ---------- Reading a PGN ---------- */

const strip = (san) => san.replace(/[+#]/g, "");

export function parseGame(text) {
  const chess = new Chess();
  chess.loadPgn(text);

  const verbose = chess.history({ verbose: true });
  if (!verbose.length) throw new Error("PGN has no moves");

  const headers = chess.getHeaders();
  const custom = Boolean(headers.FEN);
  const replay = custom ? new Chess(headers.FEN) : new Chess();
  const fens = [replay.fen()];

  for (const move of verbose) {
    replay.move(move.san);
    fens.push(replay.fen());
  }

  const sans = verbose.map((move) => move.san);

  return {
    pgn: chess.pgn(),
    moves: verbose,
    sans,
    clean: sans.map(strip),
    fens,
    headers,
    custom,
    result: headers.Result || "*",
    opening: custom ? "" : findOpening(sans),
  };
}

function baseMove(parsed, index) {
  const move = parsed.moves[index];
  return {
    ply: index + 1,
    moveNumber: Math.floor(index / 2) + 1,
    color: move.color,
    san: move.san,
    from: move.from,
    to: move.to,
    uci: move.from + move.to + (move.promotion || ""),
  };
}

export function makeBaseMoves(parsed) {
  return parsed.moves.map((_, index) => ({ ...baseMove(parsed, index), cat: "Pending" }));
}

/* ---------- Engine output ---------- */

export function parseInfoLine(line, fen) {
  if (!line.startsWith("info ")) return null;
  if (/\b(lowerbound|upperbound)\b/.test(line)) return null;

  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  const pvMatch = line.match(/\bpv\s+(.+)$/);
  if (!scoreMatch || !pvMatch) return null;

  const value = Number(scoreMatch[2]);
  let score =
    scoreMatch[1] === "mate"
      ? Math.sign(value) * (100 - Math.abs(value))
      : value / 100;

  // Engine side-to-move ke hisaab se batata hai. Hum hamesha White ke hisaab se rakhte hain.
  if (String(fen).split(" ")[1] === "b") score = -score;

  return {
    mpv: Number((line.match(/\bmultipv\s+(\d+)/) || [])[1] || 1),
    depth: Number((line.match(/\bdepth\s+(\d+)/) || [])[1] || 0),
    score,
    pv: pvMatch[1].trim(),
  };
}

export function parsePv(fen, pv) {
  if (!fen || !pv) return [];

  try {
    const chess = new Chess(fen);
    const result = [];

    for (const token of pv.trim().split(/\s+/)) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(token)) break;

      const move = chess.move({
        from: token.slice(0, 2),
        to: token.slice(2, 4),
        promotion: token.length > 4 ? token[4].toLowerCase() : undefined,
      });

      if (!move) break;
      result.push(move.san);
    }

    return result;
  } catch {
    return [];
  }
}

// lines = [{ uci, score, pvUci }] best se kam best ke order mein
export function makeEval(fen, lines) {
  const sans = parsePv(fen, lines[0]?.pvUci || "");
  return { lines, bestSan: sans[0] || "", pvSan: sans.slice(0, 8).join(" ") };
}

// Checkmate ya draw wali position par engine nahi chalta
export function terminalEval(fen) {
  try {
    const chess = new Chess(fen);
    let score = null;

    if (chess.isCheckmate()) score = chess.turn() === "w" ? -100 : 100;
    else if (chess.isDraw() || chess.isStalemate()) score = 0;

    if (score === null) return null;
    return { lines: [{ uci: "", score, pvUci: "" }], bestSan: "", pvSan: "" };
  } catch {
    return null;
  }
}

/* ---------- Grading ---------- */

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const round2 = (value) => Number(value.toFixed(2));

// evals[i] = position i ka result (i = 0 start position). Har position sirf ek baar analyse hoti hai.
export function gradeAll(parsed, evals) {
  const out = [];
  let previousLoss = null;

  parsed.moves.forEach((move, index) => {
    const base = baseMove(parsed, index);
    const before = evals[index];
    const after = evals[index + 1];

    if (!before || !after) {
      out.push({ ...base, cat: "Pending" });
      previousLoss = null;
      return;
    }

    const bestLine = before.lines[0];
    const replyLine = after.lines[0];

    const winBefore = moverWin(bestLine.score, move.color);
    const winAfter = moverWin(replyLine.score, move.color);
    const playedBest = Boolean(bestLine.uci) && bestLine.uci === base.uci;
    const winLoss = playedBest ? 0 : Math.max(0, winBefore - winAfter);

    const sign = move.color === "w" ? 1 : -1;
    const lossPawns = playedBest
      ? 0
      : Math.min(15, Math.max(0, (bestLine.score - replyLine.score) * sign));

    let cat;

    if (!parsed.custom && isBookMove(parsed.clean, index)) {
      cat = "Book";
    } else {
      if (winLoss <= 2) cat = playedBest ? "Best" : "Excellent";
      else if (winLoss <= 5) cat = "Good";
      else if (winLoss <= 10) cat = "Inaccuracy";
      else if (winLoss <= 20) cat = "Mistake";
      else cat = "Blunder";

      // Brilliant: piece sacrifice jo engine ke hisaab se best/lagbhag best hai
      if (cat === "Best" || cat === "Excellent") {
        const reply = replyLine.uci || "";
        const lostValue = (VALUE[move.piece] || 0) - (VALUE[move.captured] || 0);
        const sacrifice =
          move.piece !== "p" &&
          move.piece !== "k" &&
          reply.slice(2, 4) === move.to &&
          lostValue >= 2;

        if (sacrifice && winAfter >= 40 && winBefore <= 85) cat = "Brilliant";
      }

      // Great: sirf yahi move position bachata / advantage rakhta hai
      if (cat === "Best" && before.lines.length >= 2) {
        const second = moverWin(before.lines[1].score, move.color);
        if (winBefore - second >= 12 && winBefore >= 30 && winBefore <= 90) cat = "Great";
      }

      // Miss: opponent ne galti ki, par aapne faayda nahi uthaya
      if (
        (cat === "Inaccuracy" || cat === "Mistake") &&
        previousLoss !== null &&
        previousLoss >= 15 &&
        winBefore >= 65
      ) {
        cat = "Miss";
      }
    }

    previousLoss = winLoss;

    out.push({
      ...base,
      cat,
      winLoss: round2(winLoss),
      loss: round2(lossPawns),
      evalBefore: bestLine.score,
      evalAfter: replyLine.score,
      best: bestLine.uci,
      bestSan: before.bestSan,
      pv: before.pvSan,
    });
  });

  return out;
}

/* ---------- Old format se / mein badalna ---------- */

// History, Coach aur Dashboard abhi purana format padhte hain
const LEGACY_CATEGORY = { Brilliant: "Best", Great: "Best", Book: "Good", Miss: "Mistake" };

export function toLegacyAnalysis(parsed, moves, depth) {
  return moves.map((move, index) => ({
    ply: move.ply,
    moveNumber: move.moveNumber,
    san: move.san,
    color: move.color,
    from: move.from,
    to: move.to,
    fenBefore: parsed.fens[index],
    fenAfter: parsed.fens[index + 1],
    bestMove: move.best || "",
    bestMoveSan: move.bestSan || "",
    bestVariation: move.pv || "",
    beforeScore: move.evalBefore ?? null,
    afterScore: move.evalAfter ?? null,
    loss: move.loss ?? null,
    category: LEGACY_CATEGORY[move.cat] || move.cat,
    depth,
  }));
}

export function fromLegacyAnalysis(analysis, parsed) {
  return parsed.moves.map((move, index) => {
    const base = baseMove(parsed, index);
    const item = analysis[index] || {};
    const cat = item.category && CATEGORIES[item.category] ? item.category : "Pending";

    if (cat === "Pending") return { ...base, cat };

    const hasScores =
      typeof item.beforeScore === "number" && typeof item.afterScore === "number";
    const winLoss =
      cat === "Best" || !hasScores
        ? 0
        : Math.max(0, moverWin(item.beforeScore, move.color) - moverWin(item.afterScore, move.color));

    return {
      ...base,
      cat,
      winLoss: round2(winLoss),
      loss: Number(item.loss) || 0,
      evalBefore: hasScores ? item.beforeScore : null,
      evalAfter: hasScores ? item.afterScore : null,
      best: item.bestMove || "",
      bestSan: item.bestMoveSan || "",
      pv: item.bestVariation || "",
    };
  });
}