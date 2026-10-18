
import VariationExplorer from "./VariationExplorer";
import PersonalTraining from "./PersonalTraining";
import CoachInsights from "./CoachInsights";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./GameReview.css";

const STORAGE_KEY = "qelvarisSavedGames";
const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";
const DEPTH = 10;

const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const S = {
  page: {
    color: "#e8eee9",
    padding: 20,
    fontFamily: "Inter,system-ui,sans-serif",
  },
  muted: { color: "#a3b4a9", fontSize: 13 },
  panel: {
    background: "#111c18",
    border: "1px solid #293a31",
    borderRadius: 14,
    padding: 16,
    minWidth: 0,
  },
  button: {
    background: "#1b3026",
    border: "1px solid #385343",
    color: "#e8eee9",
    padding: "9px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#0c1510",
    color: "#e8eee9",
    border: "1px solid #385343",
    borderRadius: 8,
    padding: 11,
  },
};

function classifyMove(loss) {
  if (loss <= 15) return { label: "Best", color: "#7bdba0" };
  if (loss <= 35) return { label: "Excellent", color: "#8bd7be" };
  if (loss <= 70) return { label: "Good", color: "#a9d5ff" };
  if (loss <= 120) return { label: "Inaccuracy", color: "#e9d77e" };
  if (loss <= 250) return { label: "Mistake", color: "#ffb36b" };
  return { label: "Blunder", color: "#ff7777" };
}

function readEvaluation(line, fen) {
  const mate = line.match(/\bscore mate (-?\d+)/);
  const cp = line.match(/\bscore cp (-?\d+)/);

  let score = null;

  if (mate) {
    const n = Number(mate[1]);
    score = n > 0 ? 10000 - n * 10 : -10000 - n * 10;
  } else if (cp) {
    score = Number(cp[1]);
  }

  if (score === null) return null;
  return fen.split(" ")[1] === "w" ? score : -score;
}

function getMoveFromUci(line) {
  const match = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
  return match ? match[1] : null;
}

function uciToSan(fen, uci) {
  if (!fen || !uci || uci.length < 4) return uci || "Unavailable";

  try {
    const game = new Chess(fen);
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q",
    });
    return move?.san || uci;
  } catch {
    return uci;
  }
}

