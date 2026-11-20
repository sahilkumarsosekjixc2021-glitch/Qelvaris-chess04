import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import Board from "../Board";

// Click-to-move board: piece par click, phir square par click.
// onMove({ from, to, promotion, san, uci }) legal chaal par bulta hai. Promotion abhi hamesha queen.
export default function PlayBoard({
  fen,
  flipped = false,
  lastMove = null,
  onMove,
  locked = false,
  arrows = [],
}) {
  const [sel, setSel] = useState(null);

  const targets = useMemo(() => {
    if (!sel) return [];
    try {
      return new Chess(fen).moves({ square: sel, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [sel, fen]);

  useEffect(() => {
    setSel(null);
  }, [fen]);

  function click(sq) {
    if (locked) return;
    const chess = new Chess(fen);

    if (sel && targets.includes(sq)) {
      try {
        const m = chess.move({ from: sel, to: sq, promotion: "q" });
        setSel(null);
        onMove({
          from: m.from,
          to: m.to,
          promotion: m.promotion,
          san: m.san,
          uci: m.from + m.to + (m.promotion || ""),
        });
      } catch {
        setSel(null);
      }
      return;
    }

    const piece = chess.get(sq);
    setSel(piece && piece.color === chess.turn() ? sq : null);
  }

  return (
    <Board
      fen={fen}
      flipped={flipped}
      lastMove={lastMove}
      selected={sel}
      targets={targets}
      arrows={arrows}
      onSquareClick={click}
      showCoords
    />
  );
}
