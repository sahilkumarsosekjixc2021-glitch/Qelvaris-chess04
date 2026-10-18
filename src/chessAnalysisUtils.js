
import { Chess } from "chess.js";

/**
 * Convert Stockfish centipawns into pawn units.
 * Example: 125 -> 1.25
 */
export function centipawnsToPawns(cp) {
  if (!Number.isFinite(Number(cp))) return 0;
  return Number(cp) / 100;
}

/**
 * Convert Stockfish score into a display string.
 * Pass mate distance when Stockfish reports a mate score.
 */
export function formatEngineScore(cp, mate = null) {
  if (mate !== null && mate !== undefined && Number.isFinite(Number(mate))) {
    const distance = Number(mate);
    if (distance === 0) return "M0";
    return `${distance > 0 ? "+" : "-"}M${Math.abs(distance)}`;
  }

  const score = centipawnsToPawns(cp);
  return `${score > 0 ? "+" : ""}${score.toFixed(2)}`;
}

/**
 * Classify centipawn loss.
 * Use only when before/after scores are measured
 * from the same player's perspective.
 */
export function classifyMoveLoss(loss) {
  const value = Math.max(0, Number(loss) || 0);

  if (value <= 10) return "Best";
  if (value <= 25) return "Excellent";
  if (value <= 50) return "Good";
  if (value <= 100) return "Inaccuracy";
  if (value <= 200) return "Mistake";
  return "Blunder";
}

/**
 * Convert a UCI move such as e2e4 or e7e8q to SAN.
 * Returns null if the move is illegal in the supplied position.
 */
export function uciToSan(fen, uci) {
  if (!fen || !uci || uci.length < 4) return null;

  try {
    const chess = new Chess(fen);

    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4].toLowerCase() : undefined,
    });

    return move?.san ?? null;
  } catch {
    return null;
  }
}

/**
 * Convert a UCI principal variation into SAN moves.
 * Returns the legal moves before the first invalid move.
 */
export function variationToSan(fen, uciMoves) {
  if (!fen || !Array.isArray(uciMoves)) return [];

  try {
    const chess = new Chess(fen);
    const sanMoves = [];

    for (const uci of uciMoves) {
      if (!uci || uci.length < 4) break;

      try {
        const move = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4].toLowerCase() : undefined,
        });

        if (!move) break;
        sanMoves.push(move.san);
      } catch {
        break;
      }
    }

    return sanMoves;
  } catch {
    return [];
  }
}

/**
 * Create a stable-enough identifier for a chess position.
 * Includes side to move, castling rights and en-passant square.
 */
export function getPositionKey(fen) {
  if (!fen) return "";

  const parts = fen.trim().split(/\s+/);
  return parts.length >= 4 ? parts.slice(0, 4).join(" ") : fen.trim();
}

/**
 * Return a legal move's resulting FEN without changing
 * the caller's original chess position.
 */
export function getResultingFen(fen, move) {
  if (!fen || !move) return null;

  try {
    const chess = new Chess(fen);
    const result = chess.move(move);
    return result ? chess.fen() : null;
  } catch {
    return null;
  }
}