function formatEval(score) {
  if (score === null || score === undefined) return "—";

  if (Math.abs(score) >= 9900) {
    const moves = Math.max(1, Math.round((10000 - Math.abs(score)) / 10));
    return `${score > 0 ? "White" : "Black"} mate in ${moves}`;
  }

  const pawns = score / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(1)}`;
}

function makePosition(pgn, ply) {
  const loaded = new Chess();
  loaded.loadPgn(pgn);

  const history = loaded.history();
  const position = new Chess();

  for (let i = 0; i < Math.min(ply, history.length); i++) {
    position.move(history[i]);
  }

  return position;
}

function getAccuracy(loss) {
  return 100 * Math.exp(-Math.max(0, loss) / 300);
}

export default function GameReview() {
  const [savedGames, setSavedGames] = useState([]);
  const [pgnText, setPgnText] = useState("");
  const [reviewPgn, setReviewPgn] = useState("");
  const [reviewLabel, setReviewLabel] = useState("");
  const [moves, setMoves] = useState([]);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engineStatus, setEngineStatus] = useState("Starting Stockfish...");
  const [criticalOnly, setCriticalOnly] = useState(false);

  const workerRef = useRef(null);
  const readyRef = useRef(false);
  const jobRef = useRef(null);
  const aliveRef = useRef(true);

  const refreshSavedGames = useCallback(() => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setSavedGames(Array.isArray(data) ? data : []);
    } catch {
      setSavedGames([]);
    }
  }, []);

  function stopAnalysis(silent = false) {
    workerRef.current?.postMessage("stop");
    jobRef.current = null;
    setRunning(false);

    if (!silent) {
      setEngineStatus("Analysis stopped");
      setMessage("Analysis stopped. You can start it again.");
    }
  }

  function startPositionAnalysis(job) {
    const move = job.history[job.index];
    if (!move || !workerRef.current) return;

    job.move = move;
    job.preFen = move.before;
    job.postFen = move.after;
    job.phase = "before";
    job.currentFen = move.before;
    job.currentScore = null;
    job.currentDepth = 0;
    job.bestMove = null;
    job.beforeScore = null;

    workerRef.current.postMessage("stop");
    workerRef.current.postMessage("position fen " + job.preFen);
    workerRef.current.postMessage("go depth " + DEPTH);
  }

  useEffect(() => {
    aliveRef.current = true;
    refreshSavedGames();

    let worker;

    try {
      worker = new Worker(ENGINE_URL);
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const line = String(event.data || "");
        const job = jobRef.current;

        if (line === "uciok") {
          worker.postMessage("isready");
          return;
        }

        if (line === "readyok") {
          readyRef.current = true;
          if (aliveRef.current) setEngineStatus("Stockfish ready");
          return;
        }

        if (!job || !aliveRef.current) return;

        if (line.startsWith("info ")) {
          const depthMatch = line.match(/\bdepth (\d+)/);
          const score = readEvaluation(line, job.currentFen);

          if (depthMatch) {
            const depth = Number(depthMatch[1]);

            if (depth >= (job.currentDepth || 0)) {
              job.currentDepth = depth;
              if (score !== null) job.currentScore = score;
            }
          } else if (score !== null && !job.currentScore) {
            job.currentScore = score;
          }

          return;
        }

        if (!line.startsWith("bestmove")) return;

        if (job.phase === "before") {
          job.bestMove = getMoveFromUci(line);
          job.beforeScore = job.currentScore;

          job.phase = "after";
          job.currentFen = job.postFen;
          job.currentScore = null;
          job.currentDepth = 0;

          worker.postMessage("position fen " + job.postFen);
          worker.postMessage("go depth " + DEPTH);
          return;
        }

        const afterScore = job.currentScore;
        const beforeScore = job.beforeScore;
        const mover = job.move.color;

        let loss = 0;

        if (beforeScore !== null && afterScore !== null) {
          const sign = mover === "w" ? 1 : -1;
          loss = Math.max(0, Math.round(sign * (beforeScore - afterScore)));
        }

        const result = {
          ply: job.index + 1,
          san: job.move.san,
          color: mover,
          from: job.move.from,
          to: job.move.to,
          fenBefore: job.preFen,
          fenAfter: job.postFen,
          bestMove: job.bestMove,
          bestMoveSan: uciToSan(job.preFen, job.bestMove),
          beforeScore,
          afterScore,
          loss,
          category: classifyMove(loss),
        };

        job.results.push(result);
        job.index += 1;

        setAnalysis([...job.results]);
        setProgress(Math.round((job.index / job.history.length) * 100));

        if (job.index >= job.history.length) {
          jobRef.current = null;
          setRunning(false);
          setProgress(100);
          setEngineStatus("Analysis complete");
          setMessage("Analysis complete. Review critical moments and compare suggested moves.");
          return;
        }

        startPositionAnalysis(job);
      };

      worker.onerror = (error) => {
        console.error("Stockfish error:", error);
        jobRef.current = null;
        setRunning(false);
        setEngineStatus("Engine error");
        setMessage("Stockfish error. Check the engine file and refresh.");
      };

      worker.postMessage("uci");
    } catch (error) {
      console.error("Could not start Stockfish:", error);
      setEngineStatus("Engine failed to start");
      setMessage("Stockfish start nahi hua. Engine file ka path check karo.");
    }

    return () => {
      aliveRef.current = false;
      readyRef.current = false;
      jobRef.current = null;
      workerRef.current = null;

      if (worker) {
        worker.postMessage("stop");
        worker.terminate();
      }
    };
  }, [refreshSavedGames]);

  function openPgn(pgn, label = "Imported PGN") {
    stopAnalysis(true);

    try {
      const parsed = new Chess();
      parsed.loadPgn(pgn);
      const verboseHistory = parsed.history({ verbose: true });

      if (!verboseHistory.length) {
        setMessage("Is PGN mein koi moves nahi mile.");
        return;
      }

      setReviewPgn(pgn);
      setReviewLabel(label);
      setMoves(verboseHistory);
      setPly(0);
      setFlipped(false);
      setAnalysis([]);
      setProgress(0);
      setCriticalOnly(false);
      setMessage("Game loaded. Start Automatic Analysis.");
      setPgnText(pgn);
    } catch (error) {
      console.error("PGN error:", error);
      setMessage("PGN invalid hai. Standard PGN format try karo.");
    }
  }

  function loadSavedGame(saved) {
    if (!saved?.pgn) {
      setMessage("Is saved game mein PGN available nahi hai.");
      return;
    }

    openPgn(
      saved.pgn,
      saved.date ? new Date(saved.date).toLocaleString() : "Saved game"
    );
  }

  function startAnalysis() {
    if (!reviewPgn || !moves.length) {
      setMessage("Pehle ek saved game ya PGN load karo.");
      return;
    }

    if (!readyRef.current || !workerRef.current) {
      setMessage("Stockfish abhi ready nahi hai. Thoda wait karke try karo.");
      return;
    }

    try {
      const parsed = new Chess();
      parsed.loadPgn(reviewPgn);
      const history = parsed.history({ verbose: true });

      if (!history.length) {
        setMessage("Analysis ke liye game mein moves hone chahiye.");
        return;
      }

      setAnalysis([]);
      setProgress(0);
      setRunning(true);
      setMessage(`Analysing ${history.length} half-moves at depth ${DEPTH}...`);
      setEngineStatus("Analysing moves...");

      const job = {
        history,
        index: 0,
        results: [],
        phase: "before",
      };

      jobRef.current = job;
      startPositionAnalysis(job);
    } catch (error) {
      console.error(error);
      setRunning(false);
      setMessage("Game analyse nahi ho paayi.");
    }
  }

  const currentPosition = (() => {
    if (!reviewPgn) return new Chess();

    try {
      return makePosition(reviewPgn, ply);
    } catch {
      return new Chess();
    }
  })();

  const board = currentPosition.board();
  const boardRows = flipped
    ? [...board].reverse().map((row) => [...row].reverse())
    : board;

  const reportForPly = analysis.find((item) => item.ply === ply);

  const blunders = analysis.filter((item) => item.category.label === "Blunder").length;
  const mistakes = analysis.filter((item) => item.category.label === "Mistake").length;
  const inaccuracies = analysis.filter((item) => item.category.label === "Inaccuracy").length;

  const averageLoss = analysis.length
    ? Math.round(analysis.reduce((sum, item) => sum + item.loss, 0) / analysis.length)
    : 0;

  function calculateAccuracy(color) {
    const playerMoves = analysis.filter((item) => item.color === color);
    if (!playerMoves.length) return null;

    const total = playerMoves.reduce((sum, item) => sum + getAccuracy(item.loss), 0);
    return Math.round(total / playerMoves.length);
  }

  const whiteAccuracy = calculateAccuracy("w");
  const blackAccuracy = calculateAccuracy("b");

  const graphPoints = analysis.reduce(
    (points, item) => {
      points.push({
        ply: item.ply,
        score: item.afterScore ?? points[points.length - 1].score,
        san: item.san,
      });
      return points;
    },
    [{ ply: 0, score: 0, san: "Start" }]
  );

  const graphWidth = Math.max(600, graphPoints.length * 12);

  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1] || null,
    });
  }

  const criticalMoves = [...analysis]
    .filter((item) => item.loss >= 70)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 8);

  function jumpTo(plyNumber) {
    const nextPly = Math.max(0, Math.min(moves.length, plyNumber));
    setPly(nextPly);
  }

  function removeSavedGame(id) {
    try {
      const next = savedGames.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedGames(next);
      setMessage("Saved game deleted.");
    } catch {
      setMessage("Saved game delete nahi hui.");
    }
  }

  function exportReport() {
    if (!analysis.length) {
      setMessage("Pehle game analyse karo.");
      return;
    }

    const lines = [
      "Qelvaris Chess - Game Review",
      `Game: ${reviewLabel || "Imported game"}`,
      `Analysis depth: ${DEPTH}`,
      `White accuracy (approx): ${whiteAccuracy ?? "N/A"}%`,
      `Black accuracy (approx): ${blackAccuracy ?? "N/A"}%`,
      "",
      "Move,Player,Played Move,Engine Suggestion,Classification,Estimated Loss (cp),Eval Before,Eval After",
      ...analysis.map((item) =>
        [
          item.ply,
          item.color === "w" ? "White" : "Black",
          item.san,
          item.bestMoveSan,
          item.category.label,
          item.loss,
          formatEval(item.beforeScore),
          formatEval(item.afterScore),
        ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "qelvaris-game-review.csv";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Review report exported as CSV.");
  }

  return (
    <div className="review-page" style={S.page}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>Game Review</h1>
        <div style={S.muted}>
          Review every move, compare engine suggestions and identify critical moments.
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))",
          gap: 16,
        }}
      >
        <section style={S.panel}>
          <h3 style={{ marginTop: 0 }}>Import PGN</h3>
          <textarea
            value={pgnText}
            onChange={(event) => setPgnText(event.target.value)}
            placeholder={"Paste a PGN game here:\n1. e4 e5 2. Nf3 Nc6 *"}
            rows={5}
            style={{ ...S.input, resize: "vertical", fontFamily: "monospace" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button style={S.button} onClick={() => openPgn(pgnText)}>
              Load PGN
            </button>

            <label style={{ ...S.button, display: "inline-flex", alignItems: "center" }}>
              Choose .pgn file
              <input
                type="file"
                accept=".pgn,.txt,text/plain"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;

                  const reader = new FileReader();
                  reader.onload = () => {
                    const text = String(reader.result || "");
                    setPgnText(text);
                    openPgn(text, file.name);
                  };
                  reader.onerror = () => setMessage("File read nahi ho paayi.");
                  reader.readAsText(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </section>

        <section style={S.panel}>
          <h3 style={{ marginTop: 0 }}>Saved Games</h3>
          <div style={{ ...S.muted, marginBottom: 10 }}>
            {savedGames.length} game(s) stored in this browser
          </div>

          <div style={{ display: "grid", gap: 8, maxHeight: 200, overflowY: "auto" }}>
            {savedGames.map((saved) => (
              <div
                key={saved.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  background: "#182720",
                  borderRadius: 8,
                  padding: 9,
                }}
              >
                <button
                  style={{ ...S.button, flex: 1, textAlign: "left", minWidth: 0 }}
                  onClick={() => loadSavedGame(saved)}
                >
                  <div>{saved.source || "Saved game"}</div>
                  <div style={S.muted}>
                    {saved.date ? new Date(saved.date).toLocaleString() : "Date unavailable"}
                    {" · "}{saved.moves || "?"} plies
                  </div>
                </button>

                <button
                  style={S.button}
                  title="Delete game"
                  onClick={() => removeSavedGame(saved.id)}
                >
                  ×
                </button>
              </div>
            ))}

            {savedGames.length === 0 && (
              <div style={S.muted}>
                No saved games yet. Save a game from Play Chess first.
              </div>
            )}
          </div>

          <button style={{ ...S.button, marginTop: 10 }} onClick={refreshSavedGames}>
            ↻ Refresh list
          </button>
        </section>
      </div>

      {message && (
        <div
          role="status"
          style={{
            background: "#193426",
            border: "1px solid #315940",
            borderRadius: 9,
            padding: 12,
            marginTop: 16,
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      {reviewPgn && (
        <>
          <section style={{ ...S.panel, marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 5px", fontSize: 20 }}>
                  {reviewLabel || "Current game"}
                </h2>
                <div style={S.muted}>
                  {moves.length} half-moves · {engineStatus} · Depth {DEPTH}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!running ? (
                  <button
                    style={{ ...S.button, background: "#176b48" }}
                    onClick={startAnalysis}
                  >
                    {analysis.length ? "↻ Analyse again" : "▶ Automatic Analysis"}
                  </button>
                ) : (
                  <button style={S.button} onClick={() => stopAnalysis()}>
                    Stop Analysis
                  </button>
                )}

                <button style={S.button} onClick={exportReport} disabled={!analysis.length}>
                  Export CSV
                </button>
              </div>
            </div>

            {(running || analysis.length > 0) && (
              <div style={{ marginTop: 15 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    ...S.muted,
                    marginBottom: 6,
                  }}
                >
                  <span>{running ? "Analysing each move..." : "Analysis progress"}</span>
                  <span>{progress}%</span>
                </div>

                <div style={{ height: 7, background: "#26382e", borderRadius: 20, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "#51c58b",
                      transition: "width .2s",
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {analysis.length > 0 && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                {[
                  ["Moves analysed", analysis.length],
                  ["White accuracy*", whiteAccuracy === null ? "—" : `${whiteAccuracy}%`],
                  ["Black accuracy*", blackAccuracy === null ? "—" : `${blackAccuracy}%`],
                  ["Blunders", blunders],
                  ["Mistakes", mistakes],
                  ["Inaccuracies", inaccuracies],
                  ["Average loss", `${averageLoss} cp`],
                ].map(([label, value]) => (
                  <div key={label} style={S.panel}>
                    <div style={S.muted}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 750, marginTop: 5 }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <section style={{ ...S.panel, marginTop: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 5px" }}>Evaluation Graph</h3>
                    <div style={S.muted}>Select a bar to jump to that position.</div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                    <span style={{ color: "#7bdba0" }}>■ White advantage</span>
                    <span style={{ color: "#ff7777" }}>■ Black advantage</span>
                  </div>
                </div>

                <div style={{ overflowX: "auto", marginTop: 16, paddingBottom: 8 }}>
                  <div
                    style={{
                      position: "relative",
                      width: graphWidth,
                      height: 206,
                      background: "#0c1510",
                      border: "1px solid #293a31",
                      borderRadius: 8,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ position: "absolute", left: 0, right: 0, top: 96, borderTop: "1px dashed #728579" }} />
                    <div style={{ position: "absolute", top: 5, left: 8, fontSize: 11, color: "#7bdba0" }}>White +</div>
                    <div style={{ position: "absolute", bottom: 5, left: 8, fontSize: 11, color: "#ff7777" }}>Black +</div>

                    {graphPoints.map((point, index) => {
                      const score = Math.max(-500, Math.min(500, point.score));
                      const height = Math.max(4, (Math.abs(score) / 500) * 78);
                      const positive = score >= 0;
                      const active = ply === point.ply;

                      return (
                        <button
                          key={point.ply}
                          title={`Position ${point.ply} · ${point.san} · ${formatEval(point.score)}`}
                          aria-label={`Go to position ${point.ply}`}
                          onClick={() => jumpTo(point.ply)}
                          style={{
                            position: "absolute",
                            left: index * 12,
                            top: positive ? 96 - height : 96,
                            width: 8,
                            height,
                            minWidth: 0,
                            padding: 0,
                            borderRadius: 3,
                            border: active ? "2px solid white" : "1px solid transparent",
                            background: point.score === 0 ? "#a3b4a9" : positive ? "#51c58b" : "#ff7777",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 8, ...S.muted }}>
                  <span>Position: {ply} / {moves.length}</span>
                  <span>
                    Evaluation: {ply === 0 ? "Starting position (not separately evaluated)" : formatEval(graphPoints[ply]?.score ?? null)}
                  </span>
                </div>

                <p style={{ ...S.muted, lineHeight: 1.5, marginBottom: 0 }}>
                  Evaluations are approximate Stockfish results from White's perspective.
                  Positive values favour White; negative values favour Black. Mate scores are capped visually.
                </p>
              </section>

              <section style={{ ...S.panel, marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: "0 0 5px" }}>Critical Moments</h3>
                    <div style={S.muted}>Moves with estimated loss of 0.7 pawns or more.</div>
                  </div>
                  <button style={S.button} onClick={() => setCriticalOnly((value) => !value)}>
                    {criticalOnly ? "Show all moves" : "Show critical moves"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  {(criticalOnly ? criticalMoves : analysis.filter((item) => item.loss >= 70).slice(0, 8)).map((item) => (
                    <button
                      key={item.ply}
                      onClick={() => jumpTo(item.ply)}
                      style={{
                        ...S.button,
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        Move {item.ply} · {item.color === "w" ? "White" : "Black"} · {item.san}
                        <span style={{ color: item.category.color, marginLeft: 8 }}>
                          {item.category.label}
                        </span>
                      </span>
                      <span>
                        Best: {item.bestMoveSan} · Loss: {item.loss} cp
                      </span>
                    </button>
                  ))}

                  {criticalMoves.length === 0 && (
                    <div style={S.muted}>
                      {analysis.length ? "No moves crossed the current critical-moment threshold." : "Critical moments will appear after analysis."}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
              gap: 18,
              marginTop: 18,
              alignItems: "start",
            }}
          >
            <section style={S.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px" }}>Review Board</h3>
                  <div style={S.muted}>Position after {ply} half-move(s)</div>
                </div>
                <button style={S.button} onClick={() => setFlipped((value) => !value)}>⇅ Flip</button>
              </div>

              {/* FIXED BOARD: exactly 8 equal columns and 8 equal rows */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(8, minmax(0, 1fr))",
                  width: "100%",
                  maxWidth: 560,
                  aspectRatio: "1 / 1",
                  margin: "0 auto",
                  overflow: "hidden",
                  border: "4px solid #293a31",
                  borderRadius: 5,
                  boxSizing: "border-box",
                }}
              >
                {boardRows.flatMap((row, r) =>
                  row.map((piece, c) => {
                    const realR = flipped ? 7 - r : r;
                    const realC = flipped ? 7 - c : c;
                    const light = (realR + realC) % 2 === 0;
                    const square = String.fromCharCode(97 + realC) + (8 - realR);
                    const isFrom = reportForPly?.from === square;
                    const isTo = reportForPly?.to === square;

                    return (
                      <button
                        key={`${r}-${c}`}
                        title={square}
                        style={{
                          position: "relative",
                          border: 0,
                          borderRadius: 0,
                          margin: 0,
                          padding: 0,
                          width: "100%",
                          height: "100%",
                          minWidth: 0,
                          minHeight: 0,
                          aspectRatio: "1 / 1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          background: isFrom || isTo
                            ? "#b9c66a"
                            : light
                              ? "#e4e8d5"
                              : "#58816a",
                          fontSize: "clamp(20px, 4vw, 48px)",
                          lineHeight: 1,
                          color: piece?.color === "w" ? "#fffdf4" : "#17221b",
                          textShadow: piece?.color === "w"
                            ? "0 1px 3px #25392d"
                            : "none",
                        }}
                      >
                        {piece ? PIECES[piece.color][piece.type] : ""}

                        {c === 0 && (
                          <span
                            style={{
                              position: "absolute",
                              top: 1,
                              left: 3,
                              fontSize: 9,
                              color: light ? "#58816a" : "#e4e8d5",
                              pointerEvents: "none",
                            }}
                          >
                            {8 - realR}
                          </span>
                        )}

                        {r === 7 && (
                          <span
                            style={{
                              position: "absolute",
                              right: 3,
                              bottom: 1,
                              fontSize: 9,
                              color: light ? "#58816a" : "#e4e8d5",
                              pointerEvents: "none",
                            }}
                          >
                            {String.fromCharCode(97 + realC)}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
                <button style={S.button} onClick={() => jumpTo(0)}>⏮ Start</button>
                <button style={S.button} onClick={() => jumpTo(ply - 1)} disabled={ply === 0}>← Previous</button>
                <button style={S.button} onClick={() => jumpTo(ply + 1)} disabled={ply >= moves.length}>Next →</button>
                <button style={S.button} onClick={() => jumpTo(moves.length)}>⏭ End</button>
              </div>
            </section>

            <section style={S.panel}>
              <h3 style={{ marginTop: 0 }}>Move-by-Move Report</h3>
              <div style={{ ...S.muted, marginBottom: 10 }}>Select a move to inspect its engine report.</div>

              <div style={{ maxHeight: 430, overflowY: "auto", display: "grid", gap: 6 }}>
                {movePairs.map((pair) => (
                  <div key={pair.number} style={{ display: "grid", gridTemplateColumns: "30px 1fr 1fr", gap: 6, alignItems: "stretch" }}>
                    <span style={{ ...S.muted, paddingTop: 10 }}>{pair.number}.</span>

                    {[pair.white, pair.black].map((move, index) => {
                      if (!move) return <div key={index} />;

                      const movePly = pair.number * 2 - (index === 0 ? 1 : 0);
                      const report = analysis.find((item) => item.ply === movePly);
                      const active = ply === movePly;

                      return (
                        <button
                          key={index}
                          onClick={() => jumpTo(movePly)}
                          style={{
                            ...S.button,
                            textAlign: "left",
                            padding: 8,
                            background: active ? "#315b41" : "#182720",
                            borderColor: active ? "#69bb87" : "#293a31",
                          }}
                        >
                          <div style={{ fontWeight: 650 }}>{move.san}</div>
                          {report && (
                            <div style={{ color: report.category.color, fontSize: 11, marginTop: 3 }}>
                              {report.category.label} · {report.loss} cp
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section style={{ ...S.panel, marginTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Selected Move Analysis</h3>

            {!reportForPly ? (
              <div style={S.muted}>
                {ply === 0
                  ? "Starting position selected. Move to a played position to inspect its report."
                  : "Run Automatic Analysis to see the engine classification for this move."}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
                  <div>
                    <div style={S.muted}>Played move</div>
                    <div style={{ fontSize: 22, fontWeight: 750 }}>{reportForPly.san}</div>
                  </div>
                  <div>
                    <div style={S.muted}>Classification</div>
                    <div style={{ color: reportForPly.category.color, fontSize: 20, fontWeight: 750 }}>
                      {reportForPly.category.label}
                    </div>
                  </div>
                  <div>
                    <div style={S.muted}>Estimated loss</div>
                    <div style={{ fontSize: 20, fontWeight: 750 }}>{reportForPly.loss} cp</div>
                  </div>
                  <div>
                    <div style={S.muted}>Engine best move</div>
                    <div style={{ fontSize: 20, fontWeight: 750 }}>{reportForPly.bestMoveSan}</div>
                  </div>
                </div>

                <div style={{ marginTop: 16, padding: 12, background: "#182720", borderRadius: 9, lineHeight: 1.7 }}>
                  <div>
                    <strong>Position before:</strong> {formatEval(reportForPly.beforeScore)}
                    {" · "}
                    <strong>Position after:</strong> {formatEval(reportForPly.afterScore)}
                  </div>
                  <div style={S.muted}>
                    {reportForPly.bestMoveSan !== reportForPly.san
                      ? `The engine preferred ${reportForPly.bestMoveSan} in the position before this move. Compare the alternatives on a chessboard before drawing conclusions.`
                      : "The engine's top move matches the played move in this analysis."}
                  </div>
                </div>
              </>
            )}

            <p style={{ ...S.muted, lineHeight: 1.6, marginBottom: 0, marginTop: 14 }}>
              *Accuracy is a Qelvaris estimate based on centipawn loss, not official Chess.com accuracy.
              Move classifications are also estimates: engine depth, time and hardware can change evaluations.
            </p>

            <div style={{ marginTop: 18 }}>
              <CoachInsights report={reportForPly} />
            </div>

            <VariationExplorer report={reportForPly} />

            <PersonalTraining
              analysis={analysis}
              reviewPgn={reviewPgn}
              reviewLabel={reviewLabel}
            />
          </section>
        </>
      )}
    </div>
  );
}
