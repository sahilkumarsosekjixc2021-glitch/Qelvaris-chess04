
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./Puzzles.css";

const STORAGE_KEY = "qelvarisPuzzleProgress";
const STATS_KEY = "qelvarisPuzzleStats";
const DAILY_KEY = "qelvarisPuzzleDaily";
const PUZZLES_URL = "/data/qelvaris-puzzles.json";

const PIECES = {
  w: {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙",
  },
  b: {
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  },
};

const FILES = "abcdefgh";
const RANKS = "87654321";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeThemes(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

function normalizePuzzle(row, index) {
  const moves = Array.isArray(row.moves)
    ? row.moves
    : typeof row.Moves === "string"
      ? row.Moves.trim().split(/\s+/)
      : [];

  return {
    id: String(row.id ?? row.PuzzleId ?? `lichess-${index}`),
    fen: row.fen ?? row.FEN,
    moves,
    rating: Number(row.rating ?? row.Rating ?? 1500),
    themes: normalizeThemes(row.themes ?? row.Themes),
  };
}

function getDifficulty(rating) {
  if (rating < 1200) return "Easy";
  if (rating < 1800) return "Medium";
  return "Hard";
}

function makeGame(fen) {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function playUci(game, uci) {
  if (!game || typeof uci !== "string" || uci.length < 4) {
    return null;
  }

  try {
    return game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || "q",
    });
  } catch {
    return null;
  }
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The puzzle session can still work if storage is unavailable.
  }
}

