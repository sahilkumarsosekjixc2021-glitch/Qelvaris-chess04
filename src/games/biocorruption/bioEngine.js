
const FILES = "abcdefgh";

export const START_TIME = 300;
export const MOVES_PER_CYCLE = 4;
export const DEFENSE_MOVES = 3;

export const PLAYERS = {
  w: "Alpha",
  b: "Omega",
};

export const SPAWN_POOL = [
  "a1", "h1", "a8", "h8",
  "a3", "a4", "a5", "a6",
  "h3", "h4", "h5", "h6",
];

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const opposite = (color) => (color === "w" ? "b" : "w");

export const sqOf = (file, rank) =>
  file < 0 || file > 7 || rank < 1 || rank > 8
    ? null
    : FILES[file] + rank;

/*
 * Board object -> FEN.
 * Board component ke liye piece placement generate karta hai.
 */
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

  return `${rows.join("/")} w - - 0 1`;
};

/*
 * KING HELPERS
 */
export const getKingSquare = (board, color) => {
  return (
    Object.keys(board).find(
      (square) =>
        board[square]?.type === "k" &&
        board[square]?.color === color
    ) || null
  );
};

export const findKing = getKingSquare;

/*
 * Agar kisi side ka king board par nahi hai,
 * doosri side winner hoti hai.
 */
export const getWinnerFromPieces = (board) => {
  const whiteKing = getKingSquare(board, "w");
  const blackKing = getKingSquare(board, "b");

  if (!whiteKing && !blackKing) return "draw";
  if (!whiteKing) return "b";
  if (!blackKing) return "w";

  return null;
};

/*
 * MATERIAL COUNT
 */
export const getMaterialCount = (board, color) => {
  return Object.values(board).reduce((total, piece) => {
    if (!piece || piece.color !== color) return total;

    return total + (PIECE_VALUES[piece.type] || 0);
  }, 0);
};

/*
 * ZERO PATIENT / WARNING SQUARE
 *
 * Prefer an empty square so the warning does not immediately
 * overwrite a piece.
 */
export const pickSpawn = (rng = Math.random) => {
  return SPAWN_POOL[
    Math.floor(rng() * SPAWN_POOL.length)
  ];
};

export const chooseWarningSquare = (board) => {
  const emptySquares = [];

  for (let rank = 1; rank <= 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = FILES[file] + rank;

      if (!board[square]) {
        emptySquares.push(square);
      }
    }
  }

  if (emptySquares.length) {
    return emptySquares[
      Math.floor(Math.random() * emptySquares.length)
    ];
  }

  const fallback = SPAWN_POOL.filter(
    (square) => board[square]?.type !== "k"
  );

  if (!fallback.length) return "d4";

  return fallback[
    Math.floor(Math.random() * fallback.length)
  ];
};

/*
 * INFECTION ZONE
 *
 * Warning square ke aas-paas bounded 3x3 zone create hota hai.
 * Board ke bahar ke squares automatically ignore hote hain.
 */
export const createInfectionZone = (center) => {
  if (
    typeof center !== "string" ||
    !/^[a-h][1-8]$/.test(center)
  ) {
    return [];
  }

  const file = FILES.indexOf(center[0]);
  const rank = Number(center[1]);
  const zone = [];

  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const square = sqOf(file + df, rank + dr);

      if (square) zone.push(square);
    }
  }

  return zone;
};

/*
 * TRANSFORMATION
 *
 * Infection zone mein bache non-king pieces apni side change
 * karte hain. Kings transform nahi hote.
 *
 * Return shape component ke expected format ke mutabik:
 * { board, transformed }
 */
export const transformPieces = (board, corrupted) => {
  const nextBoard = { ...board };
  const transformed = [];

  const infectedSquares = new Set(corrupted || []);

  infectedSquares.forEach((square) => {
    const piece = nextBoard[square];

    if (!piece || piece.type === "k") return;

    const newColor = opposite(piece.color);

    nextBoard[square] = {
      ...piece,
      color: newColor,
      inf: 0,
      converted: true,
    };

    transformed.push({
      square,
      type: piece.type,
      from: piece.color,
      to: newColor,
    });
  });

  return {
    board: nextBoard,
    transformed,
  };
};

