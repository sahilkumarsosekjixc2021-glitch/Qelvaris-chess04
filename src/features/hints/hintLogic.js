import { Chess } from "chess.js";

const PIECE = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

// Turns the engine's best move (uci) into three progressively stronger hints.
// Returns null if the move is not legal in this position (never show a wrong hint).
export function buildHint(fen, uci) {
  if (!uci || uci.length < 4) return null;
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const move = chess.move({ from, to, promotion: uci[4] });
    if (!move) return null;
    return { from, to, san: move.san, piece: PIECE[move.piece] || "piece" };
  } catch {
    return null;
  }
}
