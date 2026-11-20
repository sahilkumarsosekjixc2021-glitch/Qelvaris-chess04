import { getMoves, getSquare } from "./fogEngine";

const FILES = "abcdefgh";

export const getVisibility = (board, color, enPassant, castling) => {
  const visible = new Set();

  Object.entries(board).forEach(([from, piece]) => {
    if (piece.color !== color) return;

    visible.add(from);

    if (piece.type === "p") {
      const f = FILES.indexOf(from[0]);
      const r = Number(from[1]);
      const direction = color === "w" ? 1 : -1;

      const forward = getSquare(f, r + direction);

      if (forward && !board[forward]) {
        visible.add(forward);

        const two = getSquare(f, r + direction * 2);
        const startingRank = color === "w" ? 2 : 7;

        if (r === startingRank && two && !board[two]) {
          visible.add(two);
        }
      }

      [-1, 1].forEach((df) => {
        const diagonal = getSquare(f + df, r + direction);

        if (
          diagonal &&
          (board[diagonal]?.color !== color && board[diagonal] ||
            diagonal === enPassant)
        ) {
          visible.add(diagonal);
        }
      });
    } else {
      getMoves(board, from, enPassant, castling).forEach((sq) => {
        visible.add(sq);
      });
    }
  });

  return visible;
};

export const createVisibleFen = (board, visible) => {
  const rows = [];

  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;

    for (let file = 0; file < 8; file++) {
      const sq = FILES[file] + rank;
      const piece = visible.has(sq) ? board[sq] : null;

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
        : piece.type;
    }

    if (empty) row += empty;
    rows.push(row);
  }

  return rows.join("/") + " w - - 0 1";
};