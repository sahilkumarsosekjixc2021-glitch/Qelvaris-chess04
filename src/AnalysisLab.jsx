
import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./AnalysisLab.css";

const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";
const MULTI_PV = 5;

const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

function parseInfo(message) {
  const depth = Number(message.match(/\bdepth (\d+)/)?.[1] || 0);
  const multipv = Number(message.match(/\bmultipv (\d+)/)?.[1] || 1);
  const cpMatch = message.match(/\bscore cp (-?\d+)/);
  const mateMatch = message.match(/\bscore mate (-?\d+)/);
  const pv = message.match(/\bpv (.+)$/)?.[1]?.trim() || "";

  if (!cpMatch && !mateMatch) return null;

  return {
    depth,
    multipv,
    cp: cpMatch ? Number(cpMatch[1]) / 100 : null,
    mate: mateMatch ? Number(mateMatch[1]) : null,
    pv,
  };
}

function scoreText(line) {
  if (!line) return "—";

  if (line.mate !== null) {
    return line.mate > 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  }

  const value = line.cp ?? 0;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function scoreForWhite(line, fen) {
  if (!line) return null;

  const sideToMove = fen.split(" ")[1];
  const score =
    line.mate !== null
      ? line.mate > 0
        ? 100
        : -100
      : line.cp ?? 0;

  return sideToMove === "w" ? score : -score;
}

function candidateGapText(first, second) {
  if (!first || !second) return "";

  if (first.mate !== null || second.mate !== null) {
    return "At least one line reports a forced mate. Preview both lines to compare their continuations.";
  }

  const gap = Math.round(
    Math.abs((first.cp ?? 0) - (second.cp ?? 0)) * 100
  );

  if (gap <= 20) {
    return `The top two lines are close in this search (about ${gap} centipawns apart). Compare their continuations.`;
  }

  return `The top line scores about ${gap} centipawns differently from the second line in this search. Preview both before choosing.`;
}

function makePositions(pgn) {
  const replay = new Chess();
  if (pgn) replay.loadPgn(pgn);

  const history = replay.history();
  const current = new Chess();
  const result = [{ fen: current.fen(), pgn: "" }];

  for (const san of history) {
    current.move(san);
    result.push({ fen: current.fen(), pgn: current.pgn() });
  }

  return result;
}

function loadFen(fen) {
  const position = new Chess();
  position.load(fen);
  return position;
}

export default function AnalysisLab() {
  const [positions, setPositions] = useState(() => [
    { fen: new Chess().fen(), pgn: "" },
  ]);
  const [positionIndex, setPositionIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [depth, setDepth] = useState("12");
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [thinking, setThinking] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [notice, setNotice] = useState("");
  const [showPgn, setShowPgn] = useState(false);
  const [pgnInput, setPgnInput] = useState("");
  const [variation, setVariation] = useState([]);
  const [variationIndex, setVariationIndex] = useState(0);

  const workerRef = useRef(null);
  const engineReadyRef = useRef(false);
  const requestIdRef = useRef(0);
  const currentFenRef = useRef(new Chess().fen());
  const currentRequestRef = useRef(null);
  const latestInfoRef = useRef([]);

  const currentFen = positions[positionIndex]?.fen || new Chess().fen();

  const boardFen =
    variation.length > 0
      ? variation[variationIndex]?.fen || currentFen
      : currentFen;

  const boardGame = (() => {
    try {
      return loadFen(boardFen);
    } catch {
      return new Chess();
    }
  })();

  const requestAnalysis = useCallback((fen, selectedDepth) => {
    const worker = workerRef.current;
    if (!worker || !engineReadyRef.current) return;

    requestIdRef.current += 1;
    currentRequestRef.current = {
      id: requestIdRef.current,
      fen,
      depth: Number(selectedDepth),
    };

    currentFenRef.current = fen;
    latestInfoRef.current = [];

    setCandidates([]);
    setThinking(true);
    setEngineError("");

    worker.postMessage("stop");
    worker.postMessage("ucinewgame");
    worker.postMessage(`setoption name MultiPV value ${MULTI_PV}`);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${selectedDepth}`);
  }, []);

  useEffect(() => {
    let worker;

    try {
      worker = new Worker(ENGINE_URL);
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const message = String(event.data || "");

        if (message === "uciok") {
          worker.postMessage(`setoption name MultiPV value ${MULTI_PV}`);
          worker.postMessage("isready");
          return;
        }

        if (message === "readyok") {
          engineReadyRef.current = true;
          setEngineReady(true);
          return;
        }

        if (message.startsWith("info ")) {
          const parsed = parseInfo(message);
          if (!parsed) return;

          const request = currentRequestRef.current;
          if (!request || request.fen !== currentFenRef.current) return;

          const line = {
            ...parsed,
            san: (() => {
              try {
                const game = new Chess(request.fen);
                const moves = [];

                for (const uci of parsed.pv.split(/\s+/).slice(0, 10)) {
                  if (uci.length < 4) break;

                  const move = game.move({
                    from: uci.slice(0, 2),
                    to: uci.slice(2, 4),
                    ...(uci[4] ? { promotion: uci[4] } : {}),
                  });

                  if (!move) break;
                  moves.push(move.san);
                }

                return moves.join(" ");
              } catch {
                return "";
              }
            })(),
            whiteScore: scoreForWhite(parsed, request.fen),
          };

          latestInfoRef.current[parsed.multipv - 1] = line;
          setCandidates(latestInfoRef.current.filter(Boolean));
          return;
        }

        if (message.startsWith("bestmove")) {
          if (!currentRequestRef.current) return;
          setThinking(false);
        }
      };

      worker.onerror = () => {
        setEngineError(
          "Stockfish load nahi hua. Check karo ki public/stockfish/stockfish-19-lite-single.js file exist karti hai."
        );
        setThinking(false);
      };

      worker.postMessage("uci");
    } catch {
      setEngineError(
        "Stockfish start nahi hua. Engine file ka path aur browser console check karo."
      );
    }

    return () => {
      engineReadyRef.current = false;
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (engineReady) requestAnalysis(currentFen, depth);
  }, [engineReady, currentFen, depth, requestAnalysis]);

  const resetBoard = () => {
    const fresh = new Chess();

    setPositions([{ fen: fresh.fen(), pgn: "" }]);
    setPositionIndex(0);
    setSelected(null);
    setVariation([]);
    setVariationIndex(0);
    setNotice("");
  };

  const goToPosition = (index) => {
    const nextIndex = Math.max(0, Math.min(index, positions.length - 1));

    setPositionIndex(nextIndex);
    setSelected(null);
    setVariation([]);
    setVariationIndex(0);
  };

  const playMove = (from, to) => {
    if (variation.length) {
      setNotice("Pehle variation preview close karo.");
      return;
    }

    if (positionIndex !== positions.length - 1) {
      setNotice("Nayi move khelne ke liye latest position par jao.");
      return;
    }

    try {
      const next = loadFen(currentFen);
      const move = next.move({ from, to, promotion: "q" });

      if (!move) {
        setSelected(null);
        return;
      }

      const nextPositions = positions.slice(0, positionIndex + 1);
      nextPositions.push({ fen: next.fen(), pgn: next.pgn() });

      setPositions(nextPositions);
      setPositionIndex(nextPositions.length - 1);
      setSelected(null);
      setNotice("");
    } catch {
      setSelected(null);
    }
  };

  const onSquareClick = (square) => {
    if (variation.length) return;

    const position = loadFen(currentFen);
    const piece = position.get(square);

    if (!selected) {
      if (piece && piece.color === position.turn()) setSelected(square);
      return;
    }

    if (selected === square) {
      setSelected(null);
      return;
    }

    if (piece && piece.color === position.turn()) {
      setSelected(square);
      return;
    }

    const legalMoves = position.moves({ square: selected, verbose: true });

    if (legalMoves.some((move) => move.to === square)) {
      playMove(selected, square);
    } else {
      setSelected(null);
    }
  };

  const importPgn = () => {
    try {
      const imported = new Chess();
      imported.loadPgn(pgnInput);

      const nextPositions = makePositions(imported.pgn());

      setPositions(nextPositions);
      setPositionIndex(nextPositions.length - 1);
      setSelected(null);
      setVariation([]);
      setVariationIndex(0);
      setNotice("PGN successfully import ho gaya.");
      setShowPgn(false);
    } catch {
      setNotice("PGN invalid hai. PGN dobara check karke paste karo.");
    }
  };

  const startVariation = (line) => {
    if (!line?.pv) return;

    const position = loadFen(currentFen);
    const nextVariation = [{ san: "Starting position", fen: currentFen }];

    for (const uci of line.pv.split(/\s+/).slice(0, 12)) {
      if (uci.length < 4) break;

      try {
        const move = position.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          ...(uci[4] ? { promotion: uci[4] } : {}),
        });

        if (!move) break;
        nextVariation.push({ san: move.san, fen: position.fen() });
      } catch {
        break;
      }
    }

    if (nextVariation.length <= 1) return;

    setVariation(nextVariation);
    setVariationIndex(1);
    setSelected(null);
    setNotice("");
  };

  const closeVariation = () => {
    setVariation([]);
    setVariationIndex(0);
  };

  const files = flipped
    ? ["h", "g", "f", "e", "d", "c", "b", "a"]
    : ["a", "b", "c", "d", "e", "f", "g", "h"];

  const ranks = flipped
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];

  const topLine = candidates[0];
  const secondLine = candidates[1];
  const comparisonText = candidateGapText(topLine, secondLine);
  const score = topLine?.whiteScore ?? 0;
  const evalWidth = `${Math.max(4, Math.min(96, 50 + score * 10))}%`;

  return (
    <div className="analysis-page">
      <div className="analysis-heading">
        <div>
          <h1>Analysis Lab</h1>
          <p>Analyse positions and compare Stockfish candidate moves.</p>
        </div>

        <div className="analysis-toolbar">
          <label>
            Depth{" "}
            <select
              value={depth}
              onChange={(event) => setDepth(event.target.value)}
            >
              <option value="8">Quick · 8</option>
              <option value="12">Standard · 12</option>
              <option value="16">Deep · 16</option>
            </select>
          </label>

          <button
            disabled={!engineReady || thinking}
            onClick={() => requestAnalysis(currentFen, depth)}
          >
            {thinking ? "Analysing…" : "Try Again"}
          </button>

          <button onClick={() => setFlipped((value) => !value)}>
            Flip board
          </button>

          <button onClick={resetBoard}>Reset</button>

          <button onClick={() => setShowPgn((value) => !value)}>
            PGN tools
          </button>
        </div>
      </div>

      {engineError && <p className="analysis-error">{engineError}</p>}
      {notice && <p className="analysis-notice">{notice}</p>}

      {!engineReady && !engineError && (
        <p className="analysis-notice">Stockfish engine start ho raha hai…</p>
      )}

      {showPgn && (
        <section className="analysis-card">
          <h3>Import PGN</h3>

          <textarea
            rows={5}
            value={pgnInput}
            onChange={(event) => setPgnInput(event.target.value)}
            placeholder="Paste PGN here..."
          />

          <div className="analysis-toolbar">
            <button onClick={importPgn}>Import game</button>
            <button
              onClick={() => {
                setPgnInput(positions[positionIndex]?.pgn || "");
                setNotice("Current position ka PGN input mein load ho gaya.");
              }}
            >
              Load current PGN
            </button>
          </div>
        </section>
      )}

      <div className="analysis-layout">
        <section className="analysis-board-column">
          <div className="analysis-card">
            <div className="analysis-board-wrap">
              <div className="analysis-board">
                {ranks.map((rank, rowIndex) =>
                  files.map((file, colIndex) => {
                    const square = `${file}${rank}`;
                    const piece = boardGame.get(square);
                    const isDark = (rowIndex + colIndex) % 2 === 1;
                    const isSelected = selected === square;

                    const legalMoves = selected
                      ? boardGame.moves({ square: selected, verbose: true })
                      : [];

                    const isLegal = legalMoves.some(
                      (move) => move.to === square
                    );

                    return (
                      <button
                        key={square}
                        type="button"
                        className={`analysis-square ${isDark ? "dark" : "light"} ${isSelected ? "selected" : ""} ${isLegal ? "legal" : ""}`}
                        onClick={() => onSquareClick(square)}
                        aria-label={square}
                      >
                        {piece && (
                          <span
                            className={`analysis-piece ${
                              piece.color === "w" ? "white-piece" : "black-piece"
                            }`}
                          >
                            {PIECES[piece.color][piece.type]}
                          </span>
                        )}

                        {!piece && isLegal && (
                          <span className="analysis-legal-dot" />
                        )}

                        <span className="analysis-coordinate">{square}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="analysis-eval-bar">
                <div
                  className="analysis-eval-white"
                  style={{ height: evalWidth }}
                />
              </div>
            </div>

            <div className="analysis-toolbar">
              <button
                disabled={positionIndex === 0}
                onClick={() => goToPosition(positionIndex - 1)}
              >
                Previous
              </button>

              <span>
                Position {positionIndex} / {positions.length - 1}
              </span>

              <button
                disabled={positionIndex >= positions.length - 1}
                onClick={() => goToPosition(positionIndex + 1)}
              >
                Next
              </button>
            </div>

            <p className="analysis-footnote">
              {variation.length
                ? `Preview: ${variation[variationIndex]?.san || "Starting position"}`
                : boardGame.isCheckmate()
                  ? "Checkmate"
                  : boardGame.isCheck()
                    ? "Check"
                    : boardGame.isDraw()
                      ? "Draw position"
                      : boardGame.turn() === "w"
                        ? "White to move"
                        : "Black to move"}
            </p>
          </div>

          {variation.length > 0 && (
            <section className="analysis-card variation-preview-card">
              <div className="variation-preview-heading">
                <h3>Variation Preview</h3>
                <button onClick={closeVariation}>Exit Preview</button>
              </div>

              <p className="variation-current-move">
                {variationIndex === 0
                  ? "Starting position"
                  : `${variationIndex}. ${variation[variationIndex]?.san || ""}`}
              </p>

              <div className="analysis-toolbar">
                <button
                  disabled={variationIndex <= 0}
                  onClick={() =>
                    setVariationIndex((value) => Math.max(0, value - 1))
                  }
                >
                  Previous
                </button>

                <span>
                  {variationIndex} / {variation.length - 1}
                </span>

                <button
                  disabled={variationIndex >= variation.length - 1}
                  onClick={() =>
                    setVariationIndex((value) =>
                      Math.min(variation.length - 1, value + 1)
                    )
                  }
                >
                  Next
                </button>
              </div>
            </section>
          )}

          <div className="analysis-card">
            <h3>Move record</h3>

            <div className="analysis-move-list">
              {positions.length > 1 ? (
                positions.slice(1).map((position, index) => {
                  const replay = new Chess();
                  replay.loadPgn(position.pgn);
                  const moves = replay.history();
                  const lastMove = moves[moves.length - 1];

                  return (
                    <button
                      type="button"
                      key={`${index}-${position.fen}`}
                      onClick={() => goToPosition(index + 1)}
                    >
                      {index % 2 === 0
                        ? `${Math.floor(index / 2) + 1}. `
                        : ""}
                      {lastMove}
                    </button>
                  );
                })
              ) : (
                <p>No moves yet. Make a move or import a PGN.</p>
              )}
            </div>

            <button
              onClick={() => {
                setPgnInput(positions[positionIndex]?.pgn || "");
                setShowPgn(true);
              }}
            >
              Show PGN
            </button>
          </div>
        </section>

        <aside className="analysis-sidebar">
          <section className="analysis-card">
            <h3>Candidate Lines</h3>

            <div className="candidate-list">
              {candidates.map((line, index) => (
                <div className="candidate-row" key={`${line.pv}-${index}`}>
                  <div className="candidate-details">
                    <strong>
                      #{index + 1} · {scoreText(line)}
                    </strong>
                    <p>{line.san || "Calculating line..."}</p>
                  </div>

                  <button
                    disabled={!line.pv}
                    onClick={() => startVariation(line)}
                  >
                    Preview
                  </button>
                </div>
              ))}

              {!candidates.length && (
                <p>
                  {thinking
                    ? "Calculating candidate lines..."
                    : "No candidate lines available."}
                </p>
              )}
            </div>

            {candidates.length > 1 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "#0e1713",
                  border: "1px solid #293a31",
                  borderRadius: 9,
                }}
              >
                <h3>Candidate Comparison</h3>

                <p>
                  <strong>Top line:</strong> {scoreText(topLine)}
                  {" · "}
                  <strong>Second line:</strong> {scoreText(secondLine)}
                </p>

                <p>{comparisonText}</p>

                <p className="analysis-footnote">
                  Scores use the side-to-move perspective. Small differences
                  can change with engine depth; similar scores do not guarantee
                  identical positions.
                </p>
              </div>
            )}
          </section>

          <section className="analysis-card explanation-card best-line-compact">
            <div className="best-line-compact-heading">
              <h3>Best Line</h3>
              <strong className="best-line-evaluation">
                {scoreText(topLine)}
              </strong>
            </div>

            <p className="best-line-moves">
              {topLine?.san || (thinking ? "Calculating…" : "No line available")}
            </p>

            <button
              className="best-line-preview-button"
              disabled={!topLine?.pv}
              onClick={() => startVariation(topLine)}
            >
              Preview Best Line
            </button>
          </section>

          <section className="analysis-card">
            <h3>Position Insight</h3>

            <p>
              {boardGame.isCheckmate()
                ? "The position is checkmate."
                : boardGame.isCheck()
                  ? "The side to move is in check. Calculate legal replies first."
                  : boardGame.isDraw()
                    ? "The current position is drawn under the chess rules."
                    : "Before choosing a move, examine checks, captures, threats and your opponent's best reply."}
            </p>

            <p className="analysis-footnote">
              Engine scores are estimates. Always inspect the actual variation.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
