import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import PageLoader, { usePageLoaderDelay } from "./PageLoader";
import ExplorePanel from "./ExplorePanel";
import { dbAll, dbPut } from "./storage";
import { afterMiss, afterSolve, isDue, leakInfo, promptFor } from "./lab";
import { useExplore } from "./useExplore";
import {
  DAILY_GOAL, dayStreak, dueIds, loadState, prettyTheme,
  recordAttempt, setBest, themeStats, todayCount,
} from "./puzzleStore";
import "./PracticePuzzles.css";
import "./PracticeExtras.css";
import "./ExploreForPractice.css";
import "./PracticeLayout.css"; // naya layout + teal theme (sabse last)

// Build the puzzle's starting position from the supplied PGN.
function createPosition(game, initialPly, firstSolutionMove) {
  const chess = new Chess();

  chess.loadPgn(game.pgn);

  const headers = chess.header();
  const startingFen = headers.FEN || new Chess().fen();
  const moves = chess.history({ verbose: true });

  const offsets = [0, 1, -1];

  for (const offset of offsets) {
    const targetPly = initialPly + offset;

    if (targetPly < 0 || targetPly > moves.length) continue;

    try {
      const position = new Chess(startingFen);

      moves.slice(0, targetPly).forEach((move) => {
        position.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });
      });

      const firstMove = position.moves({ verbose: true }).find(
        (move) => moveToUci(move) === firstSolutionMove
      );

      if (firstMove) return position;
    } catch (error) {
      console.warn("Ply position check failed:", offset, error);
    }
  }

  throw new Error(
    `Could not align puzzle position with first solution move: ${firstSolutionMove}`
  );
}

// Convert a chess move into UCI notation.
function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ""}`;
}

// Apply a UCI move to a Chess instance.
function applyUci(chess, uci) {
  if (!uci || uci.length < 4) {
    throw new Error("Invalid puzzle move.");
  }

  const move = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci[4] ? { promotion: uci[4] } : {}),
  });

  if (!move) {
    throw new Error(`Could not apply move: ${uci}`);
  }

  return move;
}

// Reconstruct a position for solution review.
function getSolutionPosition(startFen, solution, ply) {
  const chess = new Chess(startFen);

  for (let i = 0; i < ply; i += 1) {
    applyUci(chess, solution[i]);
  }

  return chess.fen();
}

const PROMOTION_PIECES = [
  { value: "q", label: "Queen", symbol: "♛" },
  { value: "r", label: "Rook", symbol: "♜" },
  { value: "b", label: "Bishop", symbol: "♝" },
  { value: "n", label: "Knight", symbol: "♞" },
];

/* Practice page pehli baar khulne par loader kam se kam itni der (ms) dikhega.
   Ye sirf pehle puzzle ke liye hai. "Next puzzle" par chhota board wala spinner hi chalega. */
const MIN_LOADER_MS = 0;

/* ---------- NAYA: puzzle sources, rating, Rush ---------- */
const THEMES = [
  "fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "hangingPiece", "trappedPiece",
  "attraction", "deflection", "interference", "sacrifice", "quietMove", "mateIn1", "mateIn2",
  "mateIn3", "backRankMate", "smotheredMate", "advancedPawn", "promotion", "endgame",
];
const ARCADE = {
  rush: { label: "Rush", seconds: 180, strikes: 3, blurb: "3 minutes, 3 strikes" },
  streak: { label: "Streak", seconds: 0, strikes: 1, blurb: "One mistake ends it" },
};
const MODES = [["foryou", "For You"], ["own", "My Games"], ["themes", "Themes"], ["arcade", "Rush"]];

/* Login/membership aane par yaha check lagao. Abhi sab free hai. */
// eslint-disable-next-line no-unused-vars
const canUse = (feature) => true;

/* Lichess anonymous puzzles ki difficulty 1500 rating ke hisaab se hoti hai, isliye rating ko paas wali difficulty me badalte hain (approx). */
function difficultyFor(rating) {
  const off = rating - 1500;
  if (off <= -450) return "easiest";
  if (off <= -150) return "easier";
  if (off < 150) return "normal";
  if (off < 450) return "harder";
  return "hardest";
}

const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.ceil((ms % 60000) / 1000) % 60).padStart(2, "0")}`;

