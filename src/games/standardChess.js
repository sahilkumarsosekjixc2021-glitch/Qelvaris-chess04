
import { Chess } from "chess.js";

const FILES = "abcdefgh";

export const oppositeColor = (color) => color === "w" ? "b" : "w";

export function createStandardChess(board, turn, enPassant = null, castling = {}) {
  const rows = [];

  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;

    for (let file = 0; file < 8; file++) {
      const square = `${FILES[file]}${rank}`;
      const piece = board[square];

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

  const rights =
    (castling.wK ? "K" : "") +
    (castling.wQ ? "Q" : "") +
    (castling.bK ? "k" : "") +
    (castling.bQ ? "q" : "");

  const fen = [
    rows.join("/"),
    turn,
    rights || "-",
    enPassant || "-",
    "0",
    "1",
  ].join(" ");

  return new Chess(fen, { skipValidation: true });
}

export function getLegalMoves(
  board,
  from,
  color,
  enPassant = null,
  castling = {}
) {
  const piece = board[from];

  if (!piece || piece.color !== color) return [];

  try {
    const chess = createStandardChess(
      board,
      color,
      enPassant,
      castling
    );

    return chess.moves({
      square: from,
      verbose: true,
    });
  } catch (error) {
    console.error("Chess legal move validation:", error);
    return [];
  }
}

export function getAllLegalMoves(
  board,
  color,
  enPassant = null,
  castling = {}
) {
  const moves = [];

  for (const [from, piece] of Object.entries(board)) {
    if (!piece || piece.color !== color) continue;

    const legal = getLegalMoves(
      board,
      from,
      color,
      enPassant,
      castling
    );

    for (const move of legal) {
      moves.push({
        from: move.from,
        to: move.to,
        promotion: move.promotion || null,
        san: move.san,
      });
    }
  }

  return moves;
}

export function applyStandardMove(
  board,
  from,
  to,
  color,
  enPassant = null,
  castling = {},
  promotion = "q"
) {
  try {
    const chess = createStandardChess(
      board,
      color,
      enPassant,
      castling
    );

    const result = chess.move({
      from,
      to,
      promotion,
    });

    if (!result) return null;

    const nextBoard = {};

    const rows = chess.board();

    rows.forEach((rank, rowIndex) => {
      rank.forEach((piece, fileIndex) => {
        if (!piece) return;

        const square = `${FILES[fileIndex]}${8 - rowIndex}`;

        nextBoard[square] = {
          type: piece.type,
          color: piece.color,
        };
      });
    });

    const fenParts = chess.fen().split(" ");
    const rights = fenParts[2];

    return {
      board: nextBoard,
      enPassant: fenParts[3] === "-" ? null : fenParts[3],
      castling: {
        wK: rights.includes("K"),
        wQ: rights.includes("Q"),
        bK: rights.includes("k"),
        bQ: rights.includes("q"),
      },
      captured: result.captured
        ? {
            type: result.captured,
            color: oppositeColor(color),
          }
        : null,
      san: result.san,
      check: chess.isCheck(),
      checkmate: chess.isCheckmate(),
      stalemate: chess.isStalemate(),
      draw: chess.isDraw(),
      fen: chess.fen(),
    };
  } catch (error) {
    console.error("Chess move application:", error);
    return null;
  }
}

export function getPositionStatus(
  board,
  turn,
  enPassant = null,
  castling = {}
) {
  try {
    const chess = createStandardChess(
      board,
      turn,
      enPassant,
      castling
    );

    return {
      check: chess.isCheck(),
      checkmate: chess.isCheckmate(),
      stalemate: chess.isStalemate(),
      draw: chess.isDraw(),
      legalMoveCount: chess.moves().length,
    };
  } catch (error) {
    console.error("Chess position validation:", error);

    return {
      check: false,
      checkmate: false,
      stalemate: false,
      draw: false,
      legalMoveCount: 0,
      error: true,
    };
  }
}
