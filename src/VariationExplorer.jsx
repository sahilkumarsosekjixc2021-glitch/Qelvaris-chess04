
import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";

const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const buttonStyle = {
  background: "#1b3026",
  border: "1px solid #385343",
  color: "#e8eee9",
  padding: "9px 12px",
  borderRadius: 8,
  cursor: "pointer",
};

function previewMove(report, choice) {
  try {
    const game = new Chess(report.fenBefore);
    let move;

    if (choice === "best") {
      const uci = report.bestMove;
      if (!uci || uci.length < 4) {
        return { error: "Engine move is unavailable in this report." };
      }

      move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] || "q",
      });
    } else {
      move = game.move(report.san);
    }

    if (!move) return { error: "This move could not be applied to the position." };

    return {
      fenBefore: report.fenBefore,
      fenAfter: game.fen(),
      game,
      move,
    };
  } catch {
    return { error: "Unable to load this chess position." };
  }
}

export default function VariationExplorer({ report }) {
  const [choice, setChoice] = useState("best");
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setChoice("best");
    setFlipped(false);
  }, [report?.ply, report?.fenBefore]);

  const preview = useMemo(
    () => report?.fenBefore ? previewMove(report, choice) : null,
    [report, choice]
  );

  if (!report) {
    return (
      <section style={{ ...panelStyle }}>
        <h3 style={{ marginTop: 0 }}>Variation Explorer</h3>
        <p style={mutedStyle}>Select an analyzed move to compare it with the engine suggestion.</p>
      </section>
    );
  }

  if (!preview || preview.error) {
    return (
      <section style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>Variation Explorer</h3>
        <p style={mutedStyle}>{preview?.error || "Preview unavailable."}</p>
      </section>
    );
  }

  const board = preview.game.board();
  const rows = flipped
    ? [...board].reverse().map((row) => [...row].reverse())
    : board;

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 5px" }}>Variation Explorer</h3>
          <p style={{ ...mutedStyle, margin: 0 }}>
            Position before move {report.ply}. Compare two candidate moves.
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={() => setFlipped((v) => !v)}>
          ⇅ Flip board
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button
          type="button"
          style={{
            ...buttonStyle,
            background: choice === "best" ? "#176b48" : "#1b3026",
            borderColor: choice === "best" ? "#69bb87" : "#385343",
          }}
          onClick={() => setChoice("best")}
        >
          Engine: {report.bestMoveSan || "Unavailable"}
        </button>

        <button
          type="button"
          style={{
            ...buttonStyle,
            background: choice === "played" ? "#176b48" : "#1b3026",
            borderColor: choice === "played" ? "#69bb87" : "#385343",
          }}
          onClick={() => setChoice("played")}
        >
          Played: {report.san}
        </button>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(8,minmax(0,1fr))",
        gridTemplateRows: "repeat(8,minmax(0,1fr))",
        width: "100%",
        maxWidth: 440,
        aspectRatio: "1 / 1",
        margin: "16px auto 0",
        border: "4px solid #293a31",
        borderRadius: 5,
        overflow: "hidden",
        boxSizing: "border-box",
      }}>
        {rows.flatMap((row, r) => row.map((piece, c) => {
          const realR = flipped ? 7 - r : r;
          const realC = flipped ? 7 - c : c;
          const light = (realR + realC) % 2 === 0;
          const square = `${String.fromCharCode(97 + realC)}${8 - realR}`;
          const highlighted = square === preview.move.from || square === preview.move.to;

          return (
            <div
              key={`${r}-${c}`}
              title={square}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 0,
                minHeight: 0,
                background: highlighted ? "#b9c66a" : light ? "#e4e8d5" : "#58816a",
                color: piece?.color === "w" ? "#fffdf4" : "#17221b",
                textShadow: piece?.color === "w" ? "0 1px 3px #25392d" : "none",
                fontSize: "clamp(17px,4.5vw,43px)",
                lineHeight: 1,
              }}
            >
              {piece ? PIECES[piece.color][piece.type] : ""}
              {c === 0 && (
                <span style={{
                  position: "absolute",
                  top: 1,
                  left: 3,
                  fontSize: 9,
                  color: light ? "#58816a" : "#e4e8d5",
                }}>{8 - realR}</span>
              )}
              {r === 7 && (
                <span style={{
                  position: "absolute",
                  right: 3,
                  bottom: 1,
                  fontSize: 9,
                  color: light ? "#58816a" : "#e4e8d5",
                }}>{String.fromCharCode(97 + realC)}</span>
              )}
            </div>
          );
        }))}
      </div>

      <div style={{
        marginTop: 12,
        padding: 12,
        background: "#182720",
        borderRadius: 9,
        color: "#e8eee9",
        fontSize: 13,
        lineHeight: 1.7,
      }}>
        <strong>{choice === "best" ? "Engine candidate" : "Your played move"}: {preview.move.san}</strong>
        <div style={mutedStyle}>
          {preview.move.color === "w" ? "White" : "Black"} played {preview.move.san}.
          Highlighted squares show the move's origin and destination.
        </div>
        <div style={{ ...mutedStyle, marginTop: 5 }}>
          {preview.game.isCheckmate()
            ? "The move delivers checkmate."
            : preview.game.isCheck()
              ? "The move gives check."
              : preview.game.isDraw()
                ? "The resulting position is a draw."
                : "Position after the selected move."}
        </div>
      </div>

      <p style={{ ...mutedStyle, marginBottom: 0, marginTop: 10 }}>
        This version compares one move at a time using the existing report.
        Multi-move engine continuations require the principal variation to be
        stored by Game Review's Stockfish analysis.
      </p>
    </section>
  );
}

const panelStyle = {
  marginTop: 18,
  padding: 15,
  background: "#111c18",
  border: "1px solid #293a31",
  borderRadius: 12,
  color: "#e8eee9",
};

const mutedStyle = {
  color: "#a3b4a9",
  fontSize: 12,
  lineHeight: 1.6,
};
