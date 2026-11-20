// Coach whisper: turns an engine best move into 3 levels of help. Pure functions.
import { Chess } from "chess.js";

const PIECE = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

// uci like "g1f3" -> info about the move in this position, or null if illegal
export function describeMove(fen, uci) {
  if (!uci || uci.length < 4) return null;
  try {
    const chess = new Chess(fen);
    const mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (!mv) return null;
    return {
      san: mv.san,
      piece: PIECE[mv.piece],
      from: mv.from,
      to: mv.to,
      capture: Boolean(mv.captured),
      check: mv.san.includes("+") || mv.san.includes("#"),
      castle: mv.san.startsWith("O-O"),
      promo: Boolean(mv.promotion),
    };
  } catch {
    return null;
  }
}

// level 1 = gentle nudge, 2 = which piece, 3 = the move
export function whisperText(info, level) {
  if (!info) return null;
  if (level === 1) {
    if (info.promo) return { key: "w1promo" };
    if (info.capture) return { key: "w1capture" };
    if (info.check) return { key: "w1check" };
    if (info.castle) return { key: "w1castle" };
    return { key: "w1quiet" };
  }
  if (level === 2) return { key: "w2", vars: { piece: info.piece } };
  return { key: "w3", vars: { san: info.san, from: info.from, to: info.to } };
}
