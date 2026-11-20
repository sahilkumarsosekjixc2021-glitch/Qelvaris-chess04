/* ==========================================================================
   BIOCORRUPTION AI  (levels 1-5)

   Ye file self-contained hai: andar chhota fast chess move-generator hai
   (sirf search ke liye). Asli game ke rules/legality wahi rehte hain jo
   BioCorruption.jsx mein hain (chess.js + infection rules); AI ki chosen
   move ko JSX dobara verify karta hai.

   AI infection cycle ko samajhta hai:
     countdown (4 plies) -> warning square -> 2x2 infection zone (3 plies)
     -> zone ke saare non-king pieces apni side badal lete hain.
   Search iss cycle ko simulate karta hai (random warning square ko
   chhodkar) aur eval mein "zone mein phasa piece = flip hone wala piece"
   ko penalty / bonus deta hai.

   Level 1  Beginner : random legal move
   Level 2  Easy     : 1-ply, kaafi noise
   Level 3  Medium   : 2-ply minimax
   Level 4  Hard     : 3-ply alpha-beta
   Level 5  Master   : iterative deepening (time-limited), no noise
   ========================================================================== */

const FILES = "abcdefgh";
const opp = (c) => (c === "w" ? "b" : "w");

const sqOf = (file, rank) =>
  file < 0 || file > 7 || rank < 1 || rank > 8
    ? null
    : FILES[file] + rank;

/* ------------------------------------------------------------------
   Setup + FEN
------------------------------------------------------------------- */

const createInitialBoard = () => {
  const board = {};
  const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];

  for (let f = 0; f < 8; f++) {
    board[FILES[f] + "1"] = { type: backRank[f], color: "w" };
    board[FILES[f] + "2"] = { type: "p", color: "w" };
    board[FILES[f] + "7"] = { type: "p", color: "b" };
    board[FILES[f] + "8"] = { type: backRank[f], color: "b" };
  }

  return board;
};

/** Board object -> FEN piece placement (Board.jsx ke liye). */
const boardToFen = (board) => {
  const rows = [];

  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;

    for (let file = 0; file < 8; file++) {
      const piece = board[FILES[file] + rank];

      if (!piece) {
        empty++;
        continue;
      }

      if (empty) {
        row += empty;
        empty = 0;
      }

      row += piece.color === "w"
        ? piece.type.toUpperCase()
        : piece.type.toLowerCase();
    }

    if (empty) row += empty;
    rows.push(row);
  }

  return rows.join("/") + " w - - 0 1";
};

/* ------------------------------------------------------------------
   Attack / check detection
------------------------------------------------------------------- */

const KNIGHT_JUMPS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

const KING_STEPS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const DIAGONALS = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const STRAIGHTS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/** Kya target square par by color ka koi piece attack kar raha hai? */
const isAttacked = (board, target, by) => {
  if (!target) return false;

  const f = FILES.indexOf(target[0]);
  const r = Number(target[1]);

  if (f < 0 || r < 1 || r > 8) return false;

  // Pawn attacks
  const dir = by === "w" ? 1 : -1;

  for (const df of [-1, 1]) {
    const square = sqOf(f + df, r - dir);
    const piece = square ? board[square] : null;

    if (piece?.color === by && piece.type === "p") {
      return true;
    }
  }

  // Knight attacks
  for (const [df, dr] of KNIGHT_JUMPS) {
    const square = sqOf(f + df, r + dr);
    const piece = square ? board[square] : null;

    if (piece?.color === by && piece.type === "n") {
      return true;
    }
  }

  // King attacks
  for (const [df, dr] of KING_STEPS) {
    const square = sqOf(f + df, r + dr);
    const piece = square ? board[square] : null;

    if (piece?.color === by && piece.type === "k") {
      return true;
    }
  }

  // Bishop, rook and queen attacks
  for (const [directions, types] of [
    [DIAGONALS, "bq"],
    [STRAIGHTS, "rq"],
  ]) {
    for (const [df, dr] of directions) {
      for (let distance = 1; distance < 8; distance++) {
        const square = sqOf(
          f + df * distance,
          r + dr * distance
        );

        if (!square) break;

        const piece = board[square];
        if (!piece) continue;

        if (piece.color === by && types.includes(piece.type)) {
          return true;
        }

        // Any piece blocks the ray.
        break;
      }
    }
  }

  return false;
};

