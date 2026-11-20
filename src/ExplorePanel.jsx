import { DEPTHS } from "./useExplore";
import { tx } from "./i18n/pages/explore"; // QV-I18N
import { lit } from "./i18n/pages/today"; // QV-I18N
import "./Explore.css";

/* Score white ke hisaab se: +0.34, -1.20, M3 */
function formatScore(line) {
  if (line.mate !== null) {
    if (line.mate === 0) return "#";
    return `${line.mate > 0 ? "+" : "−"}M${Math.abs(line.mate)}`;
  }
  const pawns = line.cp / 100;
  if (pawns === 0) return "0.00";
  return `${pawns > 0 ? "+" : "−"}${Math.abs(pawns).toFixed(2)}`;
}

/* Chaalon ko move number ke saath: 12. Nf3 Nc6 13. d4 */
function numbered(fen, moves) {
  const parts = fen.split(" ");
  let white = parts[1] !== "b";
  let no = Number(parts[5]) || 1;

  return moves.map((move, idx) => {
    const prefix = white ? `${no}.` : idx === 0 ? `${no}…` : "";
    if (!white) no += 1;
    white = !white;
    return { idx, san: move.san, prefix };
  });
}

export default function ExplorePanel({ ex }) {
  const reached = ex.lines[0]?.depth || 0;
  const pct = Math.min(100, Math.round((reached / ex.depth) * 100));

  let statusText = "";
  if (ex.status === "error") statusText = lit(ex.error);
  else if (ex.status === "running") statusText = reached ? tx("Thinking… depth {d} of {max}", { d: reached, max: ex.depth }) : tx("Starting the engine…");
  else if (ex.status === "done") {
    statusText = ex.lines.length ? tx("Depth {d} · Stockfish 19", { d: ex.depth }) : lit("No moves here. The game is over.");
  }

  const trailTokens = numbered(ex.baseFen, ex.trail);

  return (
    <div className="q-card st-ex">
      <div className="st-ex-head">
        <span className="q-eyebrow">{tx("Explore this position")}</span>
        <div className="st-ex-depths" role="group" aria-label={tx("Engine depth")}>
          {DEPTHS.map((d) => (
            <button
              key={d}
              type="button"
              className={`st-ex-depth ${ex.depth === d ? "is-on" : ""}`}
              aria-pressed={ex.depth === d}
              onClick={() => ex.setDepth(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <p className={`st-ex-status ${ex.status === "error" ? "is-error" : ""}`} aria-live="polite">
        {statusText}
      </p>
      {ex.status === "running" && (
        <div className="st-ex-progress" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      {ex.lines.length > 0 && (
        <ol className="st-ex-lines">
          {ex.lines.map((line, i) => (
            <li key={line.multipv} className={`st-ex-line ${i === 0 ? "is-best" : ""}`}>
              <span className="st-ex-score">{formatScore(line)}</span>
              <div className="st-ex-moves">
                {numbered(ex.fen, line.moves).map((tok) => (
                  <span key={tok.idx} className="st-ex-token">
                    {tok.prefix && <i>{tok.prefix}</i>}
                    <button type="button" onClick={() => ex.playLine(i, tok.idx)}>
                      {tok.san}
                    </button>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {ex.trail.length > 0 && (
        <div className="st-ex-trail">
          <span className="st-label">{tx("Your line")}</span>
          <p>
            {trailTokens.map((tok) => (
              <span key={tok.idx} className="st-ex-token">
                {tok.prefix && <i>{tok.prefix}</i>}
                <b>{tok.san}</b>
              </span>
            ))}
          </p>
          <div className="st-actions">
            <button type="button" className="st-btn" onClick={ex.back}>
              {tx("Undo last move")}
            </button>
            <button type="button" className="st-btn st-btn--primary" onClick={ex.reset}>
              {tx("Back to game")}
            </button>
          </div>
        </div>
      )}

      <p className="st-note">{tx("Click any move in a line to play it on the board, or move the pieces yourself.")}</p>
    </div>
  );
}