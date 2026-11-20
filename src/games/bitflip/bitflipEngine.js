/* ==========================================================================
   BIT-FLIP ENGINE
   1) Legal chess: check, pins, castling, en passant, promotion,
      checkmate, stalemate, insufficient material.
   2) Bit-Flip glitch: two squares swap.
   ========================================================================== */

const FILES = "abcdefgh";
const opp = (c) => (c === "w" ? "b" : "w");

export const sqOf = (file, rank) =>
  file < 0 || file > 7 || rank < 1 || rank > 8
    ? null
    : FILES[file] + rank;

/* ------------------------------------------------------------------
   Setup + FEN
------------------------------------------------------------------- */

export const createInitialBoard = () => {
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
export const boardToFen = (board) => {
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
export const isAttacked = (board, target, by) => {
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

export const findKing = (board, color) =>
  Object.keys(board).find(
    (square) =>
      board[square]?.type === "k" &&
      board[square]?.color === color
  ) || null;

/** Missing king ko invalid/check position maana jayega. */
export const isInCheck = (board, color) => {
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
export const getLegalMoves = (
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

export const hasLegalMove = (
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
   PUBLIC MOVE FUNCTION
   Game component aur AI ko isi function ka use karna hai.
   Illegal move -> null.
------------------------------------------------------------------- */

export const applyMove = (
  board,
  from,
  to,
  enPassant,
  castling,
  promotion = "q"
) => {
  const piece = board[from];

  if (!piece || !to) return null;

  // Invalid destination or own piece capture.
  if (board[to]?.color === piece.color) return null;

  // King capture is never a legal chess move.
  if (board[to]?.type === "k") return null;

  const legalMoves = getLegalMoves(
    board,
    from,
    enPassant,
    castling
  );

  if (!legalMoves.includes(to)) {
    return null;
  }

  return applyMoveRaw(
    board,
    from,
    to,
    enPassant,
    castling,
    promotion
  );
};

/* ------------------------------------------------------------------
   Game status
   color = next player to move
   state: playing | checkmate | stalemate | draw
------------------------------------------------------------------- */

const insufficientMaterial = (board) => {
  const remaining = Object.values(board).filter(
    (piece) => piece.type !== "k"
  );

  if (remaining.length === 0) return true;

  return (
    remaining.length === 1 &&
    ["b", "n"].includes(remaining[0].type)
  );
};

export const getStatus = (
  board,
  color,
  enPassant,
  castling
) => {
  const check = isInCheck(board, color);

  if (insufficientMaterial(board)) {
    return {
      state: "draw",
      reason: "insufficient material",
      check,
    };
  }

  if (
    hasLegalMove(
      board,
      color,
      enPassant,
      castling
    )
  ) {
    return {
      state: "playing",
      check,
    };
  }

  return check
    ? {
        state: "checkmate",
        reason: "checkmate",
        check: true,
      }
    : {
        state: "stalemate",
        reason: "stalemate",
        check: false,
      };
};

/* ------------------------------------------------------------------
   BIT-FLIP GLITCH
------------------------------------------------------------------- */

/**
 * Do random squares chunta hai.
 * Kam se kam ek square par piece hona chahiye.
 * Pawn ko first/8th rank par nahi bhejta.
 */
export const pickGlitch = (board) => {
  const rand = () =>
    FILES[Math.floor(Math.random() * 8)] +
    (1 + Math.floor(Math.random() * 8));

  for (let tries = 0; tries < 300; tries++) {
    const a = rand();
    const b = rand();

    if (a === b) continue;

    const pieceA = board[a];
    const pieceB = board[b];

    if (!pieceA && !pieceB) continue;

    const badRank = (square) =>
      square[1] === "1" || square[1] === "8";

    if (pieceA?.type === "p" && badRank(b)) continue;
    if (pieceB?.type === "p" && badRank(a)) continue;

    return [a, b];
  }

  return null;
};

/** Do squares ke contents swap karta hai; castling rights update karta hai. */
export const applyGlitch = (board, castling, swap) => {
  if (!Array.isArray(swap) || swap.length !== 2) {
    return {
      board: { ...board },
      castling: { ...(castling || {}) },
    };
  }

  const [a, b] = swap;

  if (!a || !b || a === b) {
    return {
      board: { ...board },
      castling: { ...(castling || {}) },
    };
  }

  const next = { ...board };
  const pieceA = next[a];
  const pieceB = next[b];

  if (pieceB) next[a] = pieceB;
  else delete next[a];

  if (pieceA) next[b] = pieceA;
  else delete next[b];

  const nextCastling = { ...(castling || {}) };
  const touched = new Set([a, b]);

  // White castling rights
  if (touched.has("e1")) {
    nextCastling.wK = false;
    nextCastling.wQ = false;
  }

  if (touched.has("h1")) nextCastling.wK = false;
  if (touched.has("a1")) nextCastling.wQ = false;

  // Black castling rights
  if (touched.has("e8")) {
    nextCastling.bK = false;
    nextCastling.bQ = false;
  }

  if (touched.has("h8")) nextCastling.bK = false;
  if (touched.has("a8")) nextCastling.bQ = false;

  return {
    board: next,
    castling: nextCastling,
  };
};

/**
 * Ghost pieces: swap ke baad khaali hue square par
 * purani piece ka faded visual.
 */
export const ghostsFor = (before, swap) => {
  if (!Array.isArray(swap) || swap.length !== 2) {
    return [];
  }

  const [a, b] = swap;
  const out = [];

  if (before[a] && !before[b]) {
    out.push({ sq: a, ...before[a] });
  }

  if (before[b] && !before[a]) {
    out.push({ sq: b, ...before[b] });
  }

  return out;
};

/* ------------------------------------------------------------------
   AI ke liye: move already legal hai to dobara legality check kiye
   bina board update karta hai (search tez rehta hai).
------------------------------------------------------------------- */
export const applyMoveUnchecked = applyMoveRaw;

/** Ek color ki saari legal moves: [{from,to,promotion}] */
export const allLegalMoves = (board, color, enPassant, castling) => {
  const out = [];

  for (const from of Object.keys(board)) {
    const piece = board[from];
    if (!piece || piece.color !== color) continue;

    for (const to of getLegalMoves(board, from, enPassant, castling)) {
      const promotion =
        piece.type === "p" && (to[1] === "8" || to[1] === "1") ? "q" : null;

      out.push({ from, to, promotion });
    }
  }

  return out;
};