const findKing = (board, color) =>
  Object.keys(board).find(
    (square) =>
      board[square]?.type === "k" &&
      board[square]?.color === color
  ) || null;

/** Missing king ko invalid/check position maana jayega. */
const isInCheck = (board, color) => {
  const kingSquare = findKing(board, color);

  if (!kingSquare) return true;

  return isAttacked(board, kingSquare, opp(color));
};

/* ------------------------------------------------------------------
   Internal move application
   IMPORTANT: Ye function legality check nahi karta.
   Sirf getLegalMoves ke internal calculation ke liye hai.
------------------------------------------------------------------- */

const applyMoveRaw = (
  board,
  from,
  to,
  enPassant,
  castling,
  promotion = "q"
) => {
  const moving = board[from];

  if (!moving || !to) return null;

  const target = board[to];

  // A piece cannot capture its own piece or either king.
  if (target && target.color === moving.color) return null;
  if (target?.type === "k") return null;

  const next = { ...board };
  let captured = target || null;

  delete next[from];

  // En passant capture
  if (
    moving.type === "p" &&
    to === enPassant &&
    !target &&
    from[0] !== to[0]
  ) {
    const victimSquare =
      to[0] +
      (Number(to[1]) + (moving.color === "w" ? -1 : 1));

    const victim = next[victimSquare];

    if (
      !victim ||
      victim.type !== "p" ||
      victim.color === moving.color
    ) {
      return null;
    }

    captured = victim;
    delete next[victimSquare];
  }

  // Castling: move the rook too.
  if (
    moving.type === "k" &&
    Math.abs(
      FILES.indexOf(to[0]) - FILES.indexOf(from[0])
    ) === 2
  ) {
    const rank = to[1];
    const kingSide = to[0] === "g";

    const rookFrom = (kingSide ? "h" : "a") + rank;
    const rookTo = (kingSide ? "f" : "d") + rank;
    const rook = next[rookFrom];

    if (
      !rook ||
      rook.type !== "r" ||
      rook.color !== moving.color
    ) {
      return null;
    }

    next[rookTo] = rook;
    delete next[rookFrom];
  }

  // Promotion
  const isPromotion =
    moving.type === "p" &&
    (to[1] === "8" || to[1] === "1");

  const validPromotions = ["q", "r", "b", "n"];

  if (isPromotion && !validPromotions.includes(promotion)) {
    promotion = "q";
  }

  next[to] = {
    ...moving,
    type: isPromotion ? promotion : moving.type,
  };

  // Update castling rights
  const nextCastling = { ...(castling || {}) };

  if (moving.type === "k") {
    nextCastling[moving.color + "K"] = false;
    nextCastling[moving.color + "Q"] = false;
  }

  if (from === "a1" || to === "a1") nextCastling.wQ = false;
  if (from === "h1" || to === "h1") nextCastling.wK = false;
  if (from === "a8" || to === "a8") nextCastling.bQ = false;
  if (from === "h8" || to === "h8") nextCastling.bK = false;

  // Update en passant square
  const nextEnPassant =
    moving.type === "p" &&
    Math.abs(Number(to[1]) - Number(from[1])) === 2
      ? sqOf(
          FILES.indexOf(from[0]),
          (Number(to[1]) + Number(from[1])) / 2
        )
      : null;

  return {
    board: next,
    castling: nextCastling,
    enPassant: nextEnPassant,
    captured,
    winner: null,
  };
};