export default function PracticePuzzles() {
  const minDone = usePageLoaderDelay(MIN_LOADER_MS);
  const [everLoaded, setEverLoaded] = useState(false);
  const [wrongMove, setWrongMove] = useState(false);

  const [fen, setFen] = useState("");
  const [initialFen, setInitialFen] = useState("");

  const [puzzle, setPuzzle] = useState(null);
  const [solution, setSolution] = useState([]);
  const [step, setStep] = useState(0);

  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  const [message, setMessage] = useState("Loading puzzle...");
  const [status, setStatus] = useState("loading");

  const [hint, setHint] = useState(false);

  const [solutionMode, setSolutionMode] = useState(false);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [previewFen, setPreviewFen] = useState("");

  const [solved, setSolved] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [streak, setStreak] = useState(0);

  // Promotion selection state.
  const [pendingPromotion, setPendingPromotion] = useState(null);

  const wrongMoveTimer = useRef(null);

  // NAYA: mode, rating, review, Rush, Explore
  const [source, setSource] = useState("foryou"); // foryou | themes | weak | review | arcade
  const [variant, setVariant] = useState("rush");
  const [theme, setTheme] = useState(THEMES[0]);
  const [snap, setSnap] = useState(loadState);
  const [result, setResult] = useState(null);
  const [exploring, setExploring] = useState(false);
  const [run, setRun] = useState({ state: "idle", score: 0, strikes: 0, endsAt: 0, left: 0, record: false });
  const runRef = useRef(run);
  const reportedRef = useRef(false);
  const hintsRef = useRef(0);
  const startRef = useRef(Date.now());
  const ownItemRef = useRef(null); // My Games: Leak Lab ki wo position jo abhi khul rahi hai

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  function clearWrongMoveTimer() {
    if (wrongMoveTimer.current) {
      clearTimeout(wrongMoveTimer.current);
      wrongMoveTimer.current = null;
    }
  }

  function clearSelection() {
    setSelected(null);
    setTargets([]);
  }

  /* Source ke hisaab se Lichess ka URL banao */
  function pickTarget(src, th, score) {
    const state = loadState();
    const base = "https://lichess.org/api/puzzle/";

    if (src === "review") {
      const ids = dueIds(state);
      if (!ids.length) throw new Error("Nothing is due for review right now. Come back later.");
      return base + ids[Math.floor(Math.random() * ids.length)];
    }

    const params = new URLSearchParams();
    let target = state.rating;

    if (src === "themes") {
      params.set("angle", th);
    } else if (src === "weak") {
      const weakest = themeStats(state).slice(0, 3);
      if (!weakest.length) throw new Error("Not enough attempts yet to find your weak themes.");
      params.set("angle", weakest[Math.floor(Math.random() * weakest.length)].theme);
    } else if (src === "arcade") {
      target = 700 + score * 70; // Rush me puzzles dheere dheere mushkil hote hain
    }

    params.set("difficulty", difficultyFor(target));
    return `${base}next?${params}`;
  }

  /* My Games: Leak Lab ki apni galtiyon me se agli position. Due wali pehle, sabse mehengi galti pehle. */
  async function pickOwn() {
    const items = await dbAll("training");
    const due = items
      .filter((it) => isDue(it))
      .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0) || (b.winLoss || 0) - (a.winLoss || 0));
    const pool = due.length ? due : items; // kuch due na ho to bhi practise ho sakti hai
    if (!pool.length) {
      throw new Error("No positions from your games yet. Review a game first and Leak Lab will collect your mistakes.");
    }
    return pool[Math.floor(Math.random() * Math.min(pool.length, 10))];
  }

  async function loadPuzzle(src = source, th = theme, score = runRef.current.score) {
    reportedRef.current = false;
    hintsRef.current = 0;
    setResult(null);
    setExploring(false);
    clearWrongMoveTimer();
    setWrongMove(false);
    setPendingPromotion(null);

    setStatus("loading");
    setMessage("Finding your next challenge...");

    clearSelection();

    setFen("");
    setInitialFen("");
    setPuzzle(null);
    setSolution([]);
    setStep(0);
    setLastMove(null);

    setHint(false);
    setSolutionMode(false);
    setSolutionIndex(0);
    setPreviewFen("");

    try {
      if (src === "own") {
        const item = await pickOwn();
        const leak = item.leak || "other";
        const side = item.fen.split(" ")[1] === "w" ? "White" : "Black";
        ownItemRef.current = item;
        setPuzzle({ id: item.id, rating: 0, themes: [leak], solution: [item.best], own: true, leakTitle: leakInfo(leak).title });
        setFen(item.fen);
        setInitialFen(item.fen);
        setSolution([item.best]);
        setStatus("playing");
        setMessage(promptFor(leak, side));
        startRef.current = Date.now();
        setEverLoaded(true);
        return;
      }

      const response = await fetch(
        pickTarget(src, th, score),
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Puzzle service is busy. Please try again shortly."
            : "Could not load the puzzle. Please try again."
        );
      }

      const data = await response.json();

      if (!data?.game?.pgn || !data?.puzzle?.solution?.length) {
        throw new Error("The puzzle data is incomplete. Try another puzzle.");
      }

      const position = createPosition(
        data.game,
        data.puzzle.initialPly,
        data.puzzle.solution[0]
      );

      const startingFen = position.fen();

      setPuzzle(data.puzzle);
      setFen(startingFen);
      setInitialFen(startingFen);
      setSolution(data.puzzle.solution);

      setStatus("playing");
      setMessage("Find the best move.");
      startRef.current = Date.now();
      setEverLoaded(true);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Something went wrong.");
      setEverLoaded(true);
    }
  }

  useEffect(() => {
    loadPuzzle();

    return () => {
      clearWrongMoveTimer();
    };
  }, []);

  function retryPuzzle() {
    if (!initialFen) return;

    clearWrongMoveTimer();
    setWrongMove(false);
    setPendingPromotion(null);

    setFen(initialFen);
    setStep(0);
    setLastMove(null);

    setHint(false);
    setSolutionMode(false);
    setSolutionIndex(0);
    setPreviewFen("");

    clearSelection();

    setStatus("playing");
    setMessage("Try again. Find the correct continuation.");
  }

  function showHint() {
    if (
      status !== "playing" ||
      !fen ||
      solutionMode ||
      wrongMove ||
      pendingPromotion
    ) return;

    const expectedMove = solution[step];

    if (!expectedMove) {
      setMessage("No further hint is available.");
      return;
    }

    setSelected(expectedMove.slice(0, 2));
    setTargets([expectedMove.slice(2, 4)]);

    hintsRef.current = 1;
    setHint(true);
    setMessage("Hint: Check the highlighted piece and destination.");
  }

  function showSolution() {
    if (!initialFen || !solution.length || wrongMove) return;

    report(false); // solution dekhna = puzzle miss

    clearWrongMoveTimer();
    setWrongMove(false);
    setPendingPromotion(null);

    setSolutionMode(true);
    setHint(false);

    setSolutionIndex(0);
    setPreviewFen(initialFen);

    clearSelection();

    setStatus("revealed");
    setMessage("Explore the complete solution using the arrows.");
  }

  function navigateSolution(direction) {
    const nextIndex = Math.max(
      0,
      Math.min(solution.length, solutionIndex + direction)
    );

    try {
      const nextFen = getSolutionPosition(
        initialFen,
        solution,
        nextIndex
      );

      setSolutionIndex(nextIndex);
      setPreviewFen(nextFen);
    } catch (error) {
      console.error("Solution navigation error:", error);

      setMessage(
        `Solution error: ${error.message || "Unknown error"}`
      );
    }
  }

  // Execute a legal move after promotion has been selected if needed.
  function executeLegalMove(legalMove) {
    const originalFen = fen;
    const originalLastMove = lastMove;

    const attemptedUci = moveToUci(legalMove);
    const expectedUci = solution[step];

    try {
      const chess = new Chess(originalFen);

      const playedMove = chess.move({
        from: legalMove.from,
        to: legalMove.to,
        ...(legalMove.promotion
          ? { promotion: legalMove.promotion }
          : {}),
      });

      if (!playedMove) {
        throw new Error("This move could not be played.");
      }

      const movedFen = chess.fen();

      const attemptedLastMove = {
        from: playedMove.from,
        to: playedMove.to,
      };

      setFen(movedFen);
      setLastMove(attemptedLastMove);

      clearSelection();
      setHint(false);
      setPendingPromotion(null);

      // Check the selected move against the puzzle solution.
      if (attemptedUci !== expectedUci) {
        setWrong((value) => value + 1);
        setStreak(0);
        setWrongMove(true);
        report(false); // pehli galti par hi result save hota hai
        setMessage("Not quite right! Your move will return.");

        clearWrongMoveTimer();

        wrongMoveTimer.current = setTimeout(() => {
          setFen(originalFen);
          setLastMove(originalLastMove);
          setWrongMove(false);
          setMessage("Try again. Find the correct move.");
          wrongMoveTimer.current = null;
        }, 700);

        return;
      }

      // Correct move: play the opponent's reply.
      let nextStep = step + 1;
      let finalMove = attemptedLastMove;

      if (nextStep < solution.length) {
        const reply = applyUci(chess, solution[nextStep]);

        finalMove = {
          from: reply.from,
          to: reply.to,
        };

        nextStep += 1;
      }

      setFen(chess.fen());
      setStep(nextStep);
      setLastMove(finalMove);

      if (nextStep >= solution.length) {
        setStatus("solved");
        setSolved((value) => value + 1);
        setStreak((value) => value + 1);
        setMessage("Excellent! Puzzle solved.");
        report(true);
      } else {
        setMessage("Correct move! Find the next move.");
      }
    } catch (error) {
      console.error("Puzzle move error:", error);

      setFen(originalFen);
      setLastMove(originalLastMove);
      setPendingPromotion(null);
      clearSelection();

      setMessage("Move could not be processed. Please retry.");
    }
  }

  // Called when the player chooses Queen, Rook, Bishop or Knight.
  function handlePromotionChoice(piece) {
    if (!pendingPromotion || !fen) return;

    const chess = new Chess(fen);

    const promotionMove = chess
      .moves({
        square: pendingPromotion.from,
        verbose: true,
      })
      .find(
        (move) =>
          move.to === pendingPromotion.to &&
          move.promotion === piece
      );

    if (!promotionMove) {
      setPendingPromotion(null);
      setMessage("That promotion is not legal. Try again.");
      return;
    }

    executeLegalMove(promotionMove);
  }

  function handleSquare(square) {
    if (
      status !== "playing" ||
      !fen ||
      solutionMode ||
      wrongMove ||
      pendingPromotion
    ) return;

    const chess = new Chess(fen);
    const clickedPiece = chess.get(square);

    if (selected) {
      const matchingMoves = chess
        .moves({
          square: selected,
          verbose: true,
        })
        .filter((move) => move.to === square);

      if (matchingMoves.length > 0) {
        // A pawn reaching the last rank has four promotion choices.
        const promotionMoves = matchingMoves.filter(
          (move) => move.promotion
        );

        if (promotionMoves.length > 0) {
          setPendingPromotion({
            from: selected,
            to: square,
            options: promotionMoves.map((move) => move.promotion),
          });

          setMessage("Choose the piece for promotion.");
          return;
        }

        executeLegalMove(matchingMoves[0]);
        return;
      }
    }

    // Select or switch to another piece of the side to move.
    if (clickedPiece && clickedPiece.color === chess.turn()) {
      const legalMoves = chess.moves({
        square,
        verbose: true,
      });

      setSelected(square);
      setTargets(legalMoves.map((move) => move.to));
      setHint(false);

      if (legalMoves.length === 0) {
        setMessage("This piece has no legal moves.");
      }

      return;
    }

    clearSelection();
  }

  /* ---------- NAYA: result save, Rush, mode badalna ---------- */
  function report(ok) {
    if (reportedRef.current || !puzzle) return;
    reportedRef.current = true;

    // My Games: result Leak Lab ke schedule me jaata hai (rating me nahi)
    if (source === "own") {
      const item = ownItemRef.current;
      if (item) dbPut("training", ok ? afterSolve(item) : afterMiss(item)).catch(() => {});
      setResult({ ok, rated: false, own: true });
      return;
    }

    const arcade = source === "arcade";
    const res = recordAttempt(puzzle, {
      ok,
      hints: hintsRef.current,
      ms: Date.now() - startRef.current,
      rated: !arcade,
    });
    setResult({ ...res, ok, rated: !arcade });
    setSnap(loadState());

    const r = runRef.current;
    if (arcade && r.state === "running") {
      const score = r.score + (ok ? 1 : 0);
      const strikes = r.strikes + (ok ? 0 : 1);
      if (strikes >= ARCADE[variant].strikes) {
        setTimeout(() => finishRun(score, strikes), 700);
      } else {
        setRun({ ...r, score, strikes });
        setTimeout(() => loadPuzzle("arcade", theme, score), ok ? 450 : 900);
      }
    }
  }

  function finishRun(score, strikes) {
    const record = setBest(variant, score);
    setSnap(loadState());
    setRun({ state: "over", score, strikes, endsAt: 0, left: 0, record });
  }

  function startRun(v) {
    const cfg = ARCADE[v];
    setVariant(v);
    setSource("arcade");
    setRun({
      state: "running", score: 0, strikes: 0,
      endsAt: cfg.seconds ? Date.now() + cfg.seconds * 1000 : 0,
      left: cfg.seconds * 1000, record: false,
    });
    loadPuzzle("arcade", theme, 0);
  }

  function selectSource(next) {
    setSource(next);
    setRun((r) => (r.state === "idle" ? r : { ...r, state: "idle" }));
    if (next !== "arcade") loadPuzzle(next, theme);
  }

  useEffect(() => {
    if (run.state !== "running" || !ARCADE[variant].seconds) return undefined;
    const id = setInterval(() => {
      const left = Math.max(0, runRef.current.endsAt - Date.now());
      if (left <= 0) {
        clearInterval(id);
        finishRun(runRef.current.score, runRef.current.strikes);
      } else {
        setRun((r) => ({ ...r, left }));
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.state, variant]);

  const arcadeLive = source === "arcade" && run.state === "running";
  const arcadeIdle = source === "arcade" && run.state !== "running";
  const done = status === "solved" || status === "revealed";
  const ex = useExplore(initialFen, exploring && done && !arcadeLive);

  const weak = useMemo(() => themeStats(snap).slice(0, 3), [snap]);
  const due = useMemo(() => dueIds(snap).length, [snap]);
  const today = useMemo(() => todayCount(snap), [snap]);
  const dayRun = useMemo(() => dayStreak(snap), [snap]);
  const sparkline = useMemo(() => {
    const series = snap.attempts.filter((a) => a.rated).slice(-30).map((a) => a.after);
    if (series.length < 2) return "";
    const lo = Math.min(...series);
    const hi = Math.max(...series);
    return series
      .map((v, i) => `${(i / (series.length - 1)) * 190},${58 - ((v - lo) / (hi - lo || 1)) * 52}`)
      .join(" ");
  }, [snap]);
  const tab = source === "arcade" ? "arcade" : source === "themes" ? "themes" : source === "own" ? "own" : "foryou";

  // Themes puzzle khatam hone tak chhupe rehte hain (spoiler na ho)
  const themesAll = puzzle?.themes || [];
  const themes = done ? themesAll : [];

  const toMove = initialFen.split(" ")[1] === "b" ? "b" : "w";
  const totalUser = Math.max(1, Math.ceil(solution.length / 2));
  const stepPct =
    status === "solved"
      ? 100
      : Math.min(100, Math.round((Math.ceil(step / 2) / totalUser) * 100));

  const displayFen = solutionMode ? previewFen : fen;

  const accuracy =
    solved + wrong > 0
      ? Math.round((solved / (solved + wrong)) * 100)
      : 0;

  const reviewMove =
    solutionMode && solutionIndex > 0
      ? solution[solutionIndex - 1]
      : null;

  const hintMove =
    hint && solution[step] ? solution[step] : null;

  const boardArrow = reviewMove || hintMove
    ? {
        from: (reviewMove || hintMove).slice(0, 2),
        to: (reviewMove || hintMove).slice(2, 4),
      }
    : null;

  const recent = useMemo(() => snap.attempts.slice(-10), [snap]);
  const turnSide = toMove === "w" ? "White" : "Black";
  const turnLabel =
    status === "solved" ? "SOLVED" : status === "revealed" ? "SOLUTION" : status === "error" ? "PROBLEM" : "YOUR TURN";
  const turnTitle =
    status === "solved"
      ? "Puzzle solved"
      : status === "revealed"
      ? "Review the solution"
      : status === "error"
      ? "Could not load the puzzle"
      : status === "loading"
      ? "Preparing your puzzle"
      : `Find the best move for ${turnSide}`;
  const turnText =
    status === "solved"
      ? "Nice work. Open Explore to see the engine's view, or move on to the next puzzle."
      : status === "revealed"
      ? "Step through the full line with the arrows under the board."
      : status === "error"
      ? message
      : status === "loading"
      ? "One moment."
      : puzzle?.own
      ? "This is a mistake from one of your own games. Find the move you missed."
      : "Look for checks, captures and threats first.";

  if (!everLoaded || !minDone) {
    return (
      <PageLoader
        page="practice"
        title="Preparing your puzzles..."
        messages={[
          "Finding your next challenge",
          "Setting up the board",
          "Loading tactical themes",
        ]}
      />
    );
  }

  return (
    <section className="pp-page">
      <div className="pp-tabs" role="tablist" aria-label="Puzzle mode">
        {MODES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`pp-tab ${tab === id ? "is-on" : ""}`}
            onClick={() => selectSource(id)}
          >
            {label}
          </button>
        ))}
        {source === "themes" && (
          <select
            className="pp-select"
            aria-label="Theme"
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value);
              loadPuzzle("themes", e.target.value);
            }}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>{prettyTheme(t)}</option>
            ))}
          </select>
        )}
        {(source === "weak" || source === "review") && (
          <span className="pp-chip">{source === "weak" ? "Training weak themes" : "Review queue"}</span>
        )}
      </div>

      <div className="pp-kpis">
        <div className="pp-kpi">
          <div>
            <span className="pp-label">PUZZLE RATING</span>
            <div className="pp-kpi-val"><strong>{snap.rating}</strong></div>
            <small>{snap.attempts.length < 20 ? "Provisional" : "Rated puzzles"}</small>
          </div>
          {sparkline && (
            <svg width="86" height="40" viewBox="0 0 190 64" preserveAspectRatio="none" role="img" aria-label="Rating trend">
              <polyline points={sparkline} fill="none" stroke="#4fd1c5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <div className="pp-kpi pp-kpi--col">
          <span className="pp-label">DAILY GOAL</span>
          <div className="pp-kpi-val"><strong>{Math.min(today, DAILY_GOAL)} / {DAILY_GOAL}</strong><small>puzzles today</small></div>
          <div className="pp-progress-track"><div style={{ width: `${Math.min(100, (today / DAILY_GOAL) * 100)}%` }} /></div>
        </div>

        <div className="pp-kpi">
          <div>
            <span className="pp-label">DAY STREAK</span>
            <div className="pp-kpi-val"><strong>{dayRun} {dayRun === 1 ? "day" : "days"}</strong></div>
            <small>Solve one a day to keep it</small>
          </div>
        </div>

        <div className="pp-kpi pp-kpi--col">
          <span className="pp-label">SESSION ACCURACY</span>
          <div className="pp-kpi-val"><strong>{accuracy}%</strong><small>{solved} solved · {wrong} wrong</small></div>
          <div className="pp-progress-track"><div style={{ width: `${accuracy}%` }} /></div>
        </div>
      </div>

      <div className="pp-layout">
        <main className="pp-main-card">
          {arcadeIdle ? (
            <div className="pp-arcade">
              <span className="pp-label">
                {run.state === "over" ? `${ARCADE[variant].label.toUpperCase()} OVER` : "PLAY FOR FUN"}
              </span>
              <h2>{run.state === "over" ? `Score ${run.score}` : "Pick a mode"}</h2>
              {run.state === "over" && run.record && <p className="pp-good">New personal best.</p>}
              <p className="pp-description">
                Rush and Streak do not change your puzzle rating. Missed puzzles still go to your review queue.
              </p>
              <div className="pp-arcade-grid">
                {Object.entries(ARCADE).map(([id, cfg]) => (
                  <button key={id} type="button" className="pp-mode" onClick={() => startRun(id)}>
                    <b>{cfg.label}</b>
                    <span>{cfg.blurb}</span>
                    <span>Best: {snap.bests[id] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
          <div className="pp-board-header">
            <div>
              <span className="pp-label">
                CURRENT CHALLENGE
              </span>

              <h2>
                {puzzle
                  ? puzzle.own
                    ? puzzle.leakTitle
                    : `Puzzle #${puzzle.id}`
                  : "Preparing puzzle"}
              </h2>
            </div>

            {puzzle && (
              <div className="pp-rating">
                {puzzle.own ? "From your game" : `★ ${puzzle.rating}`}
              </div>
            )}
          </div>

          {puzzle && (
            <div className="pp-strip">
              <span className={`pp-turn pp-turn--${toMove}`}>
                <i /> {toMove === "w" ? "White" : "Black"} to move
              </span>

              <div className="pp-steps" aria-label="Puzzle progress">
                <div className="pp-steps-bar">
                  <div style={{ width: `${stepPct}%` }} />
                </div>
                <small>{Math.min(Math.ceil(step / 2), totalUser)} / {totalUser} moves</small>
              </div>
            </div>
          )}

          {arcadeLive && (
            <p className="pp-hud">
              {ARCADE[variant].seconds > 0 && <b>{clock(run.left)}</b>}
              <span>Score {run.score}</span>
              <span>Strikes {run.strikes}/{ARCADE[variant].strikes}</span>
            </p>
          )}

          <div className="pp-board-wrapper">
            {displayFen && (
              <Board
                fen={ex.active ? ex.fen : displayFen}
                flipped={initialFen.split(" ")[1] === "b"}
                selected={ex.active ? ex.selected : solutionMode ? null : selected}
                targets={
                  ex.active
                    ? ex.targets
                    : solutionMode || wrongMove || pendingPromotion
                    ? []
                    : targets
                }
                lastMove={ex.active ? (ex.trail.length ? ex.lastMove : null) : solutionMode ? null : lastMove}
                arrow={ex.active ? ex.arrow : boardArrow}
                onSquareClick={ex.active ? ex.squareClick : handleSquare}
              />
            )}

            {status === "loading" && (
              <div className="pp-overlay">
                <div className="pp-loader" />
                <span>Preparing your puzzle...</span>
              </div>
            )}

            {pendingPromotion && (
              <div className="pp-promo">
                <div className="pp-promo-box">
                  <div className="pp-promo-title">Promote your pawn</div>
                  <div className="pp-promo-sub">Choose your promotion piece</div>

                  <div className="pp-promo-grid">
                    {PROMOTION_PIECES.filter((piece) =>
                      pendingPromotion.options.includes(piece.value)
                    ).map((piece) => (
                      <button
                        key={piece.value}
                        type="button"
                        className="pp-promo-btn"
                        onClick={() => handlePromotionChoice(piece.value)}
                        aria-label={`Promote to ${piece.label}`}
                      >
                        <span>{piece.symbol}</span>
                        <small>{piece.label}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {solutionMode && (
            <div className="pp-solution-navigation">
              <div className="pp-solution-heading">
                <div>
                  <span className="pp-label">
                    SOLUTION REVIEW
                  </span>

                  <strong>
                    {solutionIndex === 0
                      ? "Starting position"
                      : `Move ${solutionIndex} of ${solution.length}`}
                  </strong>
                </div>

                <span className="pp-move-counter">
                  {solutionIndex}/{solution.length}
                </span>
              </div>

              <div className="pp-solution-move">
                {reviewMove
                  ? `${reviewMove.slice(0, 2)} → ${reviewMove.slice(2, 4)}`
                  : "Review the starting position"}
              </div>

              <div className="pp-navigation-buttons">
                <button
                  className="pp-nav-arrow"
                  disabled={solutionIndex === 0}
                  onClick={() => navigateSolution(-1)}
                  aria-label="Previous solution move"
                >
                  ← Previous
                </button>

                <button
                  className="pp-nav-arrow"
                  disabled={solutionIndex === solution.length}
                  onClick={() => navigateSolution(1)}
                  aria-label="Next solution move"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          <div
            className={`pp-status pp-status-${status}`}
            role="status"
          >
            <span className="pp-status-dot" />
            <span>{message}</span>
          </div>

          <div className="pp-controls" style={arcadeLive ? { display: "none" } : undefined}>
            {status === "playing" && (
              <>
                <button
                  className="pp-btn pp-btn-secondary"
                  onClick={showHint}
                  disabled={wrongMove || !!pendingPromotion}
                >
                  ✦ Hint
                </button>

                <button
                  className="pp-btn pp-btn-secondary"
                  onClick={retryPuzzle}
                  disabled={wrongMove}
                >
                  ↺ Retry
                </button>

                <button
                  className="pp-btn pp-btn-gold"
                  onClick={showSolution}
                  disabled={wrongMove}
                >
                  Show Solution
                </button>
              </>
            )}

            {status === "solved" && (
              <>
                <button
                  className="pp-btn pp-btn-secondary"
                  onClick={retryPuzzle}
                >
                  ↺ Play Again
                </button>

                <button
                  className="pp-btn pp-btn-gold"
                  onClick={() => loadPuzzle()}
                >
                  Next Puzzle →
                </button>
              </>
            )}

            {status === "revealed" && (
              <>
                <button
                  className="pp-btn pp-btn-secondary"
                  onClick={retryPuzzle}
                >
                  ↺ Try Again
                </button>

                <button
                  className="pp-btn pp-btn-gold"
                  onClick={() => loadPuzzle()}
                >
                  Next Puzzle →
                </button>
              </>
            )}

            {status === "error" && (
              <button
                className="pp-btn pp-btn-gold"
                onClick={() => loadPuzzle()}
              >
                Try Again →
              </button>
            )}

            {status === "loading" && (
              <button
                className="pp-btn pp-btn-secondary"
                disabled
              >
                Loading...
              </button>
            )}
          </div>

          {done && !arcadeLive && (
            <div className="pp-controls">
              <button type="button" className="pp-btn pp-btn-secondary" onClick={() => setExploring((v) => !v)}>
                {exploring ? "Close Explore" : "Open in Explore"}
              </button>
            </div>
          )}

          {ex.active && (
            <div className="pp-explore">
              <ExplorePanel ex={ex} />
            </div>
          )}
            </>
          )}
        </main>

        <aside className="pp-side">
          <section className="pp-panel pp-turncard">
            <span className="pp-label">{turnLabel}</span>
            <h2>{turnTitle}</h2>
            <p className="pp-description">{turnText}</p>

            {result && done && !arcadeLive && (
              <p className={`pp-result ${result.ok ? "is-win" : "is-miss"}`}>
                {result.rated
                  ? `Puzzle rating ${result.delta >= 0 ? "+" : "−"}${Math.abs(result.delta)} → ${result.rating}.`
                  : result.own
                    ? "Saved to your Leak Lab schedule."
                    : "Rush results do not change your rating."}
                {!result.ok && (result.own ? " It comes back today in Leak Lab." : " This puzzle will come back in your review queue tomorrow.")}
              </p>
            )}

            {themes.length > 0 ? (
              <div className="pp-tags">
                {themes.map((t) => (
                  <span key={t}>{prettyTheme(t)}</span>
                ))}
              </div>
            ) : (
              <p className="pp-fine">
                {status === "loading"
                  ? "Loading themes..."
                  : themesAll.length
                  ? "Tactical themes stay hidden until you finish the puzzle."
                  : "No themes available."}
              </p>
            )}
          </section>

          <div className="pp-pair">
            <section className="pp-panel">
              <span className="pp-label">WEAK THEMES</span>
              {weak.length ? (
                <div className="pp-weak">
                  {weak.map((t) => (
                    <div key={t.theme}>
                      <div className="pp-weak-row">
                        <span>{prettyTheme(t.theme)}</span>
                        <small>{t.pct}% solved · {t.tried} tried</small>
                      </div>
                      <div className="pp-progress-track"><div style={{ width: `${t.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pp-description">Solve at least 5 puzzles of a theme and your weakest ones will show up here.</p>
              )}
              <button
                type="button"
                className="pp-btn pp-btn-gold pp-block"
                disabled={!weak.length || !canUse("weak")}
                onClick={() => selectSource("weak")}
              >
                Train my weak themes
              </button>
            </section>

            <section className="pp-panel">
              <span className="pp-label">REVIEW QUEUE</span>
              <div className="pp-bignum"><strong>{due}</strong><span>due today</span></div>
              <p className="pp-description">
                Missed puzzles come back after 1, 3 and 7 days until you solve them cleanly.
              </p>
              <button
                type="button"
                className="pp-btn pp-btn-secondary pp-block"
                disabled={!due || !canUse("review")}
                onClick={() => selectSource("review")}
              >
                Start review
              </button>
            </section>
          </div>

          <section className="pp-panel pp-recent">
            <div className="pp-recent-head">
              <span className="pp-label">RECENT PUZZLES</span>
              <small>Streak {streak} this session</small>
            </div>
            {recent.length ? (
              <div className="pp-dots">
                {recent.map((a, i) => (
                  <span
                    key={i}
                    className={`pp-dot ${a.ok ? "is-win" : "is-miss"}`}
                    aria-label={a.ok ? "Solved" : "Missed"}
                  >
                    {a.ok ? "✓" : "✕"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="pp-description">Your last 10 puzzles will show up here.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}