function hashString(value) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export default function Puzzles() {
  const gameRef = useRef(null);
  const moveIndexRef = useRef(1);
  const lockedRef = useRef(false);
  const selectedRef = useRef(null);
  const sessionSeenRef = useRef(new Set());

  const [puzzles, setPuzzles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState("training");
  const [difficulty, setDifficulty] = useState("All");
  const [themeFilter, setThemeFilter] = useState("All");

  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [activePuzzle, setActivePuzzle] = useState(null);
  const [positionFen, setPositionFen] = useState("");
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [feedback, setFeedback] = useState("Choose the best move.");
  const [feedbackType, setFeedbackType] = useState("info");
  const [solved, setSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [streak, setStreak] = useState(0);
  const [rushScore, setRushScore] = useState(0);
  const [rushLives, setRushLives] = useState(3);
  const [rushFinished, setRushFinished] = useState(false);

  const [solvedIds, setSolvedIds] = useState(
    () => readStorage(STORAGE_KEY, [])
  );

  const [stats, setStats] = useState(() =>
    readStorage(STATS_KEY, {
      solved: 0,
      attempts: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
    })
  );

  const [dailyRecord, setDailyRecord] = useState(() =>
    readStorage(DAILY_KEY, {})
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPuzzles() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(PUZZLES_URL);

        if (!response.ok) {
          throw new Error(
            `Puzzle data load nahi hua (${response.status}).`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Puzzle JSON empty hai ya format galat hai.");
        }

        const normalized = data
          .map(normalizePuzzle)
          .filter(
            (puzzle) =>
              puzzle.fen &&
              puzzle.moves.length >= 2 &&
              puzzle.moves.every(
                (move) =>
                  typeof move === "string" && move.length >= 4
              )
          );

        if (normalized.length === 0) {
          throw new Error(
            "JSON mein valid puzzles nahi mile. FEN aur Moves fields check karo."
          );
        }

        if (!cancelled) {
          setPuzzles(normalized);
          setPuzzleIndex(0);
          setActivePuzzle(normalized[0]);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            `${error.message} File public/data/qelvaris-puzzles.json mein honi chahiye.`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPuzzles();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEY, solvedIds);
  }, [solvedIds]);

  useEffect(() => {
    writeStorage(STATS_KEY, stats);
  }, [stats]);

  useEffect(() => {
    writeStorage(DAILY_KEY, dailyRecord);
  }, [dailyRecord]);

  const availableThemes = useMemo(() => {
    const themes = new Set();

    puzzles.forEach((puzzle) => {
      puzzle.themes.forEach((theme) => themes.add(theme));
    });

    return [...themes].sort();
  }, [puzzles]);

  const filteredPuzzles = useMemo(() => {
    return puzzles.filter((puzzle) => {
      const matchesDifficulty =
        difficulty === "All" ||
        getDifficulty(puzzle.rating) === difficulty;

      const matchesTheme =
        themeFilter === "All" ||
        puzzle.themes.includes(themeFilter);

      return matchesDifficulty && matchesTheme;
    });
  }, [puzzles, difficulty, themeFilter]);

  const currentPosition = useMemo(
    () => makeGame(positionFen),
    [positionFen]
  );

  const board = currentPosition
    ? currentPosition.board()
    : [];

  const isDailySolved =
    dailyRecord.date === getToday() &&
    dailyRecord.solved === true;

  const activeThemes = activePuzzle?.themes ?? [];

  const persistSolved = useCallback((puzzle) => {
    setSolvedIds((previous) =>
      previous.includes(puzzle.id)
        ? previous
        : [...previous, puzzle.id]
    );
  }, []);

  const startPuzzle = useCallback(
    (puzzle, nextMode = mode) => {
      if (!puzzle) return;

      const game = makeGame(puzzle.fen);

      if (!game) {
        setFeedback("Is puzzle ka board position load nahi ho saka.");
        setFeedbackType("error");
        return;
      }

      /*
       * Lichess FEN is the position BEFORE the first move.
       * moves[0] is the opponent's setup move.
       * The player solves the puzzle starting from moves[1].
       */
      const setupMove = playUci(game, puzzle.moves[0]);

      if (!setupMove) {
        setFeedback("Puzzle ka initial move invalid hai.");
        setFeedbackType("error");
        return;
      }

      gameRef.current = game;
      moveIndexRef.current = 1;
      lockedRef.current = false;
      selectedRef.current = null;

      setMode(nextMode);
      setActivePuzzle(puzzle);
      setPositionFen(game.fen());
      setSelectedSquare(null);
      setLegalTargets([]);
      setSolved(false);
      setShowHint(false);
      setShowSolution(false);
      setFeedback("Find the best move.");
      setFeedbackType("info");
    },
    [mode]
  );

  const chooseRandomPuzzle = useCallback(
    (excludeId = null) => {
      let candidates = filteredPuzzles;

      if (mode === "rush") {
        const unseen = candidates.filter(
          (puzzle) =>
            !sessionSeenRef.current.has(puzzle.id) &&
            puzzle.id !== excludeId
        );

        if (unseen.length > 0) candidates = unseen;
      }

      const alternatives = candidates.filter(
        (puzzle) => puzzle.id !== excludeId
      );

      const pool =
        alternatives.length > 0 ? alternatives : candidates;

      if (pool.length === 0) {
        setFeedback("Is filter ke liye koi puzzle nahi mila.");
        setFeedbackType("error");
        return;
      }

      const next = pool[Math.floor(Math.random() * pool.length)];

      sessionSeenRef.current.add(next.id);

      const index = puzzles.findIndex(
        (puzzle) => puzzle.id === next.id
      );

      setPuzzleIndex(Math.max(0, index));
      startPuzzle(next, mode);
    },
    [filteredPuzzles, mode, puzzles, startPuzzle]
  );

  useEffect(() => {
    if (!loading && puzzles.length > 0 && !gameRef.current) {
      startPuzzle(puzzles[0], "training");
    }
  }, [loading, puzzles, startPuzzle]);

  const startTraining = useCallback(() => {
    sessionSeenRef.current.clear();
    setRushFinished(false);
    chooseRandomPuzzle();
  }, [chooseRandomPuzzle]);

  const startDaily = useCallback(() => {
    if (puzzles.length === 0) return;

    if (
      dailyRecord.date === getToday() &&
      dailyRecord.solved
    ) {
      setMode("daily");
      setFeedback("Aaj ka Daily Challenge already complete hai.");
      setFeedbackType("success");
      return;
    }

    const index = hashString(getToday()) % puzzles.length;

    setPuzzleIndex(index);
    startPuzzle(puzzles[index], "daily");
  }, [puzzles, dailyRecord, startPuzzle]);

  const startRush = useCallback(() => {
    if (filteredPuzzles.length === 0) {
      setFeedback("Puzzle Rush ke liye koi puzzle nahi mila.");
      setFeedbackType("error");
      return;
    }

    sessionSeenRef.current.clear();
    setRushScore(0);
    setRushLives(3);
    setRushFinished(false);
    setStreak(0);

    const first =
      filteredPuzzles[
        Math.floor(Math.random() * filteredPuzzles.length)
      ];

    sessionSeenRef.current.add(first.id);

    setPuzzleIndex(
      puzzles.findIndex((puzzle) => puzzle.id === first.id)
    );

    startPuzzle(first, "rush");
  }, [filteredPuzzles, puzzles, startPuzzle]);

  const nextPuzzle = useCallback(() => {
    if (mode === "daily") {
      setFeedback("Daily Challenge ke liye aaj ka puzzle hi use hota hai.");
      setFeedbackType("info");
      return;
    }

    chooseRandomPuzzle(activePuzzle?.id);
  }, [mode, chooseRandomPuzzle, activePuzzle]);

  const updateProgress = useCallback(
    (isCorrect, puzzle) => {
      setStats((previous) => {
        const nextStreak = isCorrect ? previous.streak + 1 : 0;

        return {
          ...previous,
          attempts: previous.attempts + 1,
          correct: previous.correct + (isCorrect ? 1 : 0),
          solved: previous.solved + (isCorrect ? 1 : 0),
          streak: nextStreak,
          bestStreak: Math.max(
            previous.bestStreak,
            nextStreak
          ),
        };
      });

      if (!isCorrect) setStreak(0);
      else setStreak((previous) => previous + 1);

      if (isCorrect) persistSolved(puzzle);
    },
    [persistSolved]
  );

  const finishPuzzle = useCallback(() => {
    if (!activePuzzle) return;

    lockedRef.current = true;
    setSolved(true);
    setSelectedSquare(null);
    setLegalTargets([]);
    setFeedback("Correct! Puzzle solved.");
    setFeedbackType("success");

    if (mode === "daily") {
      setDailyRecord({
        date: getToday(),
        solved: true,
        puzzleId: activePuzzle.id,
      });
    }

    if (mode === "rush") {
      setRushScore((previous) => previous + 1);
    }
  }, [activePuzzle, mode]);

  const handleWrongMove = useCallback(() => {
    lockedRef.current = true;
    updateProgress(false, activePuzzle);

    setFeedback("Not quite. Try another move.");
    setFeedbackType("error");
    setSelectedSquare(null);
    setLegalTargets([]);

    if (mode === "rush") {
      setRushLives((previous) => {
        const remaining = previous - 1;

        if (remaining <= 0) {
          setRushFinished(true);
          setFeedback("Puzzle Rush finished! Start again to play.");
          setFeedbackType("info");
          return 0;
        }

        return remaining;
      });
    }

    window.setTimeout(() => {
      if (mode === "rush" && rushLives <= 1) return;
      lockedRef.current = false;
    }, 500);
  }, [activePuzzle, mode, rushLives, updateProgress]);

  const submitMove = useCallback(
    (from, to) => {
      const game = gameRef.current;

      if (
        !game ||
        !activePuzzle ||
        lockedRef.current ||
        solved ||
        showSolution
      ) {
        return;
      }

      const expected = activePuzzle.moves[moveIndexRef.current];

      if (!expected) {
        finishPuzzle();
        return;
      }

      const candidate = `${from}${to}`;

      if (
        candidate !== expected.slice(0, 4) &&
        !(expected.length >= 5 &&
          candidate === expected.slice(0, 4))
      ) {
        handleWrongMove();
        return;
      }

      const move = playUci(game, expected);

      if (!move) {
        setFeedback("Move apply nahi ho saka. Puzzle data check karo.");
        setFeedbackType("error");
        return;
      }

      moveIndexRef.current += 1;
      setPositionFen(game.fen());
      setSelectedSquare(null);
      setLegalTargets([]);
      lockedRef.current = true;

      const nextExpected =
        activePuzzle.moves[moveIndexRef.current];

      if (!nextExpected) {
        finishPuzzle();
        updateProgress(true, activePuzzle);
        return;
      }

      /*
       * After the player's correct move, play the forced
       * opponent reply automatically, then wait for the player.
       */
      const reply = playUci(game, nextExpected);

      if (!reply) {
        finishPuzzle();
        updateProgress(true, activePuzzle);
        return;
      }

      moveIndexRef.current += 1;
      setPositionFen(game.fen());

      const afterReply = activePuzzle.moves[moveIndexRef.current];

      if (!afterReply) {
        finishPuzzle();
        updateProgress(true, activePuzzle);
        return;
      }

      setFeedback("Good move! Find the next one.");
      setFeedbackType("success");

      window.setTimeout(() => {
        lockedRef.current = false;
      }, 250);
    },
    [
      activePuzzle,
      finishPuzzle,
      handleWrongMove,
      showSolution,
      solved,
      updateProgress,
    ]
  );

  const handleSquareClick = useCallback(
    (square) => {
      const game = gameRef.current;

      if (!game || lockedRef.current || solved || showSolution) {
        return;
      }

      const piece = game.get(square);

      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          setLegalTargets([]);
          selectedRef.current = null;
          return;
        }

        const possible = legalTargets.includes(square);

        if (possible) {
          submitMove(selectedSquare, square);
          return;
        }

        if (piece && piece.color === game.turn()) {
          const targets = game
            .moves({ square, verbose: true })
            .map((move) => move.to);

          setSelectedSquare(square);
          selectedRef.current = square;
          setLegalTargets(targets);
          return;
        }

        setSelectedSquare(null);
        selectedRef.current = null;
        setLegalTargets([]);
        return;
      }

      if (piece && piece.color === game.turn()) {
        const targets = game
          .moves({ square, verbose: true })
          .map((move) => move.to);

        setSelectedSquare(square);
        selectedRef.current = square;
        setLegalTargets(targets);
      }
    },
    [selectedSquare, legalTargets, submitMove, solved, showSolution]
  );

  const giveHint = useCallback(() => {
    if (!activePuzzle || solved || showSolution) return;

    setShowHint(true);

    const move = activePuzzle.moves[moveIndexRef.current];

    if (move) {
      setFeedback(
        `Hint: move a piece from ${move.slice(0, 2)} to ${move.slice(2, 4)}.`
      );
      setFeedbackType("info");
    }
  }, [activePuzzle, solved, showSolution]);

  const revealSolution = useCallback(() => {
    if (!activePuzzle || solved) return;

    const game = makeGame(activePuzzle.fen);

    if (!game) return;

    for (const move of activePuzzle.moves) {
      if (!playUci(game, move)) break;
    }

    gameRef.current = game;
    moveIndexRef.current = activePuzzle.moves.length;
    lockedRef.current = true;

    setPositionFen(game.fen());
    setShowSolution(true);
    setFeedback("Solution revealed. Try another puzzle.");
    setFeedbackType("info");
    setSelectedSquare(null);
    setLegalTargets([]);
  }, [activePuzzle, solved]);

  const resetCurrentPuzzle = useCallback(() => {
    if (!activePuzzle) return;

    startPuzzle(activePuzzle, mode);
  }, [activePuzzle, mode, startPuzzle]);

  const resetProgress = useCallback(() => {
    const confirmed = window.confirm(
      "Kya tum apna saved puzzle progress reset karna chahte ho?"
    );

    if (!confirmed) return;

    setSolvedIds([]);
    setStats({
      solved: 0,
      attempts: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
    });
    setDailyRecord({});
    setStreak(0);
    setRushScore(0);
    setRushLives(3);

    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STATS_KEY);
      localStorage.removeItem(DAILY_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const accuracy = stats.attempts
    ? Math.round((stats.correct / stats.attempts) * 100)
    : 0;

  const activeRating = activePuzzle?.rating ?? 0;
  const activeDifficulty = getDifficulty(activeRating);

  if (loading) {
    return (
      <div className="puzzles-page">
        <div className="puzzles-header">
          <h1>Puzzle Lab</h1>
          <p>Loading your chess puzzles...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="puzzles-page">
        <div className="puzzles-header">
          <h1>Puzzle Lab</h1>
          <p>Unable to load puzzles.</p>
        </div>

        <div className="puzzle-card">
          <p>{loadError}</p>
          <p>
            Expected file:{" "}
            <code>public/data/qelvaris-puzzles.json</code>
          </p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!activePuzzle || !currentPosition) {
    return (
      <div className="puzzles-page">
        <h1>Puzzle Lab</h1>
        <p>No valid puzzle is currently selected.</p>
        <button onClick={startTraining}>Try again</button>
      </div>
    );
  }

  return (
    <div className="puzzles-page">
      <div className="puzzles-header">
        <div>
          <h1>Puzzle Lab</h1>
          <p>Sharpen your calculation, tactics and chess vision.</p>
        </div>

        <div className="puzzle-header-stats">
          <div className="puzzle-stat">
            <span>Solved</span>
            <strong>{solvedIds.length}</strong>
          </div>
          <div className="puzzle-stat">
            <span>Accuracy</span>
            <strong>{accuracy}%</strong>
          </div>
          <div className="puzzle-stat">
            <span>Best streak</span>
            <strong>{stats.bestStreak}</strong>
          </div>
        </div>
      </div>

      <div className="puzzle-tabs">
        <button
          className={mode === "training" ? "active" : ""}
          onClick={startTraining}
        >
          Training
        </button>

        <button
          className={mode === "daily" ? "active" : ""}
          onClick={startDaily}
        >
          Daily Challenge
        </button>

        <button
          className={mode === "rush" ? "active" : ""}
          onClick={startRush}
        >
          Puzzle Rush
        </button>

        <button
          className={mode === "progress" ? "active" : ""}
          onClick={() => setMode("progress")}
        >
          My Progress
        </button>
      </div>

      {mode === "progress" ? (
        <div className="puzzle-layout">
          <section className="puzzle-card puzzle-progress">
            <h2>My Progress</h2>

            <div className="puzzle-stats-grid">
              <div className="puzzle-stat">
                <span>Puzzles solved</span>
                <strong>{solvedIds.length}</strong>
              </div>
              <div className="puzzle-stat">
                <span>Total attempts</span>
                <strong>{stats.attempts}</strong>
              </div>
              <div className="puzzle-stat">
                <span>Correct attempts</span>
                <strong>{stats.correct}</strong>
              </div>
              <div className="puzzle-stat">
                <span>Accuracy</span>
                <strong>{accuracy}%</strong>
              </div>
              <div className="puzzle-stat">
                <span>Current streak</span>
                <strong>{stats.streak}</strong>
              </div>
              <div className="puzzle-stat">
                <span>Best streak</span>
                <strong>{stats.bestStreak}</strong>
              </div>
            </div>

            <h3>Solved puzzles</h3>

            {solvedIds.length === 0 ? (
              <p>You have not solved any puzzles yet.</p>
            ) : (
              <p>
                You have solved {solvedIds.length} unique puzzles.
                Keep practising to improve your tactical vision.
              </p>
            )}

            <button onClick={resetProgress}>
              Reset Progress
            </button>
          </section>
        </div>
      ) : (
        <div className="puzzle-layout">
          <section className="puzzle-board-panel">
            <div className="puzzle-board-heading">
              <div>
                <span className="puzzle-label">
                  {mode === "daily"
                    ? "DAILY CHALLENGE"
                    : mode === "rush"
                      ? "PUZZLE RUSH"
                      : "TACTICAL TRAINING"}
                </span>

                <h2>
                  {mode === "rush"
                    ? "Solve as many as you can"
                    : "Find the best move"}
                </h2>
              </div>

              <span className="puzzle-rating">
                Rating {activeRating}
              </span>
            </div>

            <div className="puzzle-board" role="grid" aria-label="Chess puzzle board">
              {board.map((rank, rowIndex) =>
                rank.map((piece, colIndex) => {
                  const square =
                    FILES[colIndex] + RANKS[rowIndex];

                  const isLight =
                    (rowIndex + colIndex) % 2 === 0;

                  const isSelected = selectedSquare === square;
                  const isTarget = legalTargets.includes(square);

                  return (
                    <button
                      key={square}
                      type="button"
                      role="gridcell"
                      aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                      className={[
                        "puzzle-square",
                        isLight ? "light" : "dark",
                        isSelected ? "selected" : "",
                        isTarget ? "legal-target" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleSquareClick(square)}
                    >
                      {colIndex === 0 && (
                        <span className="puzzle-coordinate rank">
                          {RANKS[rowIndex]}
                        </span>
                      )}

                      {rowIndex === 7 && (
                        <span className="puzzle-coordinate file">
                          {FILES[colIndex]}
                        </span>
                      )}

                      {piece && (
                        <span
                          className={`puzzle-piece ${piece.color === "w" ? "white-piece" : "black-piece"}`}
                        >
                          {PIECES[piece.color][piece.type]}
                        </span>
                      )}

                      {isTarget && !piece && (
                        <span className="puzzle-legal-dot" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div
              className={`puzzle-feedback ${feedbackType}`}
              aria-live="polite"
            >
              {feedback}
            </div>

            {mode === "rush" && (
              <div className="puzzle-rush-status">
                <span>Score: {rushScore}</span>
                <span>Lives: {"♥ ".repeat(rushLives)}</span>
              </div>
            )}

            <div className="puzzle-controls">
              <button onClick={giveHint} disabled={solved || showSolution}>
                Hint
              </button>

              <button
                onClick={revealSolution}
                disabled={solved || showSolution}
              >
                Reveal Solution
              </button>

              <button onClick={resetCurrentPuzzle}>
                Reset Puzzle
              </button>

              {mode === "rush" ? (
                <button
                  onClick={rushFinished ? startRush : nextPuzzle}
                >
                  {rushFinished ? "Restart Rush" : "Skip Puzzle"}
                </button>
              ) : mode !== "daily" ? (
                <button onClick={nextPuzzle}>Next Puzzle</button>
              ) : null}
            </div>
          </section>

          <aside className="puzzle-sidebar">
            <div className="puzzle-card">
              <h3>Puzzle Details</h3>

              <div className="puzzle-detail-row">
                <span>Difficulty</span>
                <strong>{activeDifficulty}</strong>
              </div>

              <div className="puzzle-detail-row">
                <span>Rating</span>
                <strong>{activeRating}</strong>
              </div>

              <div className="puzzle-detail-row">
                <span>Status</span>
                <strong>
                  {solved
                    ? "Solved"
                    : showSolution
                      ? "Solution revealed"
                      : solvedIds.includes(activePuzzle.id)
                        ? "Previously solved"
                        : "In progress"}
                </strong>
              </div>

              <div className="puzzle-detail-row">
                <span>Current streak</span>
                <strong>{streak}</strong>
              </div>

              <h3>Motifs</h3>

              <div className="puzzle-theme-list">
                {activeThemes.length > 0 ? (
                  activeThemes.map((theme) => (
                    <span className="puzzle-theme" key={theme}>
                      {theme.replaceAll("_", " ")}
                    </span>
                  ))
                ) : (
                  <span>No themes available</span>
                )}
              </div>

              {showHint && !showSolution && (
                <p className="puzzle-hint">
                  Look for forcing moves: checks, captures and threats.
                </p>
              )}
            </div>

            <div className="puzzle-card">
              <h3>Find a Puzzle</h3>

              <label htmlFor="puzzle-difficulty">
                Difficulty
              </label>

              <select
                id="puzzle-difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                <option value="All">All difficulties</option>
                <option value="Easy">Easy (under 1200)</option>
                <option value="Medium">Medium (1200–1799)</option>
                <option value="Hard">Hard (1800+)</option>
              </select>

              <label htmlFor="puzzle-theme">Theme</label>

              <select
                id="puzzle-theme"
                value={themeFilter}
                onChange={(event) => setThemeFilter(event.target.value)}
              >
                <option value="All">All themes</option>

                {availableThemes.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme.replaceAll("_", " ")}
                  </option>
                ))}
              </select>

              <p className="puzzle-filter-count">
                {filteredPuzzles.length} puzzles available
              </p>

              <button
                onClick={() => {
                  sessionSeenRef.current.clear();
                  chooseRandomPuzzle();
                }}
                disabled={filteredPuzzles.length === 0}
              >
                Find Puzzle
              </button>
            </div>

            <div className="puzzle-card">
              <h3>Training Tip</h3>
              <p>
                Before moving, calculate the opponent's strongest
                reply. Look for checks, captures, forks and
                undefended pieces.
              </p>
            </div>
          </aside>
        </div>
      )}

      <div className="puzzle-footer">
        <p>
          Puzzle data: Lichess puzzle database. Puzzle ratings and
          themes depend on the source dataset.
        </p>
      </div>
    </div>
  );
}
