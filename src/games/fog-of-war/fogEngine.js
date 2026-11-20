
const FILES = "abcdefgh";

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

export const getSquare = (file, rank) => {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return FILES[file] + rank;
};

const opposite = (color) => color === "w" ? "b" : "w";

export const getKingSquare = (board, color) =>
  Object.keys(board).find(
    (square) =>
      board[square]?.type === "k" &&
      board[square]?.color === color
  ) || null;

export const isSquareAttacked = (board, square, byColor) => {
  if (!square) return false;

  const targetFile = FILES.indexOf(square[0]);
  const targetRank = Number(square[1]);

  // Pawn attacks
  const pawnSourceRank = targetRank + (byColor === "w" ? -1 : 1);

  for (const df of [-1, 1]) {
    const source = getSquare(targetFile + df, pawnSourceRank);
    if (
      source &&
      board[source]?.type === "p" &&
      board[source]?.color === byColor
    ) {
      return true;
    }
  }

  // Knight attacks
  const knightJumps = [
    [1, 2], [2, 1], [2, -1], [1, -2],
    [-1, -2], [-2, -1], [-2, 1], [-1, 2],
  ];

  for (const [df, dr] of knightJumps) {
    const source = getSquare(targetFile + df, targetRank + dr);
    if (
      source &&
      board[source]?.type === "n" &&
      board[source]?.color === byColor
    ) {
      return true;
    }
  }

  // King attacks
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue;

      const source = getSquare(targetFile + df, targetRank + dr);

      if (
        source &&
        board[source]?.type === "k" &&
        board[source]?.color === byColor
      ) {
        return true;
      }
    }
  }

  // Sliding attacks
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  for (const [df, dr] of directions) {
    for (let distance = 1; distance <= 7; distance++) {
      const source = getSquare(
        targetFile + df * distance,
        targetRank + dr * distance
      );

      if (!source) break;

      const piece = board[source];
      if (!piece) continue;

      if (piece.color === byColor) {
        const diagonal = df !== 0 && dr !== 0;
        const straight = !diagonal;

        if (
          piece.type === "q" ||
          (diagonal && piece.type === "b") ||
          (straight && piece.type === "r") ||
          (distance === 1 && piece.type === "k")
        ) {
          return true;
        }
      }

      break;
    }
  }

  return false;
};

export const isInCheck = (board, color) => {
  const king = getKingSquare(board, color);

  // A missing king is treated as an invalid/terminal position.
  if (!king) return true;

  return isSquareAttacked(board, king, opposite(color));
};

// Internal move application. Does not perform legality checks.
const applyRawMove = (
  board,
  from,
  to,
  enPassant,
  castling,
  promotion = "q"
) => {
  const moving = board[from];
  if (!moving) return null;

  const captured = board[to];

  // Kings are never captured in standard chess.
  if (captured?.type === "k") return null;

  const nextBoard = { ...board };
  delete nextBoard[from];

  // En passant
  if (
    moving.type === "p" &&
    to === enPassant &&
    !captured
  ) {
    const capturedRank =
      Number(to[1]) + (moving.color === "w" ? -1 : 1);

    const capturedSquare = to[0] + capturedRank;

    if (
      nextBoard[capturedSquare]?.type !== "p" ||
      nextBoard[capturedSquare]?.color !== opposite(moving.color)
    ) {
      return null;
    }

    delete nextBoard[capturedSquare];
  }

  // Castling rook movement
  if (
    moving.type === "k" &&
    Math.abs(FILES.indexOf(to[0]) - FILES.indexOf(from[0])) === 2
  ) {
    const rank = to[1];

    if (to[0] === "g") {
      nextBoard["f" + rank] = nextBoard["h" + rank];
      delete nextBoard["h" + rank];
    } else {
      nextBoard["d" + rank] = nextBoard["a" + rank];
      delete nextBoard["a" + rank];
    }
  }

  const isPromotion =
    moving.type === "p" &&
    (to[1] === "8" || to[1] === "1");

  const promotionType = ["q", "r", "b", "n"].includes(promotion)
    ? promotion
    : "q";

  nextBoard[to] = {
    ...moving,
    type: isPromotion ? promotionType : moving.type,
  };

  const nextCastling = { ...castling };

  if (moving.type === "k") {
    nextCastling[moving.color + "K"] = false;
    nextCastling[moving.color + "Q"] = false;
  }

  // Moving a rook from its original square
  if (moving.type === "r") {
    if (from === "a1") nextCastling.wQ = false;
    if (from === "h1") nextCastling.wK = false;
    if (from === "a8") nextCastling.bQ = false;
    if (from === "h8") nextCastling.bK = false;
  }

  // Capturing a rook on its original square
  if (captured?.type === "r") {
    if (to === "a1") nextCastling.wQ = false;
    if (to === "h1") nextCastling.wK = false;
    if (to === "a8") nextCastling.bQ = false;
    if (to === "h8") nextCastling.bK = false;
  }

  const nextEnPassant =
    moving.type === "p" &&
    Math.abs(Number(to[1]) - Number(from[1])) === 2
      ? getSquare(
          FILES.indexOf(from[0]),
          (Number(from[1]) + Number(to[1])) / 2
        )
      : null;

  return {
    board: nextBoard,
    castling: nextCastling,
    enPassant: nextEnPassant,
    captured,
    winner: null,
  };
};