/* ------------------------------------------------------------------
   Pseudo-legal move generation
------------------------------------------------------------------- */

const pseudoMoves = (board, from, enPassant, castling) => {
  const piece = board[from];

  if (!piece) return [];

  const f = FILES.indexOf(from[0]);
  const r = Number(from[1]);

  if (f < 0 || r < 1 || r > 8) return [];

  const moves = [];

  const step = (square) => {
    if (!square) return false;

    const target = board[square];

    if (!target) {
      moves.push(square);
      return true;
    }

    // Never allow capturing a king.
    if (target.type === "k") return false;

    if (target.color !== piece.color) {
      moves.push(square);
    }

    return false;
  };

  // Pawn
  if (piece.type === "p") {
    const direction = piece.color === "w" ? 1 : -1;
    const startRank = piece.color === "w" ? 2 : 7;

    const one = sqOf(f, r + direction);

    if (one && !board[one]) {
      moves.push(one);

      const two = sqOf(f, r + direction * 2);

      if (r === startRank && two && !board[two]) {
        moves.push(two);
      }
    }

    for (const df of [-1, 1]) {
      const targetSquare = sqOf(f + df, r + direction);

      if (!targetSquare) continue;

      const target = board[targetSquare];

      if (target) {
        if (
          target.color !== piece.color &&
          target.type !== "k"
        ) {
          moves.push(targetSquare);
        }
      } else if (targetSquare === enPassant) {
        const victimSquare = sqOf(f + df, r);
        const victim = victimSquare ? board[victimSquare] : null;

        if (
          victim?.type === "p" &&
          victim.color !== piece.color
        ) {
          moves.push(targetSquare);
        }
      }
    }
  }

  // Knight
  if (piece.type === "n") {
    for (const [df, dr] of KNIGHT_JUMPS) {
      step(sqOf(f + df, r + dr));
    }
  }

  // Bishop, rook and queen
  if (["b", "r", "q"].includes(piece.type)) {
    const directions = [];

    if (piece.type !== "r") {
      directions.push(...DIAGONALS);
    }

    if (piece.type !== "b") {
      directions.push(...STRAIGHTS);
    }

    for (const [df, dr] of directions) {
      for (let distance = 1; distance < 8; distance++) {
        const square = sqOf(
          f + df * distance,
          r + dr * distance
        );

        if (!step(square)) break;
      }
    }
  }

  // King
  if (piece.type === "k") {
    for (const [df, dr] of KING_STEPS) {
      step(sqOf(f + df, r + dr));
    }

    const homeRank = piece.color === "w" ? 1 : 8;
    const rights = castling || {};

    if (from === "e" + homeRank) {
      const kingSideRook = board["h" + homeRank];
      const queenSideRook = board["a" + homeRank];

      // King-side castling
      if (
        rights[piece.color + "K"] &&
        !board["f" + homeRank] &&
        !board["g" + homeRank] &&
        kingSideRook?.type === "r" &&
        kingSideRook.color === piece.color
      ) {
        moves.push("g" + homeRank);
      }

      // Queen-side castling
      if (
        rights[piece.color + "Q"] &&
        !board["d" + homeRank] &&
        !board["c" + homeRank] &&
        !board["b" + homeRank] &&
        queenSideRook?.type === "r" &&
        queenSideRook.color === piece.color
      ) {
        moves.push("c" + homeRank);
      }
    }
  }

  return [...new Set(moves)];
};

/* ------------------------------------------------------------------
   Legal move generation
------------------------------------------------------------------- */