/*
 * KING PANIC
 *
 * null = king infection zone mein nahi hai.
 * [] = king zone mein hai lekin escape move nahi hai.
 * [squares] = allowed safe escape destinations.
 */
export const panicMoves = (
  board,
  color,
  corrupted,
  getMoves,
  enPassant,
  castling
) => {
  const infected = new Set(corrupted || []);
  const kingSquare = getKingSquare(board, color);

  if (!kingSquare || !infected.has(kingSquare)) {
    return null;
  }

  const moves = getMoves(
    board,
    kingSquare,
    enPassant,
    castling
  );

  if (!Array.isArray(moves)) return [];

  return moves.filter(
    (square) => !infected.has(square)
  );
};

/*
 * EXPANSION HELPERS
 * Existing infection-meter logic ke supporting exports.
 */
export const orthNeighbors = (square) => {
  if (!square || !/^[a-h][1-8]$/.test(square)) {
    return [];
  }

  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);

  return [
    sqOf(file + 1, rank),
    sqOf(file - 1, rank),
    sqOf(file, rank + 1),
    sqOf(file, rank - 1),
  ].filter(Boolean);
};

export const nextWave = (corrupted, minSafe = 12) => {
  const current = new Set(corrupted || []);

  if (!current.size) return [];

  const frontier = new Set();

  current.forEach((square) => {
    orthNeighbors(square).forEach((neighbor) => {
      if (!current.has(neighbor)) {
        frontier.add(neighbor);
      }
    });
  });

  const allowed = Math.max(
    0,
    64 - current.size - minSafe
  );

  return [...frontier].sort().slice(0, allowed);
};

/*
 * INFECTION METER HELPERS
 * Kept available so other code using the newer engine API
 * does not lose these exports.
 */
export const crossedCount = (
  from,
  to,
  type,
  corrupted
) => {
  if (type === "n") return 0;

  const infected = new Set(corrupted || []);

  const f1 = FILES.indexOf(from[0]);
  const r1 = Number(from[1]);
  const f2 = FILES.indexOf(to[0]);
  const r2 = Number(to[1]);

  const df = Math.sign(f2 - f1);
  const dr = Math.sign(r2 - r1);

  const sameFile = f1 === f2;
  const sameRank = r1 === r2;
  const diagonal =
    Math.abs(f2 - f1) === Math.abs(r2 - r1);

  if (!sameFile && !sameRank && !diagonal) {
    return 0;
  }

  let count = 0;
  let file = f1 + df;
  let rank = r1 + dr;

  while (file !== f2 || rank !== r2) {
    const square = sqOf(file, rank);

    if (square && infected.has(square)) {
      count++;
    }

    file += df;
    rank += dr;
  }

  return count;
};

export const settleTurn = (
  board,
  mover,
  corrupted,
  moved,
  threshold = 3
) => {
  const infected = new Set(corrupted || []);
  const nextBoard = { ...board };
  const infections = [];

  Object.keys(nextBoard).forEach((square) => {
    const piece = nextBoard[square];

    if (
      !piece ||
      piece.color !== mover ||
      piece.type === "k" ||
      piece.converted
    ) {
      return;
    }

    const isMoved = moved && moved.sq === square;
    let infection = piece.inf || 0;

    if (isMoved) {
      infection += moved.crossed || 0;
    }

    if (infected.has(square)) {
      infection += 1;
    } else if (!isMoved) {
      infection = Math.max(0, infection - 1);
    }

    if (infection >= threshold) {
      const newColor = opposite(mover);

      nextBoard[square] = {
        ...piece,
        color: newColor,
        inf: 0,
        converted: true,
      };

      infections.push({
        sq: square,
        ptype: piece.type,
        from: mover,
        to: newColor,
      });
    } else if (infection !== (piece.inf || 0)) {
      nextBoard[square] = {
        ...piece,
        inf: infection,
      };
    }
  });

  return {
    board: nextBoard,
    infections,
  };
};