// Pseudo-legal moves: movement rules only.
const getPseudoMoves = (board, from, enPassant, castling) => {
  const piece = board[from];
  if (!piece) return [];

  const f = FILES.indexOf(from[0]);
  const r = Number(from[1]);
  const moves = [];

  const add = (to) => {
    if (!to) return false;

    const target = board[to];

    if (!target) {
      moves.push(to);
      return true;
    }

    if (target.color !== piece.color && target.type !== "k") {
      moves.push(to);
    }

    return false;
  };

  if (piece.type === "p") {
    const direction = piece.color === "w" ? 1 : -1;
    const one = getSquare(f, r + direction);

    if (one && !board[one]) {
      moves.push(one);

      const two = getSquare(f, r + direction * 2);
      const startingRank = piece.color === "w" ? 2 : 7;

      if (r === startingRank && two && !board[two]) {
        moves.push(two);
      }
    }

    for (const df of [-1, 1]) {
      const target = getSquare(f + df, r + direction);

      if (
        target &&
        board[target] &&
        board[target].color !== piece.color &&
        board[target].type !== "k"
      ) {
        moves.push(target);
      }

      if (
        target &&
        target === enPassant &&
        !board[target]
      ) {
        const capturedRank =
          Number(target[1]) + (piece.color === "w" ? -1 : 1);

        const captured = board[target[0] + capturedRank];

        if (
          captured?.type === "p" &&
          captured.color === opposite(piece.color)
        ) {
          moves.push(target);
        }
      }
    }
  }

  if (piece.type === "n") {
    const jumps = [
      [1, 2], [2, 1], [2, -1], [1, -2],
      [-1, -2], [-2, -1], [-2, 1], [-1, 2],
    ];

    jumps.forEach(([df, dr]) =>
      add(getSquare(f + df, r + dr))
    );
  }

  if (["b", "r", "q"].includes(piece.type)) {
    const directions = [];

    if (["b", "q"].includes(piece.type)) {
      directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    }

    if (["r", "q"].includes(piece.type)) {
      directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    }

    directions.forEach(([df, dr]) => {
      for (let distance = 1; distance <= 7; distance++) {
        const target = getSquare(
          f + df * distance,
          r + dr * distance
        );

        if (!add(target)) break;
      }
    });
  }

  if (piece.type === "k") {
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df || dr) {
          add(getSquare(f + df, r + dr));
        }
      }
    }

    const home = piece.color === "w" ? 1 : 8;
    const enemy = opposite(piece.color);
    const kingSide = piece.color + "K";
    const queenSide = piece.color + "Q";

    if (from === "e" + home) {
      const kingPathSafe =
        !isSquareAttacked(board, "e" + home, enemy);

      if (
        kingPathSafe &&
        castling?.[kingSide] &&
        board["h" + home]?.type === "r" &&
        board["h" + home]?.color === piece.color &&
        !board["f" + home] &&
        !board["g" + home] &&
        !isSquareAttacked(board, "f" + home, enemy) &&
        !isSquareAttacked(board, "g" + home, enemy)
      ) {
        moves.push("g" + home);
      }

      if (
        kingPathSafe &&
        castling?.[queenSide] &&
        board["a" + home]?.type === "r" &&
        board["a" + home]?.color === piece.color &&
        !board["d" + home] &&
        !board["c" + home] &&
        !board["b" + home] &&
        !isSquareAttacked(board, "d" + home, enemy) &&
        !isSquareAttacked(board, "c" + home, enemy)
      ) {
        moves.push("c" + home);
      }
    }
  }

  return [...new Set(moves)];
};

// Legal moves: king must not remain in check.
export const getMoves = (
  board,
  from,
  enPassant = null,
  castling = {}
) => {
  const piece = board[from];
  if (!piece) return [];

  return getPseudoMoves(board, from, enPassant, castling).filter(
    (to) => {
      const result = applyRawMove(
        board,
        from,
        to,
        enPassant,
        castling,
        "q"
      );

      return result && !isInCheck(result.board, piece.color);
    }
  );
};

export const getAllLegalMoves = (
  board,
  color,
  enPassant = null,
  castling = {}
) => {
  const all = [];

  Object.keys(board).forEach((from) => {
    if (board[from]?.color !== color) return;

    getMoves(board, from, enPassant, castling).forEach((to) => {
      all.push({ from, to });
    });
  });

  return all;
};

export const getGameStatus = (
  board,
  color,
  enPassant = null,
  castling = {}
) => {
  const king = getKingSquare(board, color);

  if (!king) {
    return {
      state: "invalid",
      check: true,
      winner: opposite(color),
      reason: "King missing",
    };
  }

  const check = isInCheck(board, color);
  const moves = getAllLegalMoves(board, color, enPassant, castling);

  if (moves.length === 0 && check) {
    return {
      state: "checkmate",
      check: true,
      winner: opposite(color),
      reason: "Checkmate",
    };
  }

  if (moves.length === 0) {
    return {
      state: "stalemate",
      check: false,
      winner: "draw",
      reason: "Stalemate",
    };
  }

  return {
    state: check ? "check" : "playing",
    check,
    winner: null,
    reason: check ? "Check" : "",
  };
};

// Public move function: rejects illegal moves.
export const applyMove = (
  board,
  from,
  to,
  enPassant,
  castling,
  promotion = "q"
) => {
  const moving = board[from];
  if (!moving) return null;

  if (!getMoves(board, from, enPassant, castling).includes(to)) {
    return null;
  }

  return applyRawMove(
    board,
    from,
    to,
    enPassant,
    castling,
    promotion
  );
};