/** Sirf woh destinations jinke baad apna king safe rahega. */
const getLegalMoves = (
  board,
  from,
  enPassant,
  castling
) => {
  const piece = board[from];

  if (!piece) return [];

  // Invalid position: own king must exist.
  const ownKing = findKing(board, piece.color);
  if (!ownKing) return [];

  const enemy = opp(piece.color);
  const legalMoves = [];

  for (const to of pseudoMoves(
    board,
    from,
    enPassant,
    castling
  )) {
    const isCastling =
      piece.type === "k" &&
      Math.abs(
        FILES.indexOf(to[0]) - FILES.indexOf(from[0])
      ) === 2;

    if (isCastling) {
      // Cannot castle while currently in check.
      if (isAttacked(board, from, enemy)) continue;

      // Cannot castle through an attacked square.
      const middleFile =
        (FILES.indexOf(from[0]) + FILES.indexOf(to[0])) / 2;

      const middleSquare = sqOf(
        middleFile,
        Number(from[1])
      );

      if (isAttacked(board, middleSquare, enemy)) {
        continue;
      }
    }

    const result = applyMoveRaw(
      board,
      from,
      to,
      enPassant,
      castling,
      "q"
    );

    if (!result) continue;

    // Reject any move that leaves own king in check.
    // (king square pehle se pata hai: har move par dobara dhundhna nahi padta)
    const kingAfter = piece.type === "k" ? to : ownKing;

    if (isAttacked(result.board, kingAfter, enemy)) {
      continue;
    }

    legalMoves.push(to);
  }

  return legalMoves;
};

const hasLegalMove = (
  board,
  color,
  enPassant,
  castling
) =>
  Object.keys(board).some(
    (square) =>
      board[square]?.color === color &&
      getLegalMoves(
        board,
        square,
        enPassant,
        castling
      ).length > 0
  );


/* ------------------------------------------------------------------
   Fast move application / generation (search ke liye)
------------------------------------------------------------------- */

const applyUnchecked = applyMoveRaw;

function legalMovesFor(board, color, enPassant, castling) {
  const out = [];

  for (const from of Object.keys(board)) {
    const piece = board[from];
    if (!piece || piece.color !== color) continue;

    for (const to of getLegalMoves(board, from, enPassant, castling)) {
      out.push({ from, to });
    }
  }

  return out;
}

/* ------------------------------------------------------------------
   Infection rules (bioEngine.js / BioCorruption.jsx ke mutabik)
------------------------------------------------------------------- */

const MOVES_PER_CYCLE = 4;
const DEFENSE_MOVES = 3;
const MATE = 100000;

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** Search mein zone ki direction random nahi: board ke center ki taraf. */
function zoneFor(square) {
  if (!square) return [];

  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);

  const df = file < 4 ? 1 : -1;
  const dr = rank < 5 ? 1 : -1;

  return [
    square,
    sqOf(file + df, rank),
    sqOf(file, rank + dr),
    sqOf(file + df, rank + dr),
  ].filter(Boolean);
}

/** Warning square ke possible zone squares aur unki probability. */
function zoneOdds(square) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);

  const odds = [[square, 1]];

  const fileSteps = [];
  if (file < 7) fileSteps.push(1);
  if (file > 0) fileSteps.push(-1);

  const rankSteps = [];
  if (rank < 8) rankSteps.push(1);
  if (rank > 1) rankSteps.push(-1);

  for (const df of fileSteps) {
    odds.push([sqOf(file + df, rank), 1 / fileSteps.length]);
  }

  for (const dr of rankSteps) {
    odds.push([sqOf(file, rank + dr), 1 / rankSteps.length]);
  }

  for (const df of fileSteps) {
    for (const dr of rankSteps) {
      odds.push([
        sqOf(file + df, rank + dr),
        1 / (fileSteps.length * rankSteps.length),
      ]);
    }
  }

  return odds;
}

function generate(node) {
  const { board, turn, enPassant, castling, zone } = node;

  let moves = legalMovesFor(board, turn, enPassant, castling);

  // King infection zone mein ho to sirf king zone se bahar nikal sakta hai
  if (zone.length) {
    const king = findKing(board, turn);

    if (king && zone.includes(king)) {
      moves = moves.filter(
        (move) => move.from === king && !zone.includes(move.to)
      );
    }
  }

  return moves;
}

