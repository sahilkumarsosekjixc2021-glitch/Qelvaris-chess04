import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import "./ChessCoach.css";

const GAMES_KEY = "qelvarisSavedGames";
const PLAN_KEY = "qelvarisCoachPlan";

const GOALS = [
  { id: "balanced", label: "Balanced improvement" },
  { id: "tactics", label: "Tactics and calculation" },
  { id: "openings", label: "Opening preparation" },
  { id: "endgames", label: "Endgame technique" },
];

const TRAINING = {
  balanced: [
    { title: "Calculate forcing moves", detail: "Before each move, check captures, checks and threats.", module: "Puzzles" },
    { title: "Review one complete game", detail: "Find the moment where your position changed significantly.", module: "GameReview" },
    { title: "Study a candidate line", detail: "Compare the engine's top moves in Analysis Lab.", module: "AnalysisLab" },
  ],
  tactics: [
    { title: "Solve tactical puzzles", detail: "Calculate the full line before moving a piece.", module: "Puzzles" },
    { title: "Check opponent threats", detail: "After every opponent move, ask what changed.", module: "AnalysisLab" },
    { title: "Review tactical mistakes", detail: "Use a saved game to revisit missed opportunities.", module: "GameReview" },
  ],
  openings: [
    { title: "Build a simple repertoire", detail: "Choose reliable lines and learn the plans behind them.", module: "OpeningStudio" },
    { title: "Review your opening moves", detail: "Compare your early moves with engine suggestions.", module: "AnalysisLab" },
    { title: "Practise the same setup", detail: "Play games using one opening before adding another.", module: "PlayChess" },
  ],
  endgames: [
    { title: "Practise king and pawn endings", detail: "Focus on opposition, passed pawns and king activity.", module: "Puzzles" },
    { title: "Review simplified positions", detail: "Look for missed winning chances and drawing resources.", module: "GameReview" },
    { title: "Compare endgame moves", detail: "Use the engine to test candidate moves in a position.", module: "AnalysisLab" },
  ],
};

