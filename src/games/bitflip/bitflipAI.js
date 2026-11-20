/* ==========================================================================
   BITFLIP AI  (levels 1-5)
   Same legal engine jo player use karta hai (bitflipEngine.js).

   Level 1  Beginner : random legal move
   Level 2  Easy     : 1-ply greedy, kaafi noise (galtiyan karta hai)
   Level 3  Medium   : 2-ply minimax, thoda noise
   Level 4  Hard     : 3-ply alpha-beta, bahut kam noise
   Level 5  Master   : iterative deepening (time-limited, ~4-5 ply), no noise

   Glitch (grid shift) random hai, isliye AI usse predict nahi karta.
   ========================================================================== */

import {
  allLegalMoves,
  applyMoveUnchecked,
  isInCheck,
} from "./bitflipEngine.js";

const FILES = "abcdefgh";
const MATE = 100000;

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/* Piece-square tables (white ki taraf se, rank 8 -> rank 1 order) */
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

const LEVELS = {
  1: { depth: 0, noise: 0, time: 0 },
  2: { depth: 1, noise: 90, time: 0 },
  3: { depth: 2, noise: 30, time: 0 },
  4: { depth: 3, noise: 8, time: 2000 },
  5: { depth: 6, noise: 0, time: 2500 },
};

const opp = (c) => (c === "w" ? "b" : "w");

function pstIndex(square, color) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);

  // table index 0 = a8. White: rank 8 -> row 0. Black: mirror.
  const row = color === "w" ? 8 - rank : rank - 1;

  return row * 8 + file;
}

/** Score `color` ki taraf se (positive = color better). */
export function evaluate(board, color) {
  let score = 0;

  for (const square in board) {
    const piece = board[square];
    if (!piece) continue;

    const value =
      VALUE[piece.type] + PST[piece.type][pstIndex(square, piece.color)];

    score += piece.color === color ? value : -value;
  }

  return score;
}

class Timeout extends Error {}

function orderMoves(board, moves) {
  return moves
    .map((move) => {
      const victim = board[move.to];
      const mover = board[move.from];

      let score = 0;

      if (victim) score += 10 * VALUE[victim.type] - VALUE[mover.type] / 10 + 1000;
      if (move.promotion) score += 800;

      return { move, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.move);
}

function play(board, move, enPassant, castling) {
  return applyMoveUnchecked(
    board,
    move.from,
    move.to,
    enPassant,
    castling,
    move.promotion || "q"
  );
}

export function chooseAiMove(
  board,
  color,
  enPassant,
  castling,
  level = 3
) {
  const rootMoves = allLegalMoves(board, color, enPassant, castling);

  if (!rootMoves.length) return null;

  // Barabar score wali moves mein variety ke liye pehle shuffle
  for (let i = rootMoves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rootMoves[i], rootMoves[j]] = [rootMoves[j], rootMoves[i]];
  }

  const cfg = LEVELS[level] || LEVELS[3];

  // Level 1: bas random
  if (cfg.depth === 0) {
    return rootMoves[Math.floor(Math.random() * rootMoves.length)];
  }

  const deadline = cfg.time ? Date.now() + cfg.time : Infinity;
  let nodes = 0;

  const checkTime = () => {
    nodes += 1;

    if ((nodes & 255) === 0 && Date.now() > deadline) {
      throw new Timeout();
    }
  };

  function search(b, side, ep, cast, depth, alpha, beta, ply) {
    checkTime();

    // Leaf: move-gen bachao. Sirf check mein ho to mate dekho.
    if (depth <= 0) {
      if (isInCheck(b, side)) {
        if (!allLegalMoves(b, side, ep, cast).length) return -MATE + ply;
      }

      return evaluate(b, side);
    }

    const moves = allLegalMoves(b, side, ep, cast);

    if (!moves.length) {
      return isInCheck(b, side) ? -MATE + ply : 0;
    }

    let best = -Infinity;

    for (const move of orderMoves(b, moves)) {
      const next = play(b, move, ep, cast);
      if (!next) continue;

      const score = -search(
        next.board,
        opp(side),
        next.enPassant,
        next.castling,
        depth - 1,
        -beta,
        -alpha,
        ply + 1
      );

      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    return best;
  }

  // Root: har move ko poora score do (noise ke liye)
  function scoreRoot(depth) {
    const scored = [];
    const ordered = orderMoves(board, rootMoves);

    let alpha = -Infinity;

    for (const move of ordered) {
      const next = play(board, move, enPassant, castling);
      if (!next) continue;

      // noise wale levels mein full window chahiye taaki saare scores sahi hon
      const windowAlpha = cfg.noise ? -Infinity : alpha;

      const score = -search(
        next.board,
        opp(color),
        next.enPassant,
        next.castling,
        depth - 1,
        -Infinity,
        -windowAlpha,
        1
      );

      scored.push({ move, score });
      if (score > alpha) alpha = score;
    }

    return scored;
  }

  let result = null;

  const maxDepth = cfg.depth;

  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      // time-limited levels mein iterative deepening; baaki seedha poori depth
      if (!cfg.time && depth < maxDepth) continue;

      result = scoreRoot(depth);
    }
  } catch (error) {
    if (!(error instanceof Timeout)) throw error;
  }

  // Timeout pehli hi depth mein ho gaya to greedy fallback
  if (!result) {
    result = rootMoves.map((move) => {
      const next = play(board, move, enPassant, castling);

      return {
        move,
        score: next ? -evaluate(next.board, opp(color)) : -Infinity,
      };
    });
  }

  // Best + noise
  const noisy = result.map((item) => ({
    ...item,
    score: item.score + (cfg.noise ? Math.random() * cfg.noise : 0),
  }));

  noisy.sort((a, b) => b.score - a.score);

  // Level 2: top 3 mein se koi ek (kabhi kabhi blunder)
  if (level === 2) {
    const pool = noisy.slice(0, Math.min(3, noisy.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  // Level 5: sirf sabse achhi move (window-pruned scores sirf upper bound hote hain)
  if (!cfg.noise) return noisy[0].move;

  // Level 4: lagbhag barabar moves mein variety
  const top = noisy[0].score;
  const pool = noisy.filter((item) => top - item.score <= 10);

  return pool[Math.floor(Math.random() * pool.length)].move;
}