/** Ek move ke baad naya node (cycle phase bhi aage badhta hai). */
function advance(node, move) {
  const result = applyUnchecked(
    node.board,
    move.from,
    move.to,
    node.enPassant,
    node.castling,
    "q"
  );

  if (!result) return null;

  let board = result.board;
  let phase = node.phase;
  let cycleMoves = node.cycleMoves;
  let warn = node.warn;
  let zone = node.zone;
  let defenseLeft = node.defenseLeft;
  let lost = null;

  if (phase === "countdown") {
    cycleMoves += 1;

    if (cycleMoves >= MOVES_PER_CYCLE) {
      phase = "warning";
      warn = null; // random square: search ko pata nahi
      cycleMoves = 0;
    }
  } else if (phase === "warning") {
    zone = warn ? zoneFor(warn) : [];
    phase = "defense";
    defenseLeft = DEFENSE_MOVES;
    warn = null;
  } else if (phase === "defense") {
    defenseLeft = Math.max(0, defenseLeft - 1);

    if (defenseLeft === 0) {
      const next = { ...board };

      for (const square of zone) {
        const piece = next[square];
        if (!piece || piece.type === "k") continue;

        next[square] = { ...piece, color: opp(piece.color) };
      }

      board = next;

      // zone ke bahar na nikla hua king haar jata hai
      for (const color of ["w", "b"]) {
        const king = findKing(board, color);
        if (king && zone.includes(king)) lost = color;
      }

      zone = [];
      phase = "countdown";
      cycleMoves = 0;
    }
  }

  return {
    board,
    turn: opp(node.turn),
    enPassant: result.enPassant,
    castling: result.castling,
    phase,
    cycleMoves,
    warn,
    zone,
    defenseLeft,
    lost,
  };
}

/* ------------------------------------------------------------------
   Evaluation
------------------------------------------------------------------- */

const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};

function pstIndex(square, color) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const row = color === "w" ? 8 - rank : rank - 1;

  return row * 8 + file;
}

/** `side` ki taraf se score (positive = side better). */
export function evaluateBio(node, side) {
  const { board, zone, phase, warn, defenseLeft } = node;

  let score = 0;

  for (const square in board) {
    const piece = board[square];
    if (!piece) continue;

    const value =
      VALUE[piece.type] + PST[piece.type][pstIndex(square, piece.color)];

    score += piece.color === side ? value : -value;
  }

  // Infection zone: zone mein bacha piece defense khatam hone par flip hoga
  if (zone.length && defenseLeft > 0) {
    // jitna kam time bacha, utna pakka flip
    const certainty = defenseLeft <= 1 ? 0.9 : defenseLeft === 2 ? 0.7 : 0.5;

    for (const square of zone) {
      const piece = board[square];
      if (!piece) continue;

      if (piece.type === "k") {
        score += piece.color === side ? -60 : 60;
        continue;
      }

      const swing = 2 * VALUE[piece.type] * certainty;
      score += piece.color === side ? -swing : swing;
    }
  }

  // Warning: square pata hai, zone ki direction nahi
  if (phase === "warning" && warn) {
    for (const [square, probability] of zoneOdds(warn)) {
      const piece = board[square];
      if (!piece || piece.type === "k") continue;

      const swing = 2 * VALUE[piece.type] * 0.4 * probability;
      score += piece.color === side ? -swing : swing;
    }
  }

  return score;
}

/* ------------------------------------------------------------------
   Search
------------------------------------------------------------------- */

const LEVELS = {
  1: { depth: 0, noise: 0, time: 0 },
  2: { depth: 1, noise: 90, time: 0 },
  3: { depth: 2, noise: 30, time: 0 },
  4: { depth: 3, noise: 8, time: 2000 },
  5: { depth: 6, noise: 0, time: 2500 },
};

class Timeout extends Error {}