function readGames() {
  try {
    const data = JSON.parse(localStorage.getItem(GAMES_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function readPlan() {
  try {
    const data = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function resultType(game) {
  const result = String(game?.result || "").trim().toLowerCase();

  if (["1-0", "white", "win", "won", "1"].includes(result)) return "win";
  if (["0-1", "black", "loss", "lost", "0"].includes(result)) return "loss";
  if (["1/2-1/2", "½-½", "draw", "drawn"].includes(result)) return "draw";

  return "unknown";
}

function getOpeningName(game) {
  try {
    if (!game?.pgn) return null;

    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const moves = chess.history();

    if (moves.length < 2) return null;

    return `${moves[0]} ${moves[1]}`;
  } catch {
    return null;
  }
}

function navigateTo(page) {
  window.dispatchEvent(
    new CustomEvent("qelvaris-navigate", { detail: page })
  );
}

export default function ChessCoach() {
  const [games, setGames] = useState([]);
  const [goal, setGoal] = useState("balanced");
  const [completed, setCompleted] = useState([]);
  const [showAllGames, setShowAllGames] = useState(false);

  useEffect(() => {
    const savedGames = readGames();
    const savedPlan = readPlan();

    setGames(savedGames);
    setGoal(GOALS.some((item) => item.id === savedPlan.goal) ? savedPlan.goal : "balanced");
    setCompleted(Array.isArray(savedPlan.completed) ? savedPlan.completed : []);

    const refresh = () => setGames(readGames());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PLAN_KEY,
        JSON.stringify({ goal, completed })
      );
    } catch {
      // The coach remains usable if localStorage is unavailable.
    }
  }, [goal, completed]);

  const stats = useMemo(() => {
    const wins = games.filter((game) => resultType(game) === "win").length;
    const losses = games.filter((game) => resultType(game) === "loss").length;
    const draws = games.filter((game) => resultType(game) === "draw").length;
    const knownResults = wins + losses + draws;

    return {
      total: games.length,
      wins,
      losses,
      draws,
      unknown: games.length - knownResults,
      winRate: knownResults ? Math.round((wins / knownResults) * 100) : 0,
    };
  }, [games]);

  const openingStats = useMemo(() => {
    const counts = {};

    games.forEach((game) => {
      const opening = getOpeningName(game);
      if (opening) counts[opening] = (counts[opening] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [games]);

  const recentGames = useMemo(
    () => [...games].reverse().slice(0, showAllGames ? 10 : 4),
    [games, showAllGames]
  );

  const tasks = TRAINING[goal] || TRAINING.balanced;
  const completedCount = tasks.filter((task) =>
    completed.includes(task.title)
  ).length;

  const toggleTask = (title) => {
    setCompleted((previous) =>
      previous.includes(title)
        ? previous.filter((item) => item !== title)
        : [...previous, title]
    );
  };

  const suggestions = useMemo(() => {
    const items = [];

    if (!games.length) {
      items.push({
        title: "Start with a game review",
        detail: "Play a game and save it. Your coach can then show your saved-game history.",
        action: "PlayChess",
        button: "Play a game",
      });
    } else {
      if (stats.unknown > 0) {
        items.push({
          title: "Record clear game results",
          detail: `${stats.unknown} saved game(s) have an unrecognised or missing result. Accurate results make your progress summary more useful.`,
          action: "GameReview",
          button: "Open Game Review",
        });
      }

      items.push({
        title: "Review your recent games",
        detail: "Look for recurring mistakes and important turning points instead of focusing only on wins and losses.",
        action: "GameReview",
        button: "Review games",
      });
    }

    if (goal === "openings" && openingStats.length) {
      items.push({
        title: "Revisit your most-played opening",
        detail: `Your saved PGNs most often begin with ${openingStats[0][0]}. This is a move sequence, not a confirmed named opening.`,
        action: "OpeningStudio",
        button: "Open Opening Studio",
      });
    }

    if (goal === "tactics") {
      items.push({
        title: "Make calculation a habit",
        detail: "Solve a few puzzles slowly and verify the entire line before choosing a move.",
        action: "Puzzles",
        button: "Practise puzzles",
      });
    }

    if (goal === "endgames") {
      items.push({
        title: "Practise technical positions",
        detail: "Study king activity, passed pawns and basic winning or drawing methods.",
        action: "Puzzles",
        button: "Train endgames",
      });
    }

    return items;
  }, [games.length, stats.unknown, goal, openingStats]);

  return (
    <main className="coach-page">
      <header className="coach-header">
        <div>
          <p className="coach-eyebrow">QELVARIS PERSONAL TRAINING</p>
          <h1>Chess Coach</h1>
          <p>
            Build a consistent training routine from your saved games and chosen goals.
          </p>
        </div>
        <button onClick={() => navigateTo("PlayChess")}>
          Start a game
        </button>
      </header>

      <section className="coach-summary-grid">
        <article className="coach-stat-card">
          <span>Saved games</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="coach-stat-card">
          <span>Wins</span>
          <strong>{stats.wins}</strong>
        </article>
        <article className="coach-stat-card">
          <span>Losses</span>
          <strong>{stats.losses}</strong>
        </article>
        <article className="coach-stat-card">
          <span>Win rate</span>
          <strong>{stats.winRate}%</strong>
          <small>Of games with recognised results</small>
        </article>
      </section>

      <section className="coach-panel">
        <div>
          <h2>Choose your training focus</h2>
          <p>Select the area you want to work on. You can change it anytime.</p>
        </div>

        <div className="coach-goal-selector">
          {GOALS.map((item) => (
            <button
              key={item.id}
              className={goal === item.id ? "active" : ""}
              onClick={() => setGoal(item.id)}
              aria-pressed={goal === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="coach-two-column">
        <div className="coach-panel">
          <h2>Your training plan</h2>
          <p>
            Completed: {completedCount} of {tasks.length}
          </p>

          <div className="coach-progress-track">
            <div
              className="coach-progress-fill"
              style={{ width: `${(completedCount / tasks.length) * 100}%` }}
            />
          </div>

          <div className="coach-tip-grid">
            {tasks.map((task) => {
              const isDone = completed.includes(task.title);

              return (
                <article className="coach-tip-card" key={task.title}>
                  <label className="coach-task-label">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleTask(task.title)}
                    />
                    <span>{isDone ? "Completed" : "Training task"}</span>
                  </label>

                  <h3>{task.title}</h3>
                  <p>{task.detail}</p>

                  <button onClick={() => navigateTo(task.module)}>
                    Open module
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <div className="coach-panel">
          <h2>Coach recommendations</h2>
          <p>
            Suggestions based on your selected focus and available saved-game data.
          </p>

          <div className="coach-opening-list">
            {suggestions.map((item) => (
              <article className="coach-opening-row" key={item.title}>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
                <button onClick={() => navigateTo(item.action)}>
                  {item.button}
                </button>
              </article>
            ))}
          </div>

          <p className="coach-footnote">
            These are training suggestions, not verified diagnoses of your chess weaknesses.
          </p>
        </div>
      </section>

      <section className="coach-panel">
        <div className="coach-section-heading">
          <div>
            <h2>Opening patterns</h2>
            <p>Most common first two moves found in saved PGNs.</p>
          </div>
          <button onClick={() => navigateTo("OpeningStudio")}>
            Opening Studio
          </button>
        </div>

        {openingStats.length ? (
          <div className="coach-opening-list">
            {openingStats.map(([opening, count]) => (
              <div className="coach-opening-row" key={opening}>
                <strong>{opening}</strong>
                <span>{count} game{count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="coach-empty">
            Opening patterns will appear when saved games contain valid PGNs.
          </p>
        )}
      </section>

      <section className="coach-panel">
        <div className="coach-section-heading">
          <div>
            <h2>Recent saved games</h2>
            <p>Your locally saved games, when available.</p>
          </div>
          <button onClick={() => navigateTo("GameReview")}>
            Open Game Review
          </button>
        </div>

        {recentGames.length ? (
          <>
            <div className="coach-game-list">
              {recentGames.map((game, index) => {
                const result = resultType(game);
                const label = result === "win"
                  ? "Win"
                  : result === "loss"
                    ? "Loss"
                    : result === "draw"
                      ? "Draw"
                      : "Result unavailable";

                return (
                  <div className="coach-game-row" key={game.id ?? `${game.date}-${index}`}>
                    <div>
                      <strong>{game.date || "Saved game"}</strong>
                      <p>{game.source || "Chess game"}</p>
                    </div>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>

            {games.length > 4 && (
              <button onClick={() => setShowAllGames((value) => !value)}>
                {showAllGames ? "Show fewer" : "Show more"}
              </button>
            )}
          </>
        ) : (
          <p className="coach-empty">
            Abhi koi saved game nahi mila. Play Chess mein game khelo aur Save Game use karo.
          </p>
        )}
      </section>

      <p className="coach-footnote">
        Your plan and checklist are stored in this browser. They are not synced to an online account.
      </p>
    </main>
  );
}