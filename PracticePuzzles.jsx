
import { useCallback, useEffect, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import "./PracticePuzzles.css";

function makePuzzlePosition(game, initialPly) {
  const completeGame = new Chess();
  completeGame.loadPgn(game.pgn);

  const headers = completeGame.header();
  const startingFen = headers.FEN || new Chess().fen();
  const history = completeGame.history({ verbose: true });
  const position = new Chess(startingFen);

  history.slice(0, initialPly).forEach((move) => {
    position.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });
  });

  return position;
}

export default function PracticePuzzles() {
  const [puzzle, setPuzzle] = useState(null);
  const [fen, setFen] = useState("");
  const [solution, setSolution] = useState([]);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("loading");
  const [hint, setHint] = useState(false);
  const [solved, setSolved] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setHint(false);
    setSelected(null);
    setTargets([]);
    setStatus("loading");

    try {
      const response = await fetch("https://lichess.org/api/puzzle/next", {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Puzzle service is busy. Please wait a minute and try again."
            : "Could not load a puzzle. Please try again."
        );
      }

      const data = await response.json();
      const position = makePuzzlePosition(data.game, data.puzzle.initialPly);

      setPuzzle(data.puzzle);
      setFen(position.fen());
      setSolution(data.puzzle.solution || []);
      setSolutionIndex(0);
      setStatus("playing");
      setMessage("Find the best move. Play the position on the board.");
    } catch (error) {
      console.error("Puzzle loading failed:", error);
      setStatus("error");
      setMessage(error.message || "Unable to load puzzle.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  function handleSquare(square) {
    if (status !== "playing" || !fen) return;

    try {
      const chess = new Chess(fen);

      if (selected && targets.includes(square)) {
        const moves = chess.moves({ square: selected, verbose: true });
        const move = moves.find((candidate) => candidate.to === square);

        if (!move) return;

        const uci = move.from + move.to + (move.promotion || "");
        const expected = solution[solutionIndex];

        if (uci !== expected) {
          setAttempts((count) => count + 1);
          setMessage("Not quite. Look for a stronger move and try again.");
          setSelected(null);
          setTargets([]);
          return;
        }

        chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q",
        });

        let nextIndex = solutionIndex + 1;

        // Automatically play the opponent's reply from the solution.
        if (nextIndex < solution.length) {
          const reply = solution[nextIndex];
          chess.move({
            from: reply.slice(0, 2),
            to: reply.slice(2, 4),
            promotion: reply.length > 4 ? reply[4] : "q",
          });
          nextIndex += 1;
        }

        setFen(chess.fen());
        setSolutionIndex(nextIndex);
        setSelected(null);
        setTargets([]);

        if (nextIndex >= solution.length) {
          setStatus("solved");
          setSolved((count) => count + 1);
          setMessage("Excellent! Puzzle solved. Your calculation was correct.");
        } else {
          setMessage("Correct move. Keep calculating.");
        }

        return;
      }

      const piece = chess.get(square);

      if (piece && piece.color === chess.turn()) {
        const legal = chess.moves({ square, verbose: true });
        if (legal.length) {
          setSelected(square);
          setTargets(legal.map((move) => move.to));
          return;
        }
      }

      setSelected(null);
      setTargets([]);
    } catch (error) {
      console.error("Puzzle move failed:", error);
    }
  }

  const flipped = fen ? new Chess(fen).turn() === "b" : false;

  return (
    <section className="pp-page">
      <div className="pp-heading">
        <div>
          <span className="pp-eyebrow">QELVARIS TRAINING ARENA</span>
          <h1>Practice Puzzles</h1>
          <p>Sharpen your tactical vision, one position at a time.</p>
        </div>

        <div className="pp-stats">
          <div>
            <strong>{solved}</strong>
            <span>Solved this session</span>
          </div>
          <div>
            <strong>{attempts}</strong>
            <span>Wrong attempts</span>
          </div>
        </div>
      </div>

      <div className="pp-layout">
        <div className="pp-board-card">
          <div className="pp-board-top">
            <div>
              <span className="pp-label">LIVE CHALLENGE</span>
              <h2>{puzzle ? `Puzzle ${puzzle.id}` : "Preparing puzzle"}</h2>
            </div>
            {puzzle && (
              <span className="pp-rating">Rating {puzzle.rating}</span>
            )}
          </div>

          <div className="pp-board">
            {fen && (
              <Board
                fen={fen}
                flipped={flipped}
                selected={selected}
                targets={targets}
                onSquareClick={handleSquare}
              />
            )}
          </div>

          <div className="pp-message" role="status">
            {loading ? "Finding your next challenge…" : message}
          </div>

          {hint && puzzle && (
            <div className="pp-hint">
              Themes: {(puzzle.themes || []).join(" · ") || "Tactics"}
            </div>
          )}

          <div className="pp-actions">
            {status === "playing" && (
              <>
                <button
                  className="pp-btn"
                  onClick={() => {
                    setHint(true);
                    setMessage("Think about the tactical themes in this position.");
                  }}
                >
                  Hint
                </button>
                <button
                  className="pp-btn"
                  onClick={() => {
                    setStatus("revealed");
                    setMessage(
                      `Solution: ${solution.join(" → ")}. Load another puzzle to continue.`
                    );
                  }}
                >
                  Show solution
                </button>
              </>
            )}

            {(status === "solved" || status === "revealed" || status === "error") && (
              <button
                className="pp-btn pp-btn-primary"
                onClick={loadPuzzle}
                disabled={loading}
              >
                {loading ? "Loading…" : "Next puzzle"}
              </button>
            )}
          </div>

          {status === "playing" && (
            <p className="pp-footnote">
              Select a piece, then select its destination square.
            </p>
          )}
        </div>

        <aside className="pp-info">
          <div className="pp-info-card">
            <span className="pp-label">YOUR TRAINING</span>
            <h3>Build your tactical instinct.</h3>
            <p>
              Solve puzzles to practise calculation, pattern recognition and
              decision-making outside your own game mistakes.
            </p>
            <div className="pp-progress">
              <div>
                <span>Session accuracy</span>
                <strong>
                  {solved + attempts > 0
                    ? Math.round((solved / (solved + attempts)) * 100)
                    : 0}%
                </strong>
              </div>
              <div className="pp-progress-track">
                <div
                  style={{
                    width: `${
                      solved + attempts > 0
                        ? (solved / (solved + attempts)) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pp-info-card">
            <span className="pp-label">PUZZLE THEMES</span>
            <div className="pp-tags">
              {(puzzle?.themes || ["Tactics", "Calculation", "Pattern recognition"]).map(
                (theme) => (
                  <span key={theme}>{theme.replaceAll("-", " ")}</span>
                )
              )}
            </div>
          </div>

          <div className="pp-source">
            Puzzles provided by Lichess.
            <a href="https://lichess.org/training" target="_blank" rel="noreferrer">
              Explore Lichess Training ↗
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