function orderMoves(board, moves) {
  return moves
    .map((move) => {
      const victim = board[move.to];
      const mover = board[move.from];
      let score = 0;

      if (victim) score += 10 * VALUE[victim.type] - VALUE[mover.type] / 10 + 1000;

      return { move, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.move);
}

/**
 * state = {
 *   board, turn, enPassant, castling,
 *   phase, cycleMoves, warningSquare, corrupted, defenseMovesLeft
 * }
 * return: { from, to } ya null
 */
export function chooseBioMove(state, level = 3) {
  const root = {
    board: state.board,
    turn: state.turn,
    enPassant: state.enPassant ?? null,
    castling: state.castling || {},
    phase: state.phase,
    cycleMoves: state.cycleMoves || 0,
    warn: state.warningSquare || null,
    zone: state.corrupted || [],
    defenseLeft: state.defenseMovesLeft || 0,
    lost: null,
  };

  const color = root.turn;
  const rootMoves = generate(root);

  if (!rootMoves.length) return null;

  // variety ke liye shuffle
  for (let i = rootMoves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rootMoves[i], rootMoves[j]] = [rootMoves[j], rootMoves[i]];
  }

  const cfg = LEVELS[level] || LEVELS[3];

  if (cfg.depth === 0) {
    return rootMoves[Math.floor(Math.random() * rootMoves.length)];
  }

  const deadline = cfg.time ? Date.now() + cfg.time : Infinity;
  let nodes = 0;

  const tick = () => {
    nodes += 1;
    if ((nodes & 255) === 0 && Date.now() > deadline) throw new Timeout();
  };

  function search(node, depth, alpha, beta, ply) {
    tick();

    const side = node.turn;

    if (node.lost) {
      return node.lost === side ? -MATE + ply : MATE - ply;
    }

    if (depth <= 0) {
      if (isInCheck(node.board, side) && !generate(node).length) {
        return -MATE + ply;
      }

      return evaluateBio(node, side);
    }

    const moves = generate(node);

    if (!moves.length) {
      const trapped =
        node.zone.length && node.zone.includes(findKing(node.board, side));

      return isInCheck(node.board, side) || trapped ? -MATE + ply : 0;
    }

    let best = -Infinity;

    for (const move of orderMoves(node.board, moves)) {
      const next = advance(node, move);
      if (!next) continue;

      const score = -search(next, depth - 1, -beta, -alpha, ply + 1);

      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    return best;
  }

  function scoreRoot(depth) {
    const scored = [];
    let alpha = -Infinity;

    for (const move of orderMoves(root.board, rootMoves)) {
      const next = advance(root, move);
      if (!next) continue;

      const windowAlpha = cfg.noise ? -Infinity : alpha;
      const score = -search(next, depth - 1, -Infinity, -windowAlpha, 1);

      scored.push({ move, score });
      if (score > alpha) alpha = score;
    }

    return scored;
  }

  let result = null;

  try {
    for (let depth = 1; depth <= cfg.depth; depth++) {
      if (!cfg.time && depth < cfg.depth) continue;
      result = scoreRoot(depth);
    }
  } catch (error) {
    if (!(error instanceof Timeout)) throw error;
  }

  if (!result) {
    result = rootMoves.map((move) => {
      const next = advance(root, move);

      return {
        move,
        score: next ? -evaluateBio(next, opp(color)) : -Infinity,
      };
    });
  }

  const noisy = result
    .map((item) => ({
      ...item,
      score: item.score + (cfg.noise ? Math.random() * cfg.noise : 0),
    }))
    .sort((a, b) => b.score - a.score);

  if (level === 2) {
    const pool = noisy.slice(0, Math.min(3, noisy.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  if (!cfg.noise) return noisy[0].move;

  const top = noisy[0].score;
  const pool = noisy.filter((item) => top - item.score <= 10);

  return pool[Math.floor(Math.random() * pool.length)].move